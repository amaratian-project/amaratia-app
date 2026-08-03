import { GraphTopology } from '../models/GraphTopology';
import { CivicProfile } from '../models/Title';

export interface ICitizenRepository {
  /**
   * Obtiene la red de ciudadanos hidratada, fusionando los datos públicos de la red 
   * con los datos locales (privados) del dispositivo.
   */
  getHydratedCitizens(currentNpub?: string): Promise<GraphTopology>;

  /**
   * Crea una nueva provincia y establece la relación de membresía inicial.
   */
  createProvince(name: string, description: string, currentNpub?: string): Promise<void>;

  /**
   * Acredita a un nuevo ciudadano en la Red de Confianza local (Nivel 1) otorgándole una Visa.
   */
  addCitizenToLevel1(npub: string, alias?: string, currentNpub?: string): Promise<void>;

  /**
   * Revoca la Visa otorgada a un ciudadano, destruyendo el enlace directo de Nivel 1.
   * Retorna el npub del ciudadano revocado para emitir el evento P2P.
   */
  revokeVisa(targetCitizenIdOrNpub: string, currentNpub?: string): Promise<string | null>;

  /**
   * Obtiene las estadísticas de conteo de nodos por nivel de confianza (1º, 2º y 3er grado).
   */
  getNetworkStats(currentNpub?: string): Promise<{ level1: number; level2: number; level3: number }>;

  /**
   * Obtiene los nombres de las provincias a las que pertenece el usuario actual.
   */
  getMyProvinces(currentNpub?: string): Promise<string[]>;

  /**
   * Obtiene el perfil cívico completo del usuario con sus títulos evaluados dinámicamente.
   */
  getMyCivicProfile(currentNpub?: string): Promise<CivicProfile>;

  /**
   * Procesa la recepción de una Visa de un Padrino, creando el enlace de confianza y activando la ciudadanía.
   */
  receiveVisaFrom(sponsorNpub: string, sponsorAlias?: string, currentNpub?: string): Promise<boolean>;

  /**
   * Procesa la revocación de una Visa entrante, eliminando el enlace mutuo y recalculando el estado cívico.
   */
  processVisaRevocation(sponsorNpub: string, currentNpub?: string): Promise<{ success: boolean; newRole: string; remainingVisas: number }>;

  /**
   * Procesa un evento de Visa emitido en la red para descubrir y conectar nodos de 2º y 3er grado.
   */
  processNetworkVisa(sponsorNpub: string, sponsorAlias: string, targetNpub: string, currentNpub?: string): Promise<boolean>;

  /**
   * Procesa una revocación de Visa ocurrida en la red de 2º o 3er grado.
   */
  processNetworkRevocation(sponsorNpub: string, targetNpub: string, currentNpub?: string): Promise<boolean>;
}
