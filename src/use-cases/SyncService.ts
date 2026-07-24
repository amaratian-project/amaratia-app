import { IRelayClient, P2PEvent } from '../domain/network/IRelayClient';
import { Database } from '@nozbe/watermelondb';

export class SyncService {
  constructor(
    private relayClient: IRelayClient,
    private database: Database
  ) {}

  /**
   * Se suscribe a la red P2P (Nostr) y guarda los tickets en WatermelonDB
   */
  startSyncingTickets(relayUrl: string, pubkeysOfInterest: string[]) {
    // Ejemplo: Kind 30000 para tickets de estado red
    const filters = [{
      kinds: [30000], 
      authors: pubkeysOfInterest,
      limit: 50
    }];

    return this.relayClient.subscribe(relayUrl, filters, async (event: P2PEvent) => {
      try {
        await this.database.write(async () => {
          const ticketsCollection = this.database.get('tickets');
          // Parseamos el content del evento P2P a nuestro modelo local
          const contentObj = JSON.parse(event.content);
          
          await ticketsCollection.create((ticket: any) => {
            ticket.title = contentObj.title || 'Untitled';
            ticket.status = contentObj.status || 'TODO';
            ticket.creator_id = event.pubkey; // Guardamos el autor
            // Nostr events created_at is in seconds
            ticket.createdAt = new Date(event.created_at * 1000);
          });
        });
      } catch (e) {
        console.error('Error syncing ticket from P2P network', e);
      }
    });
  }
}
