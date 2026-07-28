import { Logger } from './Logger';
import { NostrAdapter } from '../network/NostrAdapter';
import { finalizeEvent, generateSecretKey, getPublicKey, nip04 } from 'nostr-tools';

// La llave pública del desarrollador a donde llegarán los logs (dummy dev pubkey para MVP)
const DEVELOPER_PUBKEY = 'a8f7c9e0b1d2...'; // Reemplazar por la real

export class CrashReporter {
  private adapter = new NostrAdapter();

  /**
   * Envía el log local encriptado al desarrollador.
   * Se requiere que la opción "telemetry_enabled" esté activa en los settings del usuario.
   */
  async reportCrash(userPrivateKeyHex?: string): Promise<boolean> {
    try {
      const logs = await Logger.getLogContents();
      
      // Si el log está vacío o no existe, no hacemos nada
      if (!logs || logs.includes('No hay logs')) return false;

      // Usamos la llave del usuario si existe, o generamos una temporal anónima
      const senderPrivKey = userPrivateKeyHex 
        ? Buffer.from(userPrivateKeyHex, 'hex') // Convert to Uint8Array/Buffer for nostr-tools v2
        : generateSecretKey();
      
      // Encriptar el mensaje (NIP-04 DM)
      // Nota: nip04.encrypt espera string en versiones antiguas o Uint8Array en v2. 
      // Si hay error de tipo, en v2 nip04 toma (privkey, pubkey, text).
      const encryptedLog = await nip04.encrypt(senderPrivKey, DEVELOPER_PUBKEY, `CRASH REPORT:\n${logs}`);

      const eventTemplate = {
        kind: 4, // DM
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', DEVELOPER_PUBKEY]],
        content: encryptedLog,
      };

      const signedEvent = finalizeEvent(eventTemplate, senderPrivKey);

      await this.adapter.publish(signedEvent as any);
      
      Logger.log('Crash report enviado exitosamente vía Nostr.');
      return true;
    } catch (e) {
      Logger.error('Falló el envío del crash report', e);
      return false;
    }
  }
}

export const crashReporter = new CrashReporter();
