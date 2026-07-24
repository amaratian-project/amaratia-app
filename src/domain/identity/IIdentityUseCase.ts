export interface KeyPair {
  nsec: string;
  npub: string;
}

export interface IIdentityUseCase {
  /**
   * Genera una frase mnemónica BIP39 de 12 palabras.
   */
  generateMnemonic(): string;

  /**
   * Deriva las llaves Nsec y Npub a partir de la frase mnemónica.
   */
  deriveKeysFromMnemonic(mnemonic: string): KeyPair;
}
