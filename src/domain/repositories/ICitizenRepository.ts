import { GraphTopology } from '../models/GraphTopology';

export interface ICitizenRepository {
  /**
   * Obtiene la red de ciudadanos hidratada, fusionando los datos públicos de la red 
   * con los datos locales (privados) del dispositivo.
   */
  getHydratedCitizens(): Promise<GraphTopology>;

  /**
   * Crea una nueva provincia y establece la relación de membresía inicial.
   */
  createProvince(name: string, description: string): Promise<void>;
}
