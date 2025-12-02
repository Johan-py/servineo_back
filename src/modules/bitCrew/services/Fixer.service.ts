import { Fixer, IFixer } from "../../../models/fixer.model";

/**
 * Obtiene todos los fixers.
 */
export const getAllFixers = async (): Promise<IFixer[]> => {
  try {
    return await Fixer.find();
  } catch (error: any) {
    console.error("Error en servicio - getAllFixers:", error);
    throw new Error("Error al obtener fixers");
  }
};

/**
 * Busca un fixer por su nombre de usuario.
 */
export const getFixerByUsuario = async (usuario: string): Promise<IFixer | null> => {
  try {
    return await Fixer.findOne({ usuario });
  } catch (error: any) {
    console.error("Error en servicio - getFixerByUsuario:", error);
    throw new Error("Error al buscar fixer por usuario");
  }
};