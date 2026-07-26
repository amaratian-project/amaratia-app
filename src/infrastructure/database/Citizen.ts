import { Model, Query } from '@nozbe/watermelondb';
import { field, text, date, children } from '@nozbe/watermelondb/decorators';


/**
 * Modelo que representa un ciudadano o usuario en el "Estado Red" de Amaratia.
 * Dependiendo de su nivel de acceso (Dual PIN), un usuario puede tener el rol
 * de 'TOURIST' (espectador, interfaz vacía/inofensiva) o 'CITIZEN' (acceso completo).
 * 
 * @module
 */
export default class Citizen extends Model {
  static table = 'citizens';

  static associations = {
    trust_links: { type: 'has_many', foreignKey: 'from_citizen_id' },
    tickets: { type: 'has_many', foreignKey: 'creator_id' },
  } as const;

  /**
   * Llave pública de Nostr (Npub) que identifica unívocamente al ciudadano en la red.
   */
  @text('npub') npub: string;
  @text('role') role: string; 
  @text('alias') alias?: string; // Autogenerado público
  @text('local_name') localName?: string; // Privado del usuario
  @field('merit') merit: number;
  @date('created_at') createdAt: Date;
  @children('trust_links') trustLinks: Query<any>;
  @children('tickets') tickets: Query<any>;
}
