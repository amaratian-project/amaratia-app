import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { ICryptoService, EncryptedData } from '../../domain/security/ICryptoService';

export class QuickCryptoService implements ICryptoService {
  // Aumentado a 600,000 iteraciones según recomendaciones de seguridad OWASP (PBKDF2-HMAC-SHA256)
  private readonly ITERATIONS = 600000;
  private readonly KEY_LENGTH = 32; // 256 bits

  /**
   * Deriva una llave fuerte usando PBKDF2
   */
  private deriveKey(pin: string, salt: any): any {
    return crypto.pbkdf2Sync(pin, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha256');
  }

  async encryptWithPin(plainText: string, pin: string): Promise<EncryptedData> {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // GCM recomienda 12 bytes
    const key = this.deriveKey(pin, salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', key as any, iv as any);
    
    let ciphertext = cipher.update(plainText, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    const authTag = cipher.getAuthTag().toString('base64');
    
    // Concatenamos ciphertext y authTag para guardarlo simple (GCM requiere el tag)
    const combinedCiphertext = `${ciphertext}:${authTag}`;

    return {
      ciphertext: combinedCiphertext,
      iv: iv.toString('base64'),
      salt: salt.toString('base64')
    };
  }

  async decryptWithPin(encryptedData: EncryptedData, pin: string): Promise<string | null> {
    try {
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const key = this.deriveKey(pin, salt);

      const [ciphertextStr, authTagStr] = encryptedData.ciphertext.split(':');
      if (!ciphertextStr || !authTagStr) return null;

      const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, iv as any);
      decipher.setAuthTag(Buffer.from(authTagStr, 'base64') as any);

      let plainText = decipher.update(ciphertextStr, 'base64', 'utf8');
      plainText += decipher.final('utf8');

      return plainText;
    } catch (error) {
      // Si el PIN es incorrecto (Ej. PIN señuelo), fallará la desencriptación GCM por auth tag inválido
      return null;
    }
  }
}
