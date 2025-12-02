// ============================================
// IMPORTS BASE
// ============================================
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import path from "path";
import cookieParser from "cookie-parser";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ============================================
// BASE DE DATOS
// ============================================
import connectDB from "./config/database";

connectDB().catch((err) => {
  console.error("❌ Error al conectar con la base de datos:", err.message);
});

// ============================================
// IMPORTS DE RUTAS
// ============================================
import routeswallet from "./modules/bitCrew/routes";
import routesDevcode from "./modules/DevCode/routes";

// ============================================
// INICIALIZACIÓN DE APP
// ============================================
const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://servineo-front-liard.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (como Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS no permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());

// Ruta raíz
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: "API Backend",
    status: "OK",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    database: "connected",
    uptime: process.uptime(),
  });
});

// ============================================
// MONTAR RUTAS
// ============================================
app.use('/api/bitCrew', routeswallet);
app.use('/api/devcode', routesDevcode);

// ============================================
// INICIO DEL SERVIDOR
// ============================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n 🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(` 🧩 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(` 🌐 URL: http://localhost:${PORT}`);
  console.log(`\n Módulos cargados:`);
  console.log(`   - /api/bitCrew`);
  console.log(`   - /api/devcode`);
  console.log(`\n ✅ Listo para recibir peticiones!\n`);
});