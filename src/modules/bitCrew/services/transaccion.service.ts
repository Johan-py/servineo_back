import { Types } from "mongoose";
import { Transaccion, ITransaccion } from "../../../models/transaccion.model";
import { Wallet } from "../../../models/wallet.model";

/**
 * Obtiene transacciones asociadas a la billetera del Fixer.
 */
export const getTransaccionesByFixerId = async (fixerId: Types.ObjectId): Promise<ITransaccion[]> => {
  try {
    // 1. Primero obtenemos la billetera para saber el 'cuentaId'
    const wallet = await Wallet.findOne({ fixer_id: fixerId });
    
    if (!wallet) {
      return [];
    }

    // 2. Buscamos transacciones donde cuentaId sea la billetera del fixer
    const transacciones = await Transaccion.find({ cuentaId: wallet._id })
                                           .sort({ fecha_pago: -1 }); // Usamos fecha_pago del nuevo modelo
    return transacciones;
  } catch (error: any) {
    console.error("Error en servicio - getTransaccionesByFixerId:", error.message);
    throw new Error("Error al buscar transacciones");
  }
};