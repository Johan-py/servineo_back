import { Schema, model, Document, Types } from 'mongoose';

export interface ICita extends Document {
  proveedorId: Types.ObjectId;
  servicioId: Types.ObjectId;
  fecha: string; // formato YYYY-MM-DD
  horario: {
    inicio: string; // "10:00"
    fin: string;    // "10:30"
  };
  ubicacion?: {
    lat: number;
    lng: number;
    direccion?: string;
    notas?: string;
  };
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  createdAt: Date;
  updatedAt: Date;
}

const CitaSchema = new Schema<ICita>(
  {
    proveedorId: { type: Schema.Types.ObjectId, ref: 'Proveedor', required: true },
    servicioId: { type: Schema.Types.ObjectId, required: true },
    fecha: { type: String, required: true },
    horario: {
      inicio: { type: String, required: true },
      fin: { type: String, required: true },
    },
    ubicacion: {
      lat: { type: Number },
      lng: { type: Number },
      direccion: { type: String },
      notas: { type: String },
    },
    estado: {
      type: String,
      enum: ['pendiente', 'confirmada', 'cancelada'],
      default: 'pendiente',
    },
  },
  { timestamps: true }
);

// Índice para evitar solapamiento por proveedor y fecha
CitaSchema.index({ proveedorId: 1, fecha: 1 });

export const Cita = model<ICita>('Cita', CitaSchema);
