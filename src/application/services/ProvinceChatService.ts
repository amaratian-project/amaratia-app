import { IRelayClient } from '../../domain/network/IRelayClient';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';
import { finalizeEvent, generateSecretKey, nip04, getPublicKey } from 'nostr-tools';
import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';

function toNostrHexId(id: string): string {
  if (/^[0-9a-fA-F]{64}$/.test(id)) {
    return id.toLowerCase();
  }
  return crypto.createHash('sha256').update(id).digest('hex');
}

function deriveProvincePrivKey(provinceIdHex: string): Uint8Array {
  const hash = crypto.createHash('sha256').update(`AMARATIA_PROVINCE_${provinceIdHex}`).digest();
  return new Uint8Array(hash);
}

export interface ChatMessage {
  id: string;
  senderAlias: string;
  senderPubkey: string;
  content: string;
  timestamp: number;
}

export class ProvinceChatService {
  constructor(private adapter: IRelayClient = new NostrAdapter()) {}
  
  /**
   * Suscribe a los mensajes de la provincia.
   */
  subscribeToProvinceChat(provinceId: string, onMessage: (msg: ChatMessage) => void) {
    const hexProvinceId = toNostrHexId(provinceId);
    const provincePrivKey = deriveProvincePrivKey(hexProvinceId);
    
    // Usamos el tag #e con el hexProvinceId válido para Nostr
    const subscription = this.adapter.subscribe([{
      kinds: [4], // NIP-04 encrypted direct messages
      '#e': [hexProvinceId]
    }], async (event: any) => {
      try {
        let content = event.content;
        try {
          content = await nip04.decrypt(provincePrivKey, event.pubkey, event.content);
        } catch {
          // Si el mensaje es plano (legacy), mostramos el contenido original
        }
          
        onMessage({
          id: event.id,
          senderPubkey: event.pubkey,
          senderAlias: `Ciudadano ${event.pubkey.slice(0, 4)}`,
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
      ? new Uint8Array(Buffer.from(userPrivKeyHex, 'hex'))
      : generateSecretKey();

    const provincePrivKey = deriveProvincePrivKey(hexProvinceId);
    const provincePubKey = getPublicKey(provincePrivKey);

    // Cifrado NIP-04 real
    const encryptedText = await nip04.encrypt(privKey, provincePubKey, text);

    const eventTemplate = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', hexProvinceId]],
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
