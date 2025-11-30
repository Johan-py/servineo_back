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
      prompt: "consent", // Fuerza que Google pida consentimiento y devuelva refresh_token
      scope: ["openid", "profile", "email", "https://www.googleapis.com/auth/calendar.events"],
      state,
    });

    console.log("✅ Generated OAuth URL:", url.substring(0, 100) + "...");
    return res.json({ authUrl: url });
  } catch (e: any) {
    console.error("❌ initiateGoogleLogin error", e);
    return res.status(500).json({ message: "Error initiating Google login" });
  }
};

/**
 * Callback de Google: intercambia el authorization code por tokens
 */
export const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    console.log("🔍 googleCallback received - code:", !!code, "state:", !!state);

    if (!code || typeof code !== "string") {
      console.error("❌ Missing authorization code");
      return res.status(400).json({ message: "Missing authorization code" });
    }

    // Verificar state
    const savedState = req.cookies?.oauth_state;
    if (state !== savedState) {
      console.error("❌ Invalid state parameter - saved:", savedState, "received:", state);
      return res.status(400).json({ message: "Invalid state parameter" });
    }

    console.log("✅ State verified");

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log("📦 Tokens received from Google:", {
      access_token: !!tokens.access_token,
      refresh_token: !!tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });

    if (!tokens.access_token) {
      console.error("❌ Failed to get access_token from Google");
      return res.status(400).json({ message: "Failed to get tokens from Google" });
    }

    // refresh_token es opcional - si no viene, lo manejamos gracefully
    if (!tokens.refresh_token) {
      console.warn("⚠️ No refresh_token received from Google - user may need to reauthorize later");
    }

    // Obtener información del usuario desde Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    
    const userInfo = await oauth2.userinfo.get();
    const googleProfile = userInfo.data;

    console.log("👤 User info retrieved:", googleProfile.email);

    if (!googleProfile.email) {
      console.error("❌ Unable to get email from Google profile");
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
        googleRefreshToken: tokens.refresh_token ? EncryptionService.encrypt(tokens.refresh_token) : undefined,
        googleTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        telefono: "", // placeholder
        contraseña: crypto.randomBytes(16).toString("hex"), // random password
      },
      { upsert: true, new: true }
    );

    console.log("✅ Cliente created/updated:", cliente._id);

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
    
    console.log("🔀 Redirecting to frontend callback URL");
    return res.redirect(frontendCallbackUrl);
  } catch (e: any) {
    console.error("❌ googleCallback error", e.message);
    console.error("Stack trace:", e.stack);
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
 * Si el token está expirado o cerca de expirar (< 5 min), lo refresca automáticamente
 */
export const getCurrentToken = async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.query;
    if (!clienteId) return res.status(400).json({ message: "Missing clienteId" });

    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return res.status(404).json({ message: "Cliente not found" });

    // Si no hay access token, devolver error
    if (!cliente.googleAccessToken) {
      return res.status(401).json({ message: "No access token found - user needs to log in again" });
    }

    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Si el token está expirado o va a expirar en los próximos 5 minutos, refrescarlo
    if (cliente.googleTokenExpiresAt && cliente.googleTokenExpiresAt <= fiveMinutesFromNow) {
      if (!cliente.googleRefreshToken) {
        console.warn("⚠️ Token expired/expiring but no refresh token available for clienteId:", clienteId);
        return res.status(401).json({ message: "Token expired - user needs to log in again" });
      }

      console.log("🔄 Refreshing token for clienteId:", clienteId);
      
      try {
        const refreshToken = EncryptionService.decrypt(cliente.googleRefreshToken);
        
        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        console.log("✅ Token refreshed successfully");

        await Cliente.findByIdAndUpdate(clienteId, {
          googleAccessToken: credentials.access_token,
          googleTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        });

        return res.json({
          accessToken: credentials.access_token,
          expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
          refreshed: true,
        });
      } catch (refreshError: any) {
        console.error("❌ Error refreshing token:", refreshError.message);
        // Si el refresh falla, podría ser que el refresh token sea inválido o haya expirado
        return res.status(401).json({ 
          message: "Token refresh failed - user needs to log in again",
          error: refreshError.message 
        });
      }
    }

    const expiresIn = cliente.googleTokenExpiresAt 
      ? Math.floor((cliente.googleTokenExpiresAt.getTime() - now.getTime()) / 1000)
      : 3600;

    return res.json({
      accessToken: cliente.googleAccessToken,
      expiresIn,
      refreshed: false,
    });
  } catch (e: any) {
    console.error("❌ getCurrentToken error", e);
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
