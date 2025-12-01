import { Cita, ICita } from '../models/cita.model';
import { Proveedor } from "../models/proveedor.model"
import { Cliente } from '../models/cliente.model';
import { Types } from 'mongoose';
import { GoogleCalendarService } from './googleCalendar.service';

export class CitaService {
  static async crearCita(data: Partial<ICita>) {
    const proveedor = await Proveedor.findById(data.proveedorId);
    if (!proveedor) throw new Error('Proveedor no encontrado');

    const existe = await Cita.findOne({
      proveedorId: data.proveedorId,
      fecha: data.fecha,
      'horario.inicio': data.horario?.inicio,
      estado: { $ne: 'cancelada' } // Ignorar citas canceladas
    });

    if (existe) throw new Error('Horario ya ocupado');

    const nuevaCita = new Cita(data);
    await nuevaCita.save();
    return nuevaCita.populate(['proveedorId', 'clienteId', 'servicioId']);
  }

  static async listarPorProveedor(proveedorId: string) {
    return Cita.find({ proveedorId: new Types.ObjectId(proveedorId) })
      .populate('proveedorId')
      .populate('clienteId')
      .populate('servicioId');
  }

  static async listarPorCliente(clienteId: string) {
    return Cita.find({ clienteId: new Types.ObjectId(clienteId) })
      .populate('proveedorId')
      .populate('clienteId')
      .populate('servicioId');
  }

  static async actualizarCita(id: string, data: any) {
    return await Cita.findByIdAndUpdate(id, data, { new: true })
      .populate('proveedorId')
      .populate('clienteId')
      .populate('servicioId');
  }

  // ✅ Eliminar solo si pertenece al proveedor
  static async eliminarCitaPorProveedor(citaId: string, proveedorId: string) {
    const cita = await Cita.findById(citaId);
    if (!cita) throw new Error('Cita no encontrada');
    if (cita.proveedorId.toString() !== proveedorId)
      throw new Error('No puedes eliminar citas de otro proveedor');

    return await Cita.findByIdAndDelete(citaId);
  }

  // HU03: Cancela una cita, actualiza su estado y elimina el evento de Google Calendar.

  static async cancelarCita(citaId: string, clienteId: string) {
    // 1. Buscar la cita y verificar propiedad
    const cita = await Cita.findOne({ _id: citaId, clienteId });

    if (!cita) {
      throw new Error('Cita no encontrada o no pertenece al cliente.');
    }

    if (cita.estado === 'cancelada') {
      throw new Error('La cita ya está cancelada.');
    }

    let googleSyncSuccess = false;

    // 2. Eliminar evento de Google Calendar (Criterio: Eliminación automática del evento)
    if (cita.googleEventId) {
      const cliente = await Cliente.findById(clienteId);

      if (cliente && cliente.googleAccessToken) {
         console.log(`Intentando eliminar evento de Google ID: ${cita.googleEventId}`);
        
         // Utilizamos el servicio para borrar el evento
         const deleteResult = await GoogleCalendarService.deleteEvent(
          cliente.googleAccessToken,
          cita.googleEventId
         );

        if (deleteResult.success) {
          googleSyncSuccess = true;
         } else {
          console.error('Fallo la eliminación en Google Calendar. Error:', deleteResult.error);
         }
      } else {
        console.warn('Cliente sin token de Google. No se puede sincronizar la cancelación.');
      }
    }

    // 3. Actualizar estado de la cita local a 'cancelada' (Criterio: Actualización de estado en la lista)
    cita.estado = 'cancelada';
    const citaCancelada = await cita.save();

    return {
      cita: citaCancelada,
      googleSyncSuccess,
    };
  }
}
