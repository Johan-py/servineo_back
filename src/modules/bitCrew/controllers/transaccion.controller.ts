import { Request, Response } from 'express';
import * as fixerService from '../services/Fixer.service';
import * as transaccionService from '../services/transaccion.service';

export const handleGetTransaccionesByUsuario = async (req: Request, res: Response) => {
  const { usuario } = req.params;

  try {
    const fixer = await fixerService.getFixerByUsuario(usuario);
    if (!fixer) {
      return res.status(404).json({ success: false, message: `Fixer '${usuario}' no encontrado.` });
    }

    // Buscamos transacciones usando la billetera asociada al fixer
    const transacciones = await transaccionService.getTransaccionesByFixerId(fixer._id as any);

    res.status(200).json({
      success: true,
      transacciones: transacciones
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};