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
   * Conecta a un relay o red específica.
   */
  connect(url: string): Promise<void>;

  /**
   * Desconecta del relay.
   */
  disconnect(url: string): void;

  /**
   * Publica un evento en la red.
   */
  publish(url: string, event: P2PEvent): Promise<void>;

  /**
   * Se suscribe a eventos en la red basados en filtros.
   * Retorna una función para cancelar la suscripción.
   */
  subscribe(url: string, filters: any[], onEvent: (event: P2PEvent) => void): () => void;
}
