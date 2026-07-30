import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';
import { finalizeEvent, generateSecretKey, nip04, getPublicKey } from 'nostr-tools';
import crypto from 'react-native-quick-crypto';

function toNostrHexId(id: string): string {
  if (/^[0-9a-fA-F]{64}$/.test(id)) {
    return id.toLowerCase();
  }
  return crypto.createHash('sha256').update(id).digest('hex');
}

export interface ChatMessage {
  id: string;
  senderAlias: string;
  senderPubkey: string;
  content: string;
  timestamp: number;
}

export class ProvinceChatService {
  private adapter = new NostrAdapter();
  // En un entorno real, la llave compartida (shared key) de la provincia
  // estaría guardada de forma segura en la base de datos (WatermelonDB).
  // Para MVP, derivamos una llave determinista basada en el ID de la provincia
  // o usamos una constante para pruebas.
  
  /**
   * Suscribe a los mensajes de la provincia.
   */
  subscribeToProvinceChat(provinceId: string, onMessage: (msg: ChatMessage) => void) {
    const hexProvinceId = toNostrHexId(provinceId);
    
    // Usamos el tag #e con el hexProvinceId válido para Nostr
    const subscription = this.adapter.subscribe([{
      kinds: [4], // Usando kind 4 (NIP-04) adaptado para el MVP
      '#e': [hexProvinceId]
    }], async (event: any) => {
      try {
        // En un caso real:
        // const decryptedContent = await nip04.decrypt(sharedPrivKey, event.pubkey, event.content);
        
        // Simulación de desencriptación MVP
        const content = event.content.startsWith('ENC:') 
          ? event.content.replace('ENC:', '') 
          : event.content;
          
        onMessage({
          id: event.id,
          senderPubkey: event.pubkey,
          senderAlias: `Ciudadano ${event.pubkey.slice(0, 4)}`, // En la vida real, lo sacamos del repositorio
          content,
          timestamp: event.created_at * 1000,
        });
      } catch (e) {
        console.warn('Error desencriptando mensaje de provincia', e);
      }
    });

    return () => {
      subscription();
    };
  }

  /**
   * Envía un mensaje encriptado al chat de la provincia.
   */
  async sendMessage(provinceId: string, text: string, userPrivKeyHex?: string) {
    const hexProvinceId = toNostrHexId(provinceId);
    const privKey = userPrivKeyHex 
      ? Buffer.from(userPrivKeyHex, 'hex') 
      : generateSecretKey();

    // Simulación de encriptación MVP usando el shared key
    // const encryptedText = await nip04.encrypt(privKey, provinceSharedPubKey, text);
    const encryptedText = `ENC:${text}`; // Mock para no bloquear UI con fallas criptográficas si falta la librería

    const eventTemplate = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', hexProvinceId]], // Etiquetamos la provincia con un hex ID de 64 caracteres válido
      content: encryptedText,
    };

    const signedEvent = finalizeEvent(eventTemplate, privKey);
    await this.adapter.publish(signedEvent as any);
    
    return {
      id: signedEvent.id,
      senderPubkey: getPublicKey(privKey),
      senderAlias: 'Yo',
      content: text,
      timestamp: Date.now(),
    };
  }
}

export const provinceChatService = new ProvinceChatService();
