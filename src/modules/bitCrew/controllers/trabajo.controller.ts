import { Request, Response } from 'express';
import * as fixerService from '../services/Fixer.service';
import * as trabajoService from '../services/trabajo.service';

export const handleGetTrabajosByUsuario = async (req: Request, res: Response) => {
  const { usuario } = req.params;
  
  try {
    const fixer = await fixerService.getFixerByUsuario(usuario);
    if (!fixer) {
      return res.status(404).json({ success: false, message: `Fixer '${usuario}' no encontrado.` });
    }

    const trabajos = await trabajoService.getTrabajosByFixerId(fixer._id as any);
    res.status(200).json(trabajos);

  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

export const handlePagarTrabajoEfectivo = async (req: Request, res: Response) => {
  const { id } = req.params; 

  try {
    const trabajoActualizado = await trabajoService.pagarTrabajoEfectivo(id);
    
    res.status(200).json({ 
      success: true, 
      message: 'Comisión cobrada y trabajo registrado exitosamente.',
      trabajo: trabajoActualizado 
    });

  } catch (error: any) {
    const esErrorDeNegocio = 
      error.message.includes('falta de saldo') ||
      error.message.includes('no encontrado') ||
      error.message.includes('ya ha sido registrado como pagado') ||
      error.message.includes('debe estar "terminado"');

    if (esErrorDeNegocio) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};