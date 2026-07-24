import * as SecureStore from 'expo-secure-store';
import { IAuthService } from '../../domain/security/IAuthService';
import { ICryptoService, EncryptedData } from '../../domain/security/ICryptoService';

export class AuthService implements IAuthService {
  private static SECURE_KEY = 'amaratia_encrypted_identity';

  constructor(private cryptoService: ICryptoService) {}

  async registerCitizen(nsec: string, realPin: string): Promise<void> {
    const encryptedData = await this.cryptoService.encryptWithPin(nsec, realPin);
    
    // Almacenamos el objeto como string JSON en el SecureStore nativo
    await SecureStore.setItemAsync(AuthService.SECURE_KEY, JSON.stringify(encryptedData));
  }

  async login(pin: string): Promise<{ role: 'CITIZEN' | 'TOURIST'; nsec: string | null }> {
    const dataStr = await SecureStore.getItemAsync(AuthService.SECURE_KEY);
    
    // Si no hay datos, asumimos que no hay cuenta. 
    if (!dataStr) {
      return { role: 'TOURIST', nsec: null };
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(dataStr);
      
      // Intentamos desencriptar el payload con el PIN proporcionado.
      // Si el PIN es incorrecto (PIN señuelo), decryptWithPin devolverá null silenciosamente.
      const nsec = await this.cryptoService.decryptWithPin(encryptedData, pin);

      if (nsec) {
        return { role: 'CITIZEN', nsec };
      } else {
        // Negabilidad Plausible: PIN incorrecto, abrimos modo turista sin alertar.
        return { role: 'TOURIST', nsec: null };
      }
    } catch (e) {
      // Cualquier error de parseo o crypto lo tratamos como entrada a modo turista
      return { role: 'TOURIST', nsec: null };
    }
  }
}
