import mongoose from 'mongoose';
import { Recarga, IRecarga } from '../models/recarga.model';
import { Wallet } from '../../../models/wallet.model';
import { Transaccion } from '../../../models/transaccion.model';
import { Fixer } from '../../../models/fixer.model'; // Importamos Fixer para buscarlo

export const crearRecarga = async (data: IRecarga) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Buscar al Fixer asociado a esta recarga
    // Asumimos que la recarga llega con el correo o teléfono registrado del Fixer
    const fixer = await Fixer.findOne({ 
      $or: [{ email: data.correo }, { telefono: data.telefono }] 
    }).session(session);

    if (!fixer) {
      throw new Error("No se encontró un Fixer registrado con ese correo o teléfono.");
    }

    // 2. Buscar la Billetera del Fixer
    const wallet = await Wallet.findOne({ fixer_id: fixer._id }).session(session);
    if (!wallet) {
      throw new Error("El Fixer no tiene una billetera activa.");
    }

    // 3. Crear el registro de Recarga (Auditoría del pago externo)
    const nuevaRecarga = new Recarga(data);
    
    // 4. Actualizar el saldo de la Billetera
    wallet.saldo += data.monto;
    wallet.fecha_actualizacion = new Date();

    // Si la billetera estaba 'bloqueada' y ahora tiene saldo positivo, la activamos
    if (wallet.saldo > 0 && wallet.estado === 'bloqueada') {
      wallet.estado = 'activa';
      console.log(`[Recarga] Billetera del fixer ${fixer.usuario} REACTIVADA.`);
    }

    // 5. Crear la Transacción (INGRESO)
    const nuevaTransaccion = new Transaccion({
      id_deuda: nuevaRecarga._id, // Referenciamos la recarga como el origen
      cuentaId: wallet._id,       // La cuenta afectada es la billetera
      tipo: "ingreso",            // Es dinero que entra
      monto: data.monto,
      descripcion: `Recarga de saldo: ${data.detalle}`,
      fecha_pago: new Date(),
      forma_pago: "PASARELA_EXTERNA", // O el método que corresponda
      url_pasarela_pagos: "URL_DEL_COMPROBANTE", // Aquí podrías guardar URL si tienes
      facturas: []
    });

    // 6. Guardar todo
    await nuevaRecarga.save({ session });
    await wallet.save({ session });
    await nuevaTransaccion.save({ session });

    // 7. Confirmar cambios
    await session.commitTransaction();
    console.log(`[Recarga] Recarga de Bs ${data.monto} exitosa para ${fixer.usuario}`);
    
    return { recarga: nuevaRecarga, nuevoSaldo: wallet.saldo };

  } catch (error) {
    // Si falla, revertimos todo
    await session.abortTransaction();
    console.error("Error en transacción de recarga:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

export const obtenerRecargas = async () => {
  return await Recarga.find().sort({ fecha: -1 });
};