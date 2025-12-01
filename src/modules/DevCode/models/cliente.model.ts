import mongoose from "mongoose";

const clienteSchema = new mongoose.Schema({
  nombre: String,
  correo: String,
  telefono: String,
  contraseña: String,
  googleAccessToken?: string;
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Cliente = mongoose.model("Cliente", clienteSchema);
