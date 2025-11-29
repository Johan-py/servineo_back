import { Request, Response } from 'express';
import { CitaService } from '../services/cita.service';
import { GoogleCalendarService } from '../services/googleCalendar.service';
import { Cita } from '../models/cita.model';

export class CitaController {
  static async crear(req: Request, res: Response) {
    try {
      const nueva = await CitaService.crearCita(req.body);

      // 🗓️ Sincronizar con Google Calendar de forma ASINCRÓNICA
      // No bloqueamos la respuesta si falla Google Calendar
      const googleAccessToken = req.headers.authorization?.replace('Bearer ', '') || 
                                req.body.googleAccessToken;

      if (googleAccessToken) {
        // Ejecutar en background, sin esperar
        GoogleCalendarService.createEvent(googleAccessToken, nueva)
          .then((result: any) => {
            if (result.success) {
              // Actualizar cita con googleEventId
              Cita.findByIdAndUpdate(
                nueva._id,
                {
                  googleEventId: result.googleEventId,
                  googleCalendarSynced: true,
                  lastSyncedAt: new Date(),
                },
                { new: true }
              ).catch((err) => console.error('Error actualizando googleEventId:', err));
            }
          })
          .catch((err) => console.error('Error sincronizando con Google Calendar:', err));
      }

      res.status(201).json({ success: true, data: nueva });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async listarPorProveedor(req: Request, res: Response) {
    try {
      const proveedorId = req.params.proveedorId;
      const citas = await CitaService.listarPorProveedor(proveedorId);
      res.json({ success: true, data: citas });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async listarPorCliente(req: Request, res: Response) {
    try {
      const clienteId = req.params.clienteId;
      const citas = await CitaService.listarPorCliente(clienteId);
      res.json({ success: true, data: citas });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async actualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      const citaActualizada = await CitaService.actualizarCita(id, data);

      if (!citaActualizada) {
        return res.status(404).json({ success: false, error: 'Cita no encontrada' });
      }

      // 🗓️ Sincronizar cambios con Google Calendar
      const googleAccessToken = req.headers.authorization?.replace('Bearer ', '') || 
                                req.body.googleAccessToken;

      const citaData = citaActualizada.toObject() as any;
      if (googleAccessToken && citaData.googleEventId) {
        GoogleCalendarService.updateEvent(
          googleAccessToken,
          citaData.googleEventId,
          citaActualizada
        )
          .then((result: any) => {
            if (result.success) {
              // Actualizar timestamp de última sincronización
              Cita.findByIdAndUpdate(
                id,
                { lastSyncedAt: new Date() },
                { new: true }
              ).catch((err) => console.error('Error actualizando lastSyncedAt:', err));
            }
          })
          .catch((err) => console.error('Error sincronizando actualización:', err));
      }

      res.json({ success: true, data: citaActualizada });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // ✅ Eliminar cita como proveedor
  static async eliminarPorProveedor(req: Request, res: Response) {
    try {
      const { id } = req.params; // id de la cita
      const { proveedorId } = req.body; // proveedor que hace la petición

      // Obtener cita antes de eliminar (para saber googleEventId)
      const cita = await Cita.findById(id);
      
      await CitaService.eliminarCitaPorProveedor(id, proveedorId);

      // 🗓️ Eliminar evento de Google Calendar
      const googleAccessToken = req.headers.authorization?.replace('Bearer ', '') || 
                                req.body.googleAccessToken;

      const citaData = cita?.toObject() as any;
      if (googleAccessToken && citaData?.googleEventId) {
        GoogleCalendarService.deleteEvent(googleAccessToken, citaData.googleEventId)
          .catch((err) => console.error('Error eliminando evento de Google Calendar:', err));
      }

      res.json({ success: true, message: 'Cita eliminada correctamente' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
