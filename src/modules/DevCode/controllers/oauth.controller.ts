import { Request, Response } from "express";
import { google } from "googleapis";
import { Cliente } from "../../../models/cliente.model";
import { EncryptionService } from "../services/encryption.service";
import crypto from "crypto";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Inicia el flujo OAuth2: redirige al usuario a Google
 */
export const initiateGoogleLogin = async (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(32).toString("hex");
    
    // Guardar state en sesión o cookie para verificar después
    res.cookie("oauth_state", state, { 
      httpOnly: true, 
      maxAge: 10 * 60 * 1000 // 10 minutos
    });

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "profile", "email", "https://www.googleapis.com/auth/calendar.events"],
      state,
    });

    return res.json({ authUrl: url });
  } catch (e: any) {
    console.error("initiateGoogleLogin error", e);
    return res.status(500).json({ message: "Error initiating Google login" });
  }
};

/**
 * Callback de Google: intercambia el authorization code por tokens
 */
export const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Missing authorization code" });
    }

    // Verificar state
    const savedState = req.cookies?.oauth_state;
    if (state !== savedState) {
      return res.status(400).json({ message: "Invalid state parameter" });
    }

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(400).json({ message: "Failed to get tokens from Google" });
    }

    // Obtener información del usuario desde Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    oauth2Client.setCredentials(tokens);
    
    const userInfo = await oauth2.userinfo.get();
    const googleProfile = userInfo.data;

    if (!googleProfile.email) {
      return res.status(400).json({ message: "Unable to get email from Google profile" });
    }

    // Buscar o crear Cliente
    const cliente = await Cliente.findOneAndUpdate(
      { correo: googleProfile.email },
      {
        nombre: googleProfile.name || googleProfile.email.split("@")[0],
        correo: googleProfile.email,
        googleId: googleProfile.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: EncryptionService.encrypt(tokens.refresh_token || ""),
        googleTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        telefono: "", // placeholder
        contraseña: crypto.randomBytes(16).toString("hex"), // random password
      },
      { upsert: true, new: true }
    );

    // Guardar datos en sesión/cookie para que el frontend los recupere
    const callbackData = {
      clienteId: cliente._id,
      accessToken: tokens.access_token,
      expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      user: {
        name: googleProfile.name,
        email: googleProfile.email,
        picture: googleProfile.picture,
      },
    };

    // Redirigir al frontend con los datos codificados en la URL
    const frontendCallbackUrl = `${process.env.FRONTEND_REDIRECT_URI || "http://localhost:3000"}/booking/auth-callback?data=${encodeURIComponent(JSON.stringify(callbackData))}`;
    return res.redirect(frontendCallbackUrl);
  } catch (e: any) {
    console.error("googleCallback error", e);
    const frontendErrorUrl = `${process.env.FRONTEND_REDIRECT_URI || "http://localhost:3000"}/booking/auth-callback?error=${encodeURIComponent(e.message)}`;
    return res.redirect(frontendErrorUrl);
  }
};

/**
 * Refresca el access token usando el refresh token almacenado
 */
export const refreshGoogleToken = async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.body;
    if (!clienteId) return res.status(400).json({ message: "Missing clienteId" });

    const cliente = await Cliente.findById(clienteId);
    if (!cliente || !cliente.googleRefreshToken) {
      return res.status(401).json({ message: "No refresh token found for this client" });
    }

    const refreshToken = EncryptionService.decrypt(cliente.googleRefreshToken);
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Actualizar tokens en la BD
    await Cliente.findByIdAndUpdate(clienteId, {
      googleAccessToken: credentials.access_token,
      googleTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    });

    return res.json({
      success: true,
      accessToken: credentials.access_token,
      expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
    });
  } catch (e: any) {
    console.error("refreshGoogleToken error", e);
    return res.status(500).json({ message: "Error refreshing token", error: e.message });
  }
};

/**
 * Obtiene el access token actual del cliente
 */
export const getCurrentToken = async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.query;
    if (!clienteId) return res.status(400).json({ message: "Missing clienteId" });

    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return res.status(404).json({ message: "Cliente not found" });

    // Si el token está expirado, refrescarlo
    if (cliente.googleTokenExpiresAt && cliente.googleTokenExpiresAt < new Date()) {
      if (cliente.googleRefreshToken) {
        const refreshToken = EncryptionService.decrypt(cliente.googleRefreshToken);
        
        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        await Cliente.findByIdAndUpdate(clienteId, {
          googleAccessToken: credentials.access_token,
          googleTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        });

        return res.json({
          accessToken: credentials.access_token,
          expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
        });
      }
    }

    return res.json({
      accessToken: cliente.googleAccessToken,
      expiresIn: cliente.googleTokenExpiresAt ? Math.floor((cliente.googleTokenExpiresAt.getTime() - Date.now()) / 1000) : 3600,
    });
  } catch (e: any) {
    console.error("getCurrentToken error", e);
    return res.status(500).json({ message: "Error getting token", error: e.message });
  }
};

/**
 * Desloguearse: eliminar tokens de Google
 */
export const googleSignOut = async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.body;
    if (!clienteId) return res.status(400).json({ message: "Missing clienteId" });

    await Cliente.findByIdAndUpdate(clienteId, {
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
      googleTokenExpiresAt: undefined,
    });

    return res.json({ success: true });
  } catch (e: any) {
    console.error("googleSignOut error", e);
    return res.status(500).json({ message: "Error signing out", error: e.message });
  }
};
