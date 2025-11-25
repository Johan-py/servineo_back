import { Request, Response } from 'express';
import * as recargaService from '../services/recarga.service';
import { sendWhatsApp } from '../services/notificacion.service'; // Opcional: Notificar

export const crearRecarga = async (req: Request, res: Response) => {
  try {
    const { nombre, detalle, monto, correo, telefono, tipoDocumento, numeroDocumento } = req.body;

    // Validación básica
    if (!monto || monto <= 0) {
      return res.status(400).json({ success: false, message: "El monto debe ser mayor a 0." });
    }
    if (!correo && !telefono) {
      return res.status(400).json({ success: false, message: "Debe proporcionar correo o teléfono para identificar al usuario." });
    }

    // Llamada al servicio transaccional
    const resultado = await recargaService.crearRecarga({
      nombre,
      detalle,
      monto,
      correo,
      telefono,
      tipoDocumento,
      numeroDocumento,
    } as any);

    // (Opcional) Enviar WhatsApp de confirmación
    // Esto no detiene la respuesta si falla
    if (telefono) {
        sendWhatsApp(telefono, `✅ Recarga exitosa de Bs. ${monto}. Nuevo saldo disponible: Bs. ${resultado.nuevoSaldo}`)
        .catch(err => console.error("No se pudo enviar WS:", err));
    }

    return res.status(201).json({
      success: true,
      message: "Recarga realizada y saldo actualizado correctamente.",
      data: resultado.recarga,
      nuevo_saldo: resultado.nuevoSaldo
    });

  } catch (error: any) {
    console.error("Error en crearRecarga:", error.message);
    
    // Manejo de errores conocidos
    if (error.message.includes("No se encontró un Fixer")) {
        return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Error interno al procesar la recarga." });
  }
};

export const obtenerRecargas = async (req: Request, res: Response) => {
  try {
    const recargas = await recargaService.obtenerRecargas();
    return res.status(200).json({
      success: true,
      data: recargas,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Error al obtener recargas" });
  }
};
