export interface IAuthService {
  /**
   * Registra un nuevo ciudadano cifrando su Nsec con el PIN real provisto.
   * Almacena el Nsec cifrado localmente (Secure Store).
   */
  registerCitizen(nsec: string, realPin: string): Promise<void>;

  /**
   * Intenta autenticar.
   * Si el PIN desencripta exitosamente el Nsec guardado, retorna { role: 'CITIZEN', nsec: '...' }.
   * Si el PIN falla (Ej. PIN señuelo), asume el modo turista y retorna { role: 'TOURIST', nsec: null }.
   */
  login(pin: string): Promise<{ role: 'CITIZEN' | 'TOURIST'; nsec: string | null }>;
}
