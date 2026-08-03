import { nip19, finalizeEvent, verifyEvent } from 'nostr-tools';
import { IRelayClient, P2PEvent } from '../../domain/network/IRelayClient';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';

export interface CivicEventHandlers {
  onVisaGranted: (sponsorNpub: string, sponsorAlias: string, targetNpub: string) => Promise<void>;
  onVisaRevoked: (revokerNpub: string, revokerAlias: string, targetNpub: string) => Promise<void>;
}

export class VisaSyncService {
  constructor(private relayClient: IRelayClient = new NostrAdapter()) {}

  /**
   * Publica un evento criptográfico de Otorgamiento de Visa (Kind 21001) a los Relays de Nostr.
   */
  async publishVisa(
    issuerNsec: string,
    issuerAlias: string,
    targetNpub: string
  ): Promise<void> {
    try {
      const decodedNsec = nip19.decode(issuerNsec);
      if (decodedNsec.type !== 'nsec') throw new Error('Llave nsec inválida');
      const privateKeyBytes = decodedNsec.data as Uint8Array;

      const decodedTarget = nip19.decode(targetNpub);
      if (decodedTarget.type !== 'npub') throw new Error('Llave npub del destinatario inválida');
      const targetHexPubkey = decodedTarget.data as string;

      const now = Math.floor(Date.now() / 1000);
      const eventTemplate = {
        kind: 21001,
        created_at: now,
        tags: [
          ['p', targetHexPubkey],
          ['action', 'GRANT_VISA'],
          ['t', 'amaratia-visa'],
          ['alias', issuerAlias],
        ],
        content: JSON.stringify({
          action: 'GRANT_VISA',
          issuerAlias,
          timestamp: Date.now(),
        }),
      };

      const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);
      await this.relayClient.publish(signedEvent as unknown as P2PEvent);
      console.log(`[VisaSyncService] Visa otorgada publicada en Relays para ${targetNpub}`);
    } catch (error) {
      console.error('[VisaSyncService] Error publicando visa en Nostr:', error);
      throw error;
    }
  }

  /**
   * Publica un evento criptográfico de Revocación de Visa (Kind 21002) a los Relays de Nostr.
   */
  async publishRevokeVisa(
    issuerNsec: string,
    issuerAlias: string,
    targetNpub: string
  ): Promise<void> {
    try {
      const decodedNsec = nip19.decode(issuerNsec);
      if (decodedNsec.type !== 'nsec') throw new Error('Llave nsec inválida');
      const privateKeyBytes = decodedNsec.data as Uint8Array;

      const decodedTarget = nip19.decode(targetNpub);
      if (decodedTarget.type !== 'npub') throw new Error('Llave npub del destinatario inválida');
      const targetHexPubkey = decodedTarget.data as string;

      const now = Math.floor(Date.now() / 1000);
      const eventTemplate = {
        kind: 21002,
        created_at: now,
        tags: [
          ['p', targetHexPubkey],
          ['action', 'REVOKE_VISA'],
          ['t', 'amaratia-visa-revocation'],
          ['alias', issuerAlias],
        ],
        content: JSON.stringify({
          action: 'REVOKE_VISA',
          issuerAlias,
          timestamp: Date.now(),
        }),
      };

      const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);
      await this.relayClient.publish(signedEvent as unknown as P2PEvent);
      console.log(`[VisaSyncService] Revocación de Visa publicada en Relays para ${targetNpub}`);
    } catch (error) {
      console.error('[VisaSyncService] Error publicando revocación de visa en Nostr:', error);
      throw error;
    }
  }

  /**
   * Se suscribe a los Relays de Nostr para escuchar eventos cívicos de la red.
   */
  subscribeToCivicEvents(
    myNpub: string,
    handlers: CivicEventHandlers
  ): () => void {
    try {
      const filters = [
        {
          kinds: [21001, 21002],
        } as any,
      ];

      return this.relayClient.subscribe(filters, async (event: P2PEvent) => {
        try {
          const isValid = verifyEvent(event as any);
          if (!isValid) {
            console.warn('[VisaSyncService] Evento cívico con firma inválida descartado');
            return;
          }

          const senderNpub = nip19.npubEncode(event.pubkey);
          let senderAlias = `Amarata-${senderNpub.substring(5, 9).toUpperCase()}`;
          const aliasTag = event.tags.find((t: string[]) => t[0] === 'alias');
          if (aliasTag && aliasTag[1]) {
            senderAlias = aliasTag[1];
          } else {
            try {
              const content = JSON.parse(event.content);
              if (content.issuerAlias) senderAlias = content.issuerAlias;
            } catch {}
          }

          const pTag = event.tags.find((t: string[]) => t[0] === 'p');
          let targetNpub = '';
          if (pTag && pTag[1]) {
            try {
              targetNpub = nip19.npubEncode(pTag[1]);
            } catch {}
          }

          if (event.kind === 21001) {
            console.log(`[VisaSyncService] Evento Visa: ${senderAlias} (${senderNpub}) -> ${targetNpub}`);
            await handlers.onVisaGranted(senderNpub, senderAlias, targetNpub);
          } else if (event.kind === 21002) {
            console.log(`[VisaSyncService] Evento Revocación: ${senderAlias} (${senderNpub}) -> ${targetNpub}`);
            await handlers.onVisaRevoked(senderNpub, senderAlias, targetNpub);
          }
        } catch (err) {
          console.error('[VisaSyncService] Error procesando evento cívico entrante:', err);
        }
      });
    } catch (e) {
      console.error('[VisaSyncService] Error al suscribirse a eventos cívicos:', e);
      return () => {};
    }
  }

  // Compatibilidad hacia atrás
  subscribeToIncomingVisas(
    myNpub: string,
    onVisaReceived: (sponsorNpub: string, sponsorAlias: string, targetNpub: string) => Promise<void>
  ): () => void {
    return this.subscribeToCivicEvents(myNpub, {
      onVisaGranted: onVisaReceived,
      onVisaRevoked: async () => {},
    });
  }
}
