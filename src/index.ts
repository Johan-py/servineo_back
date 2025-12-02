// ============================================
// IMPORTS BASE
// ============================================
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import path from "path";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { google } from "googleapis";

// ============================================
// CONFIG
// ============================================
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_REDIRECT_URI || "https://servineo-front-liard.vercel.app";

// ============================================
// CORS
// ============================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  FRONTEND_URL
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// MIDDLEWARES
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());

// ============================================
// DATABASE (Ejemplo)
// ============================================
import connectDB from "./config/database";
connectDB().catch(err => console.error("DB error:", err.message));

// ============================================
// GOOGLE OAUTH2 CLIENT
// ============================================
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ============================================
// ROUTER /api/devcode
// ============================================
const devcodeRouter = express.Router();

// Ruta raíz devcode
devcodeRouter.get('/', (req: Request, res: Response) => {
  res.json({ message: "DevCode API OK" });
});

// Iniciar login con Google
devcodeRouter.get('/auth/google-login', async (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(32).toString("hex");

    res.cookie("oauth_state", state, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000, 
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    });

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "openid",
        "profile",
        "email",
        "https://www.googleapis.com/auth/calendar.events"
      ],
      state,
    });

    return res.json({ authUrl: url });
  } catch (err) {
    console.error("initiateGoogleLogin error:", err);
    return res.status(500).json({ message: "Error initiating Google login" });
  }
});

// Callback de Google
devcodeRouter.get('/auth/google-callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies?.oauth_state;

    if (!code || state !== savedState) {
      return res.status(400).json({ message: "Invalid code or state" });
    }

    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const callbackData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      user: userInfo.data
    };

    const frontendCallbackUrl = `${FRONTEND_URL}/booking/auth-callback?data=${encodeURIComponent(JSON.stringify(callbackData))}`;
    return res.redirect(frontendCallbackUrl);

  } catch (err: any) {
    console.error("googleCallback error:", err);
    const frontendErrorUrl = `${FRONTEND_URL}/booking/auth-callback?error=${encodeURIComponent(err.message)}`;
    return res.redirect(frontendErrorUrl);
  }
});

// ============================================
// MOUNT ROUTER
// ============================================
app.use('/api/devcode', devcodeRouter);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Frontend permitido: ${allowedOrigins.join(", ")}`);
  console.log(`🌐 Rutas: /api/devcode/auth/google-login , /api/devcode/auth/google-callback`);
});
