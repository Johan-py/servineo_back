import { Request, Response, NextFunction } from 'express';
// Importamos IRequestWithUser para garantizar el tipado de req.use
import { IRequestWithUser } from '../types';

// Middleware de ejemplo para validación
export const validateData = (req: Request, res: Response, next: NextFunction): void => {
  const { nombre } = req.body;

  if (!nombre) {
    res.status(400).json({
      success: false,
      message: 'El campo nombre es requerido',
    });
    return;
  }

  // Agrega más validaciones según necesites

  next();
};

/**
 * Middleware de Autenticación Provisional para uso interno de DevCode.
 *
 * NOTA: Esto es provisional para la HU03. Debe ser reemplazado por la solución
 * central de autenticación cuando esté disponible.
 */
export const provisionalAuthMiddleware = (
  req: IRequestWithUser,
  res: Response,
  next: NextFunction
) => {
// 1. Verificar si req.user ya fue adjuntado por un middleware de sesión anterior (el login interno) 
    if (req.user && (req.user._id || req.user.id)) {
    if (!req.user.role) {
      req.user.role = 'cliente'; 
    }
    return next();
  }

  // 2. Fallback Provisional (para pruebas internas rápidas, usando un header)
  const provisionalId = req.headers['x-client-id'] as string; 

  if (provisionalId) {
    req.user = { 
      _id: provisionalId,
      id: provisionalId,
      name: 'Cliente Provisional',
      email: 'provisional@devcode.com',
      password: 'N/A', 
      role: 'cliente', 
    };
    return next();
  }
  
  return res.status(401).json({ 
    success: false, 
    message: 'Acceso no autorizado. Se requiere autenticación.' 
  });
};

// Puedes agregar más middlewares aquí
export const otroMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Lógica del middleware
  next();
};