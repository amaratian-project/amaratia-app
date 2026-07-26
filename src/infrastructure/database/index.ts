import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';

// Importación de modelos
import Citizen from './Citizen';
import TrustLink from './TrustLink';
import Ticket from './Ticket';
import Vault from './Vault';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  // (Opcional) Puedes configurar dbName para SQLite, por defecto es 'watermelon'
  // dbName: 'amaratia_db', 
  jsi: true, /* Habilitar puente síncrono ultra-rápido en React Native */
  onSetUpError: error => {
    console.error('[WatermelonDB] Fallo en configuración:', error);
  }
});

// Instancia global exportada
export const database = new Database({
  adapter,
  modelClasses: [
    Vault,
    Citizen,
    TrustLink,
    Ticket
  ],
});
