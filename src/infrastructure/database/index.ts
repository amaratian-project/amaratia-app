import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';
import Citizen from './Citizen';
import TrustLink from './TrustLink';
import Ticket from './Ticket';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  // (Opcional) migraciones, etc.
  jsi: true, /* JSI es mucho más rápido, compatible en expo 50+ con C++*/
  onSetUpError: error => {
    // Manejo de errores para base de datos fallida
    console.error("WatermelonDB setup error:", error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Citizen,
    TrustLink,
    Ticket,
  ],
});
