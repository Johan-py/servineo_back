import mongoose, { Schema, Document } from "mongoose";

export interface IRecarga extends Document {
  nombre: string;
  detalle: string;
  monto: number;
  correo: string;
  telefono: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fecha: Date;
}

const RecargaSchema = new Schema<IRecarga>({
  nombre: { type: String, required: true },
  detalle: { type: String, required: true },
  monto: { type: Number, required: true },
  correo: { type: String, required: true },
  telefono: { type: String, required: true },
  tipoDocumento: { type: String, required: true },
  numeroDocumento: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
}, {
  collection: "recargas" // Nombre estándar en plural
});

export const Recarga = mongoose.models.Recarga || mongoose.model<IRecarga>("Recarga", RecargaSchema);