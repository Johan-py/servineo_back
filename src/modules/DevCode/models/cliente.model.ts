import mongoose from "mongoose";

const clienteSchema = new mongoose.Schema({
  nombre: String,
  correo: { type: String, required: true, unique: true }, 
  telefono: String,
  contraseña: String,
  googleAccessToken: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Cliente = mongoose.model("Cliente", clienteSchema);
