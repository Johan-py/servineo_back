import mongoose, { Types } from "mongoose";
import { Trabajo, ITrabajo } from "../../../models/trabajo.model";
import { Wallet } from "../../../models/wallet.model";
import { Transaccion } from "../../../models/transaccion.model";

const TASA_COMISION = 0.05; // 5%

export const getTrabajosByFixerId = async (fixerId: Types.ObjectId): Promise<ITrabajo[]> => {
  return Trabajo.find({ fixer_id: fixerId });
};

export const pagarTrabajoEfectivo = async (trabajoId: string): Promise<ITrabajo> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Buscar el trabajo
    const trabajo = await Trabajo.findById(trabajoId).session(session);
    if (!trabajo) {
      throw new Error("Trabajo no encontrado.");
    }
    
    // Validación de estado con los nuevos ENUMs
    if (trabajo.fecha_pago) {
      throw new Error("Este trabajo ya ha sido registrado como pagado (fecha_pago existe).");
    }
    if (trabajo.estado !== "terminado") {
      throw new Error('El trabajo debe estar "terminado" para poder registrar el pago.');
    }

    // 2. Buscar la billetera
    const billetera = await Wallet.findOne({ fixer_id: trabajo.fixer_id }).session(session);
    if (!billetera) {
      throw new Error("Billetera del fixer no encontrada.");
    }

    // 3. Calcular comisión
    const montoTotalDelTrabajo = trabajo.monto_a_pagar;
    const montoComision = montoTotalDelTrabajo * TASA_COMISION;

    // 4. Validar saldo
    if (billetera.saldo <= 0) {
      throw new Error("No se puede continuar el pago por falta de saldo. Su saldo debe ser mayor a 0 Bs");
    }

    // 5. Descontar saldo
    billetera.saldo -= montoComision;
    billetera.fecha_actualizacion = new Date();

    // 6. Crear Transacción (Adaptada al nuevo Modelo Complejo)
    const nuevaTransaccion = new Transaccion({
      id_deuda: trabajo._id, // Usamos el ID del trabajo como referencia de la deuda
      cuentaId: billetera._id, // La billetera es la cuenta afectada
      tipo: "gasto", // Es un gasto para el fixer (pago de comisión)
      monto: montoComision,
      descripcion: `Comisión (${TASA_COMISION * 100}%) por trabajo: ${trabajo.descripcion.substring(0, 20)}...`,
      fecha_pago: new Date(),
      forma_pago: "SALDO_INTERNO",
      url_pasarela_pagos: "INTERNAL_WALLET_DEDUCTION", // Valor placeholder requerido
      facturas: [] 
    });

    // 7. Actualizar trabajo
    // Nota: No cambiamos 'estado' a 'pagado' porque no existe en el enum nuevo.
    // Usamos fecha_pago como indicador de finalización financiera.
    trabajo.fecha_pago = new Date();
    
    // 8. Guardar en sesión
    await billetera.save({ session });
    await trabajo.save({ session });
    await nuevaTransaccion.save({ session });

    await session.commitTransaction();
    console.log(`[Servicio] Comisión de Bs. ${montoComision} cobrada.`);
    
    return trabajo;

  } catch (error: any) {
    await session.abortTransaction();
    console.error(`Error en transacción de pago: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
};