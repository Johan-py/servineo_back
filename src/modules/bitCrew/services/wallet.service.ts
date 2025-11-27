import { Types } from "mongoose";
import { Wallet, IWallet } from "../../../models/wallet.model";

export const getBilleteraByFixerId = async (fixerId: Types.ObjectId): Promise<IWallet | null> => {
  return Wallet.findOne({ fixer_id: fixerId });
};

export const checkAndUpdateBilleteraStatus = async (billeteraId: Types.ObjectId): Promise<IWallet | null> => {
  try {
    const billetera = await Wallet.findById(billeteraId);

    if (!billetera) {
      throw new Error("No se encontró la billetera para actualizar.");
    }

    let nuevoEstado: "activa" | "bloqueada";

    // --- Nueva Lógica de Estados ---
    // Si el saldo es 0 o menor, se bloquea.
    if (billetera.saldo <= 0) {
      nuevoEstado = "bloqueada";
      console.log(`[ALERTA] Billetera de fixer '${billetera.fixer_id}' BLOQUEADA (saldo: ${billetera.saldo}).`);
    } else {
      nuevoEstado = "activa";
    }

    // --- Actualizar solo si hay cambios ---
    if (billetera.estado !== nuevoEstado) {
      billetera.estado = nuevoEstado;
      billetera.fecha_actualizacion = new Date();
      await billetera.save();
      console.log(`[Servicio] Estado de billetera ${billeteraId} actualizado a: ${nuevoEstado}`);
    }

    return billetera;
  } catch (error: any) {
    console.error("Error en checkAndUpdateBilleteraStatus:", error.message);
    throw new Error("Error al actualizar el estado de la billetera");
  }
};