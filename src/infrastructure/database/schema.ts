import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'citizens',
      columns: [
        { name: 'npub', type: 'string', isIndexed: true },
        { name: 'role', type: 'string' }, // TOURIST, CITIZEN, etc.
        { name: 'alias', type: 'string', isOptional: true },
        { name: 'merit', type: 'number' },
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'trust_links',
      columns: [
        { name: 'from_citizen_id', type: 'string', isIndexed: true },
        { name: 'to_citizen_id', type: 'string', isIndexed: true },
        { name: 'level', type: 'number' }, // Nivel de grado en el Web of Trust
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'tickets',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'status', type: 'string' }, // TODO, IN_PROGRESS, DONE
        { name: 'creator_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ]
    })
  ]
});
