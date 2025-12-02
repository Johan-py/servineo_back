import { Request, Response } from 'express';
import * as fixerService from '../services/Fixer.service';
import * as walletService from '../services/wallet.service';

export const handleGetBilleteraByUsuario = async (req: Request, res: Response) => {
  const { usuario } = req.params;

  try {
    const fixer = await fixerService.getFixerByUsuario(usuario);
    if (!fixer) {
      return res.status(404).json({ success: false, message: `Fixer '${usuario}' no encontrado.` });
    }

    let billetera = await walletService.getBilleteraByFixerId(fixer._id as any); // Casting si es necesario por tipos de Mongoose

    if (!billetera) {
      return res.status(404).json({
        success: false,
        message: `Billetera no encontrada para ${usuario}`
      });
    }

    try {
      const billeteraActualizada = await walletService.checkAndUpdateBilleteraStatus(billetera._id as any);
      return res.status(200).json({
        success: true,
        billetera: billeteraActualizada
      });
    } catch (checkError: any) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar estado de billetera',
        billetera
      });
    }

  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};