export interface P2PEvent {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  sig?: string;
}

export interface IRelayClient {
  /**
   * Agrega y conecta un nuevo relay al pool.
   */
  addRelay(url: string): Promise<void>;

  /**
   * Desconecta y remueve un relay del pool.
   */
  removeRelay(url: string): void;

  /**
   * Publica un evento en la red (todos los relays conectados).
   */
  publish(event: P2PEvent): Promise<void>;

  /**
   * Se suscribe a eventos en la red basados en filtros.
   * Retorna una función para cancelar la suscripción.
   */
  subscribe(filters: any[], onEvent: (event: P2PEvent) => void): () => void;
}
