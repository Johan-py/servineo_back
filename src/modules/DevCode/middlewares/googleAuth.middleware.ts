/**
 * Middleware para extraer y validar token de Google Calendar del header
 * Permite autenticación con Google Calendar de forma opcional
 */

import { Request, Response, NextFunction } from 'express';

export interface RequestWithGoogleAuth extends Request {
  googleAccessToken?: string;
  googleAuthError?: string;
}

/**
 * Middleware: Extraer token de Google del header Authorization o body
 * Formatos soportados:
 * 1. Header: Authorization: Bearer <google_access_token>
 * 2. Body: { googleAccessToken: "<google_access_token>" }
 */
export const extractGoogleToken = (
  req: RequestWithGoogleAuth,
  res: Response,
  next: NextFunction
) => {
  try {
    // Opción 1: Token en header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      req.googleAccessToken = authHeader.replace('Bearer ', '');
      return next();
    }

    // Opción 2: Token en body
    if (req.body?.googleAccessToken) {
      req.googleAccessToken = req.body.googleAccessToken;
      return next();
    }

    // Token no es obligatorio, solo será usado si está disponible
    next();
  } catch (error) {
    req.googleAuthError = error instanceof Error ? error.message : 'Unknown error';
    next();
  }
};

/**
 * Middleware: Validar que exista token de Google
 * Usa este middleware en rutas que REQUIEREN autenticación con Google
 */
export const requireGoogleAuth = (
  req: RequestWithGoogleAuth,
  res: Response,
  next: NextFunction
) => {
  if (!req.googleAccessToken) {
    return res.status(401).json({
      success: false,
      error: 'Google access token requerido para sincronizar con Calendar',
      message: 'Envía el token en header Authorization o en el body como googleAccessToken'
    });
  }
  next();
};
