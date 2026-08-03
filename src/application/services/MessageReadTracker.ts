import * as SecureStore from 'expo-secure-store';

/**
 * Rastrea las marcas de lectura y el historial de conversaciones usando SecureStore.
 *
 * Principio de Responsabilidad Única (SRP):
 * Esta clase SOLO gestiona timestamps de última lectura e historial de chats por (usuario, conversación).
 * No gestiona contadores ni estado de UI.
 *
 * Flujo de datos:
 * 1. `initialize(npub)` carga la caché desde SecureStore al arrancar.
 * 2. `isUnread(npub, chatId, timestamp)` consulta la caché (síncrono, O(1)).
 * 3. `markAsRead(npub, chatId)` actualiza caché + persiste en SecureStore.
 * 4. `recordChat(npub, chatId)` asegura que la conversación quede registrada en el historial.
 * 5. `getKnownChats(npub)` recupera todos los contactos con los que ha habido interacción.
 * 6. `markAllAsRead(npub)` establece la marca global de lectura para anular mensajes históricos.
 */
export class MessageReadTracker {
  private static readonly STORAGE_KEY_PREFIX = 'amaratia_chat_last_read_';
  private static cache: Record<string, Record<string, number>> = {};
  private static initializedUsers = new Set<string>();

  private static cleanKey(chatId: string): string {
    return chatId.replace(/^dm_/, '').replace(/^prov_/, '').replace(/^cause_/, '');
  }

  /**
   * Inicializa la memoria caché con los timestamps de última lectura persistidos en SecureStore.
   * Idempotente: llamar múltiples veces con el mismo npub es seguro.
   */
  static async initialize(myNpub: string): Promise<void> {
    if (this.initializedUsers.has(myNpub) && this.cache[myNpub]) return;
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      const data = await SecureStore.getItemAsync(key);
      if (data) {
        this.cache[myNpub] = JSON.parse(data);
      } else {
        this.cache[myNpub] = {};
      }
      this.initializedUsers.add(myNpub);
    } catch (e) {
      console.warn('[MessageReadTracker] Error inicializando marcas de lectura:', e);
      this.cache[myNpub] = {};
      this.initializedUsers.add(myNpub);
    }
  }

  /**
   * Obtiene el timestamp (ms) de la última vez que se leyó una conversación o globalmente.
   * Retorna el mayor entre la conversación específica, su clave limpia y la marca global.
   */
  static getLastRead(myNpub: string, chatId: string): number {
    const userCache = this.cache[myNpub];
    if (!userCache) return 0;
    const clean = this.cleanKey(chatId);
    const globalRead = userCache['_global_read'] || 0;
    const specificRead = Math.max(userCache[clean] || 0, userCache[chatId] || 0);
    return Math.max(specificRead, globalRead);
  }

  /**
   * Registra una conversación en el historial persistente del usuario sin modificar su timestamp si ya existe.
   * Valida que sea un npub válido para evitar guardar identificadores corruptos o dummy.
   */
  static async recordChat(myNpub: string, chatId: string): Promise<void> {
    if (!chatId || typeof chatId !== 'string') return;
    const clean = this.cleanKey(chatId);
    if (!clean.startsWith('npub1') || clean.length < 50) return;

    if (!this.cache[myNpub]) {
      this.cache[myNpub] = {};
    }
    if (!this.cache[myNpub][clean] && !this.cache[myNpub][chatId]) {
      this.cache[myNpub][clean] = 0;
      this.cache[myNpub][chatId] = 0;
      try {
        const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
        await SecureStore.setItemAsync(key, JSON.stringify(this.cache[myNpub]));
      } catch (e) {
        console.warn('[MessageReadTracker] Error guardando registro de chat:', e);
      }
    }
  }

  /**
   * Obtiene la lista de todos los chatIds/npubs conocidos con los que el usuario ha interactuado.
   * Filtra claves huérfanas o no válidas.
   */
  static getKnownChats(myNpub: string): string[] {
    const userCache = this.cache[myNpub];
    if (!userCache) return [];
    const keys = new Set<string>();
    Object.keys(userCache).forEach((k) => {
      if (k !== '_global_read' && !k.startsWith('prov_') && !k.startsWith('cause_')) {
        const clean = this.cleanKey(k);
        if (clean.startsWith('npub1') && clean.length >= 50) {
          keys.add(clean);
        }
      }
    });
    return Array.from(keys);
  }

  /**
   * Marca una conversación específica como leída hasta el timestamp dado.
   * Persiste tanto con el chatId original como con la versión sin prefijo
   * para garantizar que lookups con cualquier formato coincidan.
   */
  static async markAsRead(myNpub: string, chatId: string, timestamp: number = Date.now()): Promise<void> {
    if (!this.cache[myNpub]) {
      this.cache[myNpub] = {};
    }
    const clean = this.cleanKey(chatId);

    const currentClean = this.cache[myNpub][clean] || 0;
    const currentChat = this.cache[myNpub][chatId] || 0;

    if (timestamp > currentClean) {
      this.cache[myNpub][clean] = timestamp;
    }
    if (timestamp > currentChat) {
      this.cache[myNpub][chatId] = timestamp;
    }

    try {
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      await SecureStore.setItemAsync(key, JSON.stringify(this.cache[myNpub]));
    } catch (e) {
      console.warn('[MessageReadTracker] Error guardando marca de lectura:', e);
    }
  }

  /**
   * Marca globalmente todas las conversaciones como leídas hasta el momento actual.
   * Invalida cualquier mensaje histórico previo a este timestamp para todos los remitentes.
   */
  static async markAllAsRead(myNpub: string, timestamp: number = Date.now()): Promise<void> {
    if (!this.cache[myNpub]) {
      this.cache[myNpub] = {};
    }
    const currentGlobal = this.cache[myNpub]['_global_read'] || 0;
    if (timestamp > currentGlobal) {
      this.cache[myNpub]['_global_read'] = timestamp;
    }

    try {
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      await SecureStore.setItemAsync(key, JSON.stringify(this.cache[myNpub]));
    } catch (e) {
      console.warn('[MessageReadTracker] Error guardando marca global de lectura:', e);
    }
  }

  /**
   * Evalúa si un mensaje es no leído con respecto a la última marca de lectura.
   * Puro y síncrono — no modifica estado.
   */
  static isUnread(myNpub: string, chatId: string, messageTimestamp: number): boolean {
    const lastRead = this.getLastRead(myNpub, chatId);
    return messageTimestamp > lastRead;
  }

  /**
   * Limpia todas las marcas de lectura (útil para pruebas o reinicio de sesión).
   */
  static async clearAll(myNpub: string): Promise<void> {
    delete this.cache[myNpub];
    this.initializedUsers.delete(myNpub);
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('[MessageReadTracker] Error limpiando marcas de lectura:', e);
    }
  }
}
