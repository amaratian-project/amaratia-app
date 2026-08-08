import { IRelayClient, P2PEvent } from '../../domain/network/IRelayClient';
import { SimplePool, Filter } from 'nostr-tools';

export class NostrAdapter implements IRelayClient {
  private pool: SimplePool;
  private activeRelays: Set<string> = new Set();
  
  // Relays semilla por defecto
  private readonly SEED_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net'
  ];

  constructor() {
    this.pool = new SimplePool();
    // Inicializar con relays semilla
    this.SEED_RELAYS.forEach(url => this.addRelay(url));
  }

  async addRelay(url: string): Promise<void> {
    if (this.activeRelays.has(url)) return;

    try {
      // SimplePool administra las conexiones internamente cuando suscribimos o publicamos.
      // Solo necesitamos agregarlo a nuestra lista activa.
      this.activeRelays.add(url);
      console.log(`Added Nostr Relay to pool: ${url}`);
    } catch (e) {
      console.error(`Failed to add Relay to pool: ${url}`, e);
      throw e;
    }
  }

  removeRelay(url: string): void {
    if (this.activeRelays.has(url)) {
      this.activeRelays.delete(url);
      console.log(`Removed Nostr Relay from pool: ${url}`);
    }
  }

  /**
   * Obtiene la lista de relays configurados por el usuario mediante NIP-65.
   * Por ahora es un stub que se implementará para consultar el evento kind 10002.
   * Una vez obtenidos, se inyectarán al pool usando addRelay().
   */
  async fetchNIP65Relays(pubkey: string): Promise<void> {
    console.log(`Fetching NIP-65 relays for pubkey ${pubkey}... (Stub)`);
    // TODO: Usar this.pool.get() para buscar el kind 10002 del usuario 
    // y luego actualizar this.activeRelays con sus preferencias.
  }

  async publish(event: P2PEvent): Promise<void> {
    if (this.activeRelays.size === 0) throw new Error('No relays connected in pool');
    
    const relaysArray = Array.from(this.activeRelays);
    const pubs = this.pool.publish(relaysArray, event as any);
    
    try {
      // Esperamos a que al menos un relay publique con éxito
      await Promise.any(pubs);
      console.log(`Publish OK to at least one relay`);
    } catch (e) {
      console.error(`Publish failed on all relays`, e);
      throw new Error('Failed to publish to any relay');
    }
  }

  subscribe(filters: Filter[], onEvent: (event: P2PEvent) => void): () => void {
    if (this.activeRelays.size === 0) throw new Error('No relays connected in pool');

    const relaysArray = Array.from(this.activeRelays);
    const seenEventIds = new Set<string>();
    
    // nostr-tools v2 subscribeMany toma un solo filtro por llamada, iteramos:
    const subs = filters.map(filter => 
      this.pool.subscribeMany(relaysArray, filter, {
        onevent(event: any) {
          if (event?.id) {
            if (seenEventIds.has(event.id)) return;
            seenEventIds.add(event.id);
          }
          onEvent(event as unknown as P2PEvent);
        },
        oneose() {
          // End of stored events
        }
      })
    );

    return () => {
      subs.forEach(sub => sub.close());
    };
  }
}
