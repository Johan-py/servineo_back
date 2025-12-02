import crypto from "crypto";

/**
 * Servicio para encriptar/desencriptar datos sensibles como refresh tokens
 */
export class EncryptionService {
  private static key = process.env.ENCRYPTION_KEY || "default_key_should_be_32_chars_minimum_length";

  /**
   * Genera una clave de 32 bytes a partir del string en .env
   */
  private static getKey(): Buffer {
    const keyStr = this.key.padEnd(32, "0").slice(0, 32);
    return Buffer.from(keyStr);
  }

  /**
   * Encripta un string usando AES-256-GCM
   */
  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", this.getKey(), iv);
      
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      
      const authTag = cipher.getAuthTag();
      
      // Retorna: iv + authTag + encrypted
      return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
    } catch (e) {
      console.error("Encryption error:", e);
      return text;
    }
  }

  /**
   * Desencripta un string encriptado con encrypt()
   */
  static decrypt(encrypted: string): string {
    try {
      const parts = encrypted.split(":");
      if (parts.length !== 3) return encrypted;
      
      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encryptedText = parts[2];
      
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.getKey(), iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedText, "hex", "utf8");
      decrypted += decipher.final("utf8");
      
      return decrypted;
    } catch (e) {
      console.error("Decryption error:", e);
      return encrypted;
    }
  }
}
