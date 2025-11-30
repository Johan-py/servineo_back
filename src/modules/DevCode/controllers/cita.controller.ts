import { Request, Response } from 'express';
import { CitaService } from '../services/cita.service';
import { GoogleCalendarService } from '../services/googleCalendar.service';
import { Cita } from '../models/cita.model';
import { RequestWithGoogleAuth } from '../middlewares/googleAuth.middleware';

export class CitaController {
  static async crear(req: RequestWithGoogleAuth, res: Response) {
    try {
      const nueva = await CitaService.crearCita(req.body);

      // 🗓️ Intentar sincronizar con Google Calendar y devolver el resultado al frontend
      let googleSync: any = { attempted: false };
      if (req.googleAccessToken) {
        googleSync.attempted = true;
        try {
          const result: any = await GoogleCalendarService.createEvent(req.googleAccessToken, nueva);
          if (result.success) {
            // Actualizar cita con googleEventId
            await Cita.findByIdAndUpdate(
              nueva._id,
              {
                googleEventId: result.googleEventId,
                googleCalendarSynced: true,
                lastSyncedAt: new Date(),
              },
              { new: true }
            );
            googleSync = { success: true, googleEventId: result.googleEventId, message: result.message };
          } else {
            googleSync = { success: false, error: result.error || 'Unknown error', details: result.details || null };
          }
        } catch (err: any) {
          console.error('Error sincronizando con Google Calendar:', err);
          googleSync = { success: false, error: err.message || String(err) };
        }
      }

      res.status(201).json({ success: true, data: nueva, googleSync });
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

  static async actualizar(req: RequestWithGoogleAuth, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      const citaActualizada = await CitaService.actualizarCita(id, data);

      if (!citaActualizada) {
        return res.status(404).json({ success: false, error: 'Cita no encontrada' });
      }

      // 🗓️ Intentar sincronizar cambios con Google Calendar y devolver resultado
      const citaData = citaActualizada.toObject() as any;
      let googleSync: any = { attempted: false };
      if (req.googleAccessToken && citaData.googleEventId) {
        googleSync.attempted = true;
        try {
          const result: any = await GoogleCalendarService.updateEvent(
            req.googleAccessToken,
            citaData.googleEventId,
            citaActualizada
          );

          if (result.success) {
            await Cita.findByIdAndUpdate(id, { lastSyncedAt: new Date() });
            googleSync = { success: true, message: result.message };
          } else {
            googleSync = { success: false, error: result.error || 'Unknown error' };
          }
        } catch (err: any) {
          console.error('Error sincronizando actualización:', err);
          googleSync = { success: false, error: err.message || String(err) };
        }
      }

      res.json({ success: true, data: citaActualizada, googleSync });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // ✅ Eliminar cita como proveedor
  static async eliminarPorProveedor(req: RequestWithGoogleAuth, res: Response) {
    try {
      const { id } = req.params; // id de la cita
      const { proveedorId } = req.body; // proveedor que hace la petición

      // Obtener cita antes de eliminar (para saber googleEventId)
      const cita = await Cita.findById(id);
      
      await CitaService.eliminarCitaPorProveedor(id, proveedorId);

      // 🗓️ Eliminar evento de Google Calendar
      const citaData = cita?.toObject() as any;
      if (req.googleAccessToken && citaData?.googleEventId) {
        GoogleCalendarService.deleteEvent(req.googleAccessToken, citaData.googleEventId)
          .catch((err) => console.error('Error eliminando evento de Google Calendar:', err));
      }

      res.json({ success: true, message: 'Cita eliminada correctamente' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
