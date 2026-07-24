export interface EncryptedData {
  ciphertext: string; // Base64
  iv: string; // Base64
  salt: string; // Base64
}

export interface ICryptoService {
  /**
   * Encripta un texto usando AES-GCM, derivando la llave maestra a partir del PIN
   */
  encryptWithPin(plainText: string, pin: string): Promise<EncryptedData>;

  /**
   * Desencripta un payload cifrado. Retorna null o lanza error si el PIN es incorrecto
   * (Plausible Deniability)
   */
  decryptWithPin(encryptedData: EncryptedData, pin: string): Promise<string | null>;
}
