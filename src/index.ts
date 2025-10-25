import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
// Dev y Prod funcionan
import connectDB from "./config/database";
import routesDevcode from './modules/DevCode/routes';


// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();

// Conectar a MongoDB
connectDB();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// RUTA RAÍZ
// ============================================
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'API Backend',
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    modules: []
  });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    database: 'connected',
    uptime: process.uptime()
  });
});

// ============================================
// MONTAR MÓDULOS
// ============================================

// Rutas DevCode
app.use('/api/devcode', routesDevcode);

// Ejemplo de cómo agregar más módulos
// app.use('/api/otro-modulo', otroModuloRouter);

// ============================================
// MANEJO DE ERRORES 404
// ============================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.path
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nServidor corriendo en puerto ${PORT}`);
  console.log(`Modo: ${process.env.NODE_ENV}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`\nMódulos cargados:`);
  console.log(`   - /api/devcode`);
  console.log(`\nListo para recibir peticiones!\n`);
});
