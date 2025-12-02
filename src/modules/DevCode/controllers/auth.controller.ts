import { Request, Response } from "express";
import { Cliente } from "../../../models/cliente.model";

/**
 * Upsert a Cliente by email coming from Google profile.
 * If the cliente doesn't exist, create a new one with a random password placeholder.
 */
export const upsertGoogleCliente = async (req: Request, res: Response) => {
  try {
    const { email, name, picture, googleId } = req.body;
    if (!email) return res.status(400).json({ message: "Missing email" });

    const randomPass = Math.random().toString(36).slice(2, 10);

    const updated = await Cliente.findOneAndUpdate(
      { correo: email },
      {
        nombre: name || email.split("@")[0],
        correo: email,
        telefono: "",
        contraseña: randomPass
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );


    return res.json({ clienteId: updated?._id });
  } catch (e: any) {
    console.error("upsertGoogleCliente error", e);
    return res.status(500).json({ message: "Internal error" });
  }
};
