import { nip19, finalizeEvent, nip04, getPublicKey } from 'nostr-tools';
import { IRelayClient, P2PEvent } from '../../domain/network/IRelayClient';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';
import crypto from 'react-native-quick-crypto';

export interface ChatMessage {
  id: string;
  senderPubkey: string;
  senderNpub: string;
  senderAlias: string;
  content: string;
  timestamp: number;
  isMe: boolean;
}

export type ConversationType = 'DIRECT' | 'PROVINCE' | 'SUBGROUP' | 'CAUSE';

export interface ConversationItem {
  id: string;
  type: ConversationType;
  title: string;
  subtitle: string;
  avatarIcon: string;
  targetNpub?: string;
  provinceId?: string;
  causeId?: string;
  unreadCount?: number;
  lastMessage?: string;
  lastTimestamp?: number;
  isUnlinked?: boolean;
  level?: number;
}

function toNostrHexId(id: string): string {
  if (/^[0-9a-fA-F]{64}$/.test(id)) {
    return id.toLowerCase();
  }
  return crypto.createHash('sha256').update(id).digest('hex');
}

function safeDecodeNpub(npubOrHex: string): string | null {
  if (!npubOrHex || typeof npubOrHex !== 'string') return null;
  const trimmed = npubOrHex.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (trimmed.startsWith('npub1') && trimmed.length >= 50) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub') {
        return decoded.data as string;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function safeDecodeNsec(nsecOrHex: string): Uint8Array | null {
  if (!nsecOrHex || typeof nsecOrHex !== 'string') return null;
  const trimmed = nsecOrHex.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return new Uint8Array(Buffer.from(trimmed, 'hex'));
  }
  if (trimmed.startsWith('nsec1') && trimmed.length >= 50) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'nsec') {
        return decoded.data as Uint8Array;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function deriveChannelPrivKey(channelId: string): Uint8Array {
  const hash = crypto.createHash('sha256').update(`AMARATIA_CHANNEL_${channelId}`).digest();
  return new Uint8Array(hash);
}

export class MessagingService {
  constructor(private adapter: IRelayClient = new NostrAdapter()) {}

  /**
   * Suscribe a los mensajes directos (1 a 1) entre el usuario actual y otro ciudadano.
   */
  subscribeToDirectChat(
    myNsec: string,
    otherNpub: string,
    onMessage: (msg: ChatMessage) => void
  ): () => void {
    try {
      const myPrivKeyBytes = safeDecodeNsec(myNsec);
      if (!myPrivKeyBytes) {
        console.warn('[MessagingService] myNsec no es válido para suscripción DM');
        return () => {};
      }
      const myHexPubkey = getPublicKey(myPrivKeyBytes);

      const otherHexPubkey = safeDecodeNpub(otherNpub);
      if (!otherHexPubkey) {
        console.warn(`[MessagingService] otherNpub no es válido para suscripción DM: "${otherNpub}"`);
        return () => {};
      }

      // Escuchamos mensajes donde yo soy el receptor y el otro es el emisor, o viceversa
      const filters = [
        {
          kinds: [4],
          authors: [otherHexPubkey],
          '#p': [myHexPubkey],
        } as any,
        {
          kinds: [4],
          authors: [myHexPubkey],
          '#p': [otherHexPubkey],
        } as any,
      ];

      return this.adapter.subscribe(filters, async (event: any) => {
        try {
          const isMe = event.pubkey === myHexPubkey;
          const peerHexPubkey = isMe ? otherHexPubkey : event.pubkey;

          let decryptedText = event.content;
          try {
            decryptedText = await nip04.decrypt(myPrivKeyBytes, peerHexPubkey, event.content);
          } catch (decErr) {
            console.warn('[MessagingService] Error descifrando DM NIP-04:', decErr);
          }

          const senderNpub = nip19.npubEncode(event.pubkey);
          const aliasTag = event.tags.find((t: string[]) => t[0] === 'alias');
          const senderAlias = isMe
            ? 'Yo'
            : (aliasTag && aliasTag[1]) || `Amarata-${senderNpub.substring(5, 9).toUpperCase()}`;

          onMessage({
            id: event.id,
            senderPubkey: event.pubkey,
            senderNpub,
            senderAlias,
            content: decryptedText,
            timestamp: event.created_at * 1000,
            isMe,
          });
        } catch (err) {
          console.error('[MessagingService] Error procesando DM entrante:', err);
        }
      });
    } catch (e) {
      console.error('[MessagingService] Error configurando suscripción DM:', e);
      return () => {};
    }
  }

  /**
   * Suscribe a TODOS los mensajes directos entrantes dirigidos a mi npub.
   * Útil para notificaciones globales en segundo plano e indicadores en el Canvas/Dock.
   */
  subscribeToAllIncomingDirectMessages(
    myNsec: string,
    onIncomingMessage: (msg: ChatMessage) => void
  ): () => void {
    try {
      const myPrivKeyBytes = safeDecodeNsec(myNsec);
      if (!myPrivKeyBytes) {
        console.warn('[MessagingService] myNsec no es válido para suscripción DM global');
        return () => {};
      }
      const myHexPubkey = getPublicKey(myPrivKeyBytes);

      const filters = [
        {
          kinds: [4],
          '#p': [myHexPubkey],
        } as any,
      ];

      return this.adapter.subscribe(filters, async (event: any) => {
        try {
          if (event.pubkey === myHexPubkey) return; // Ignorar mensajes propios

          let decryptedText = event.content;
          try {
            decryptedText = await nip04.decrypt(myPrivKeyBytes, event.pubkey, event.content);
          } catch (decErr) {
            console.warn('[MessagingService] Error descifrando DM global NIP-04:', decErr);
          }

          const senderNpub = nip19.npubEncode(event.pubkey);
          const aliasTag = event.tags.find((t: string[]) => t[0] === 'alias');
          const senderAlias = (aliasTag && aliasTag[1]) || `Amarata-${senderNpub.substring(5, 9).toUpperCase()}`;

          onIncomingMessage({
            id: event.id,
            senderPubkey: event.pubkey,
            senderNpub,
            senderAlias,
            content: decryptedText,
            timestamp: event.created_at * 1000,
            isMe: false,
          });
        } catch (err) {
          console.error('[MessagingService] Error procesando DM global entrante:', err);
        }
      });
    } catch (e) {
      console.error('[MessagingService] Error en subscribeToAllIncomingDirectMessages:', e);
      return () => {};
    }
  }

  /**
   * Envía un mensaje directo cifrado de extremo a extremo (NIP-04 / NIP-44) a otro ciudadano.
   */
  async sendDirectMessage(
    myNsec: string,
    myAlias: string,
    targetNpub: string,
    text: string
  ): Promise<ChatMessage> {
    const myPrivKeyBytes = safeDecodeNsec(myNsec);
    if (!myPrivKeyBytes) throw new Error('Invalid nsec');
    const myHexPubkey = getPublicKey(myPrivKeyBytes);

    const targetHexPubkey = safeDecodeNpub(targetNpub);
    if (!targetHexPubkey) throw new Error(`Invalid target npub: "${targetNpub}"`);

    const encryptedText = await nip04.encrypt(myPrivKeyBytes, targetHexPubkey, text);

    const eventTemplate = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', targetHexPubkey],
        ['alias', myAlias || 'Yo'],
      ],
      content: encryptedText,
    };

    const signedEvent = finalizeEvent(eventTemplate, myPrivKeyBytes);
    await this.adapter.publish(signedEvent as unknown as P2PEvent);

    return {
      id: signedEvent.id,
      senderPubkey: myHexPubkey,
      senderNpub: nip19.npubEncode(myHexPubkey),
      senderAlias: 'Yo',
      content: text,
      timestamp: Date.now(),
      isMe: true,
    };
  }

  /**
   * Suscribe a los mensajes de un canal grupal (Provincia, Subgrupo o Causa).
   */
  subscribeToChannel(
    channelId: string,
    myNsec?: string,
    onMessage?: (msg: ChatMessage) => void
  ): () => void {
    const hexChannelId = toNostrHexId(channelId);
    const channelPrivKey = deriveChannelPrivKey(hexChannelId);

    let myHexPubkey = '';
    if (myNsec) {
      const privBytes = safeDecodeNsec(myNsec);
      if (privBytes) {
        myHexPubkey = getPublicKey(privBytes);
      }
    }

    const filters = [
      {
        kinds: [4],
        '#e': [hexChannelId],
      } as any,
    ];

    return this.adapter.subscribe(filters, async (event: any) => {
      try {
        let content = event.content;
        try {
          content = await nip04.decrypt(channelPrivKey, event.pubkey, event.content);
        } catch {}

        const senderNpub = nip19.npubEncode(event.pubkey);
        const isMe = Boolean(myHexPubkey && event.pubkey === myHexPubkey);
        const aliasTag = event.tags.find((t: string[]) => t[0] === 'alias');
        const senderAlias = isMe
          ? 'Yo'
          : (aliasTag && aliasTag[1]) || `Amarata-${senderNpub.substring(5, 9).toUpperCase()}`;

        if (onMessage) {
          onMessage({
            id: event.id,
            senderPubkey: event.pubkey,
            senderNpub,
            senderAlias,
            content,
            timestamp: event.created_at * 1000,
            isMe,
          });
        }
      } catch (err) {
        console.warn('[MessagingService] Error en mensaje de canal:', err);
      }
    });
  }

  /**
   * Envía un mensaje cifrado a un canal grupal (Provincia, Subgrupo o Causa).
   */
  async sendChannelMessage(
    channelId: string,
    text: string,
    myNsec?: string,
    myAlias?: string
  ): Promise<ChatMessage> {
    const hexChannelId = toNostrHexId(channelId);
    let privKey: Uint8Array;

    const privBytes = myNsec ? safeDecodeNsec(myNsec) : null;
    if (privBytes) {
      privKey = privBytes;
    } else {
      const { generateSecretKey } = await import('nostr-tools');
      privKey = generateSecretKey();
    }

    const channelPrivKey = deriveChannelPrivKey(hexChannelId);
    const channelPubKey = getPublicKey(channelPrivKey);

    const encryptedText = await nip04.encrypt(privKey, channelPubKey, text);

    const eventTemplate = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', hexChannelId],
        ['alias', myAlias || 'Yo'],
      ],
      content: encryptedText,
    };

    const signedEvent = finalizeEvent(eventTemplate, privKey);
    await this.adapter.publish(signedEvent as unknown as P2PEvent);

    const myHexPub = getPublicKey(privKey);

    return {
      id: signedEvent.id,
      senderPubkey: myHexPub,
      senderNpub: nip19.npubEncode(myHexPub),
      senderAlias: 'Yo',
      content: text,
      timestamp: Date.now(),
      isMe: true,
    };
  }
}

export const messagingService = new MessagingService();
