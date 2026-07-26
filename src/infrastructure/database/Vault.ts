import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

/**
 * Representa la bóveda criptográfica segura.
 * Solo debe existir 1 registro de Bóveda por dispositivo, asociado al único ciudadano.
 */
export default class Vault extends Model {
  static table = 'vaults';

  /**
   * Datos cifrados con AES-GCM (Ciphertext + AuthTag).
   */
  @field('encrypted_data') encryptedData: string;

  /**
   * Fecha de creación de la bóveda.
   */
  @readonly @date('created_at') createdAt: Date;
}
