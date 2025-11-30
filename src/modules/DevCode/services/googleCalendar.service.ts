import { google } from 'googleapis';
import { ICita } from '../models/cita.model';

/**
 * Servicio para sincronizar citas con Google Calendar
 * Permite crear, actualizar y eliminar eventos de Google Calendar
 * desde citas agendadas en la aplicación
 */
export class GoogleCalendarService {
  private static calendar = google.calendar('v3');

  /**
   * Crear un evento en Google Calendar
   * @param accessToken - Token de acceso de Google del usuario
   * @param cita - Datos de la cita a sincronizar
   * @returns Objeto con success y googleEventId
   */
  static async createEvent(accessToken: string, cita: any) {
    try {
      if (!accessToken) {
        console.warn('⚠️ No hay accessToken disponible para sincronizar con Google Calendar');
        return { success: false, error: 'No access token provided' };
      }

      // Crear instancia de OAuth2
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      // Parsear fecha y hora
      const [year, month, day] = cita.fecha.split('-');
      const [horaInicio, minInicio] = cita.horario.inicio.split(':');
      const [horaFin, minFin] = cita.horario.fin.split(':');

      // Crear objetos Date para inicio y fin
      const startTime = new Date(
        parseInt(year),
        parseInt(month) - 1, // Mes es 0-indexed en JavaScript
        parseInt(day),
        parseInt(horaInicio),
        parseInt(minInicio) || 0
      );

      const endTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(horaFin),
        parseInt(minFin) || 0
      );

      // Construir título y descripción del evento en el formato solicitado
      const proveedor = cita.proveedorId || {};
      const proveedorNombre = proveedor.nombre || 'Proveedor';
      const proveedorApellido = proveedor.apellido || '';
      const proveedorFullName = `${proveedorNombre}${proveedorApellido ? ' ' + proveedorApellido : ''}`.trim();
      const proveedorEmail = proveedor.email || 'No disponible';
      const proveedorTelefono = proveedor.telefono || 'No disponible';

      const servicioNombre = cita.servicioId?.nombre || 'Servicio';
      const direccion = cita.ubicacion?.direccion || 'Por confirmar';
      const detalleAdicional = cita.ubicacion?.notas || cita.detalle || 'No se añadió detalle adicional.';

      // Formato de fecha dd/mm/yyyy
      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      const fechaStr = `${pad(startTime.getDate())}/${pad(startTime.getMonth() + 1)}/${startTime.getFullYear()}`;

      // Hora en formato hh:mm
      const horaInicioStr = `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`;
      const horaFinStr = `${pad(endTime.getHours())}:${pad(endTime.getMinutes())}`;

      const title = `${servicioNombre} – Con ${proveedorFullName}`;

      const descriptionLines = [
        `Servicio: ${servicioNombre}`,
        `Proveedor: ${proveedorFullName}`,
        `Email: ${proveedorEmail}`,
        `Teléfono: ${proveedorTelefono}`,
        `Fecha: ${fechaStr}`,
        `Hora: ${horaInicioStr} - ${horaFinStr}`,
        `Ubicación: ${direccion}`,
        `Detalle adicional: ${detalleAdicional}`,
      ];

      const event = {
        summary: title,
        description: descriptionLines.join('\n'),
        start: { dateTime: startTime.toISOString(), timeZone: 'America/Bogota' },
        end: { dateTime: endTime.toISOString(), timeZone: 'America/Bogota' },
        location: direccion,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 día antes
            { method: 'popup', minutes: 30 }, // 30 min antes
          ],
        },
      };

      // Insertar evento en Google Calendar
      const response = await this.calendar.events.insert({
        auth,
        calendarId: 'primary',
        requestBody: event as any,
      });

      console.log(`✅ Evento creado en Google Calendar: ${response.data.id}`);

      return {
        success: true,
        googleEventId: response.data.id,
        message: 'Evento creado en Google Calendar',
      };
    } catch (error: any) {
      console.error('❌ Error creando evento en Google Calendar:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null,
      };
    }
  }

  /**
   * Actualizar un evento existente en Google Calendar
   * @param accessToken - Token de acceso de Google del usuario
   * @param googleEventId - ID del evento en Google Calendar
   * @param cita - Datos actualizados de la cita
   * @returns Objeto con success
   */
  static async updateEvent(accessToken: string, googleEventId: string, cita: any) {
    try {
      if (!accessToken || !googleEventId) {
        console.warn('⚠️ No hay accessToken o googleEventId para actualizar evento');
        return { success: false, error: 'Missing required parameters' };
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      // Parsear fecha y hora (igual que en createEvent)
      const [year, month, day] = cita.fecha.split('-');
      const [horaInicio, minInicio] = cita.horario.inicio.split(':');
      const [horaFin, minFin] = cita.horario.fin.split(':');

      const startTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(horaInicio),
        parseInt(minInicio) || 0
      );

      const endTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(horaFin),
        parseInt(minFin) || 0
      );

      const proveedorNombre = cita.proveedorId?.nombre || 'Proveedor';
      const servicioNombre = cita.servicioId?.nombre || 'Servicio';
      const direccion = cita.ubicacion?.direccion || 'Por confirmar';

      const event = {
        summary: `${servicioNombre} - ${proveedorNombre}`,
        description: `Cita agendada en Servineo\nUbicación: ${direccion}\nEstado: ${cita.estado}`,
        start: { dateTime: startTime.toISOString(), timeZone: 'America/Bogota' },
        end: { dateTime: endTime.toISOString(), timeZone: 'America/Bogota' },
        location: direccion,
      };

      const response = await this.calendar.events.update({
        auth,
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: event as any,
      });

      console.log(`✅ Evento actualizado en Google Calendar: ${googleEventId}`);

      return {
        success: true,
        message: 'Evento actualizado en Google Calendar',
      };
    } catch (error: any) {
      console.error('❌ Error actualizando evento en Google Calendar:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Eliminar un evento de Google Calendar
   * @param accessToken - Token de acceso de Google del usuario
   * @param googleEventId - ID del evento a eliminar
   * @returns Objeto con success
   */
  static async deleteEvent(accessToken: string, googleEventId: string) {
    try {
      if (!accessToken || !googleEventId) {
        console.warn('⚠️ No hay accessToken o googleEventId para eliminar evento');
        return { success: false, error: 'Missing required parameters' };
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      await this.calendar.events.delete({
        auth,
        calendarId: 'primary',
        eventId: googleEventId,
      });

      console.log(`✅ Evento eliminado de Google Calendar: ${googleEventId}`);

      return {
        success: true,
        message: 'Evento eliminado de Google Calendar',
      };
    } catch (error: any) {
      console.error('❌ Error eliminando evento de Google Calendar:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtener detalles de un evento en Google Calendar
   * @param accessToken - Token de acceso de Google del usuario
   * @param googleEventId - ID del evento
   * @returns Datos del evento
   */
  static async getEvent(accessToken: string, googleEventId: string) {
    try {
      if (!accessToken || !googleEventId) {
        return { success: false, error: 'Missing required parameters' };
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendar.events.get({
        auth,
        calendarId: 'primary',
        eventId: googleEventId,
      });

      return {
        success: true,
        event: response.data,
      };
    } catch (error: any) {
      console.error('❌ Error obteniendo evento de Google Calendar:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
