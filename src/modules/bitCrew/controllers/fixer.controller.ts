import { Request, Response } from 'express';
import * as fixerService from '../services/Fixer.service';

export const handleGetAllFixers = async (req: Request, res: Response) => {
  try {
    const fixers = await fixerService.getAllFixers();
    res.status(200).json(fixers);
  } catch (error: any) {
    console.error('Error al obtener fixers:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};