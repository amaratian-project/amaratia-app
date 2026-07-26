import { IRelayClient, P2PEvent } from '../../domain/network/IRelayClient';
import { Relay } from 'nostr-tools';

export class NostrAdapter implements IRelayClient {
  private relays: Map<string, Relay> = new Map();

  async connect(url: string): Promise<void> {
    if (this.relays.has(url)) return;

    try {
      const relay = await Relay.connect(url);
      this.relays.set(url, relay);
      console.log(`Connected to Nostr Relay: ${url}`);
    } catch (e) {
      console.error(`Failed to connect to Relay: ${url}`, e);
      throw e;
    }
  }

  disconnect(url: string): void {
    const relay = this.relays.get(url);
    if (relay) {
      relay.close();
      this.relays.delete(url);
      console.log(`Disconnected from Nostr Relay: ${url}`);
    }
  }

  async publish(url: string, event: P2PEvent): Promise<void> {
    const relay = this.relays.get(url);
    if (!relay) throw new Error('Relay not connected');
    
    // Nostr-tools v2 publish is async and throws on failure
    await relay.publish(event as any);
  }

  subscribe(url: string, filters: import('nostr-tools').Filter[], onEvent: (event: P2PEvent) => void): () => void {
    const relay = this.relays.get(url);
    if (!relay) throw new Error('Relay not connected');

    const sub = relay.subscribe(filters, {
      onevent(event) {
        onEvent(event as unknown as P2PEvent);
      },
      oneose() {
        // End of stored events
      }
    });

    return () => {
      sub.close();
    };
  }
}
