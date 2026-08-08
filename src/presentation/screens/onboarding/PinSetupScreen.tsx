import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { QuickCryptoService } from '../../../infrastructure/security/QuickCryptoService';
import { database } from '../../../infrastructure/database';
import { useAuth } from '../../../application/context/AuthContext';
import { NostrAdapter } from '../../../infrastructure/network/NostrAdapter';
import { finalizeEvent } from 'nostr-tools';
import { ScreenContainer } from '../../components/ScreenContainer';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PinSetup'>;
  route: RouteProp<RootStackParamList, 'PinSetup'>;
};

export const PinSetupScreen = ({ navigation, route }: Props) => {
  const { identity } = route.params;
  const [pin, setPin] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const { login } = useAuth();

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleConfirm = async () => {
    if (pin.length !== 6) return;
    
    setIsEncrypting(true);
    // Pausa ligera para permitir que React renderice el estado de "Cifrando..."
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      const cryptoService = new QuickCryptoService();
      
      // Empaquetamos la identidad (llave privada Nostr) como string JSON
      const payload = JSON.stringify(identity);
      
      // Ciframos usando el PIN del usuario (AES-GCM + PBKDF2)
      const encryptedData = await cryptoService.encryptWithPin(payload, pin);
      
      // Generamos el Alias del ciudadano (Amarata-XXXX)
      const aliasSuffix = identity.npub.substring(5, 9).toUpperCase();
      const alias = `Amarata-${aliasSuffix}`;

      // Inyectamos la identidad al estado global
      login({ ...identity, alias });

      // Guardamos la identidad cifrada en la Bóveda oficial (Vault)
      await database.write(async () => {
        const vaultsCollection = database.collections.get('vaults');
        await vaultsCollection.create((vault: any) => {
          vault.encryptedData = JSON.stringify(encryptedData);
        });


      // Registro del ciudadano: Inicia como Turista a menos que sea la llave Génesis
      const { GENESIS_ARCHITECT_NPUB } = await import('../../../domain/models/Title');
      const isGenesis = Boolean(GENESIS_ARCHITECT_NPUB && identity.npub === GENESIS_ARCHITECT_NPUB);

      const citizensCollection = database.collections.get('citizens');
      await citizensCollection.create((citizen: any) => {
        citizen.npub = identity.npub;
        citizen.role = isGenesis ? 'CITIZEN' : 'TOURIST';
        citizen.merit = 0;
        citizen.alias = alias;
      });
    });

      // ¡El Grito de Nacimiento (Kind 0) en la red Nostr!
      try {
        const adapter = new NostrAdapter();
        const profileContent = JSON.stringify({
          name: alias,
          about: "Ciudadano Libre de Amaratia",
          picture: ""
        });
        
        // Finalizamos y firmamos el evento usando la llave privada (que está en hex, así que la decodificamos si es necesario, 
        // pero identityKeys de IdentityUseCase debería tener privKey si la agregamos. Espera, IdentityUseCase solo retorna nsec y npub.
        // Necesitamos la privkey en hex (Uint8Array) para firmar. nip19.decode() nos la da.
        const { nip19 } = require('nostr-tools');
        const decoded = nip19.decode(identity.nsec);
        const privateKeyBytes = decoded.data as Uint8Array;

        const eventTemplate = {
          kind: 0,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: profileContent,
        };
        const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);
        
        // No bloqueamos la UI esperando esto
        adapter.publish(signedEvent as any).catch(e => console.error("Error publicando kind 0:", e));
      } catch (e) {
        console.error("Error creando el grito de nacimiento", e);
      }

      // ¡Éxito! Navegamos a la app principal
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });
      
    } catch (error: any) {
      Alert.alert('Error Criptográfico', error.message || 'No se pudo asegurar la identidad');
      setPin('');
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <ScreenContainer backgroundColor="#020617">
      <View className="flex-1 px-6 pt-10 pb-4">
        <View className="flex-1 items-center">
          <View className="w-16 h-16 bg-sky-500/20 rounded-full justify-center items-center mb-6">
            <Text className="text-3xl">🔒</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2 text-center">
            Asegura tu Acceso
          </Text>
          <Text className="text-slate-400 text-center mb-12">
            Crea un PIN de 6 dígitos. Este PIN cifrará criptográficamente tus llaves en este dispositivo.
          </Text>

          {/* Círculos indicadores del PIN */}
          <View className="flex-row gap-x-4 mb-16">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View 
                key={index} 
                className={`w-5 h-5 rounded-full border-2 ${
                  index < pin.length 
                    ? 'bg-sky-500 border-sky-500 shadow-sm shadow-sky-500/50' 
                    : 'bg-transparent border-slate-700'
                }`}
              />
            ))}
          </View>

          {isEncrypting ? (
            <View className="items-center mt-10">
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text className="text-sky-400 mt-4 font-medium animate-pulse">
                Aplicando 100,000 iteraciones PBKDF2...
              </Text>
            </View>
          ) : (
            <View className="w-full max-w-xs mt-auto">
              {/* Teclado numérico */}
              <View className="flex-row flex-wrap justify-between gap-y-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <TouchableOpacity 
                    key={num}
                    onPress={() => handleKeyPress(num)}
                    className="w-[30%] aspect-square rounded-full bg-slate-800/50 justify-center items-center active:bg-slate-700 border border-slate-700/50"
                  >
                    <Text className="text-3xl text-white font-medium">{num}</Text>
                  </TouchableOpacity>
                ))}
                
                <View className="w-[30%] aspect-square" />
                
                <TouchableOpacity 
                  onPress={() => handleKeyPress('0')}
                  className="w-[30%] aspect-square rounded-full bg-slate-800/50 justify-center items-center active:bg-slate-700 border border-slate-700/50"
                >
                  <Text className="text-3xl text-white font-medium">0</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleDelete}
                  className="w-[30%] aspect-square rounded-full justify-center items-center active:bg-slate-800/50"
                >
                  <Text className="text-xl text-slate-400 font-bold">BORRAR</Text>
                </TouchableOpacity>
              </View>

              {/* Botón de Confirmar */}
              <TouchableOpacity 
                className={`w-full py-4 rounded-2xl mt-10 shadow-lg ${
                  pin.length === 6 ? 'bg-sky-500 active:bg-sky-400 shadow-sky-500/30' : 'bg-slate-800 opacity-50'
                }`}
                disabled={pin.length !== 6}
                onPress={handleConfirm}
              >
                <Text className="text-white text-center font-bold text-lg">
                  Proteger Identidad
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
};
