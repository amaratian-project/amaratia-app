import { IIdentityUseCase, KeyPair } from '../domain/identity/IIdentityUseCase';
import { nip19, getPublicKey } from 'nostr-tools';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
// @ts-ignore: module resolution for wordlist
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

export class IdentityUseCase implements IIdentityUseCase {
  generateMnemonic(): string {
    return generateMnemonic(wordlist);
  }

  deriveKeysFromMnemonic(mnemonic: string): KeyPair {
    // Generar la semilla a partir de las 12 palabras
    const seed = mnemonicToSeedSync(mnemonic);
    
    // NIP-06 define la ruta de derivación HD como m/44'/1237'/0'/0/0
    const hdkey = HDKey.fromMasterSeed(seed);
    const derived = hdkey.derive("m/44'/1237'/0'/0/0");
    
    if (!derived.privateKey) {
      throw new Error('Failed to derive private key');
    }
    
    const privateKeyBytes = derived.privateKey;
    const publicKeyBytes = getPublicKey(privateKeyBytes);
    
    // Codificación NIP-19 para uso de usuario (nsec/npub)
    const nsec = nip19.nsecEncode(privateKeyBytes);
    const npub = nip19.npubEncode(publicKeyBytes);

    return {
      nsec,
      npub
    };
  }
}
