import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { QuickCryptoService } from '../../../infrastructure/security/QuickCryptoService';
import { database } from '../../../infrastructure/database';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export const LoginScreen = ({ navigation }: Props) => {
  const [pin, setPin] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);

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
    
    setIsDecrypting(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      // 1. Obtener el registro de la bóveda
      const vaults = await database.collections.get('vaults').query().fetch();
      if (vaults.length === 0) {
        throw new Error('No se encontró ninguna bóveda en este dispositivo.');
      }
      
      const vaultRecord = vaults[0] as any;
      const encryptedData = JSON.parse(vaultRecord.encryptedData);
      
      // 2. Intentar descifrar con el PIN ingresado
      const cryptoService = new QuickCryptoService();
      const decryptedString = await cryptoService.decryptWithPin(encryptedData, pin);
      
      if (!decryptedString) {
        // PIN incorrecto (falla la validación del AuthTag GCM)
        throw new Error('PIN incorrecto. Acceso denegado.');
      }

      // const identity = JSON.parse(decryptedString);
      // Aquí se cargaría la identidad en memoria (ej. Zustand o Context) para usarla en la app.

      // 3. ¡Éxito! Navegamos a la app principal
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });
      
    } catch (error: any) {
      Alert.alert('Acceso Denegado', error.message || 'Error al intentar descifrar la bóveda');
      setPin('');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-950 px-6 pt-20 pb-10">
      <View className="flex-1 items-center">
        <View className="w-16 h-16 bg-fuchsia-600/20 rounded-full justify-center items-center mb-6 border border-fuchsia-600/30">
          <Text className="text-3xl">🔑</Text>
        </View>
        
        <Text className="text-3xl font-bold text-white mb-2 text-center">
          Desbloquear Bóveda
        </Text>
        <Text className="text-slate-400 text-center mb-12">
          Ingresa tu PIN de 6 dígitos para descifrar tus llaves y acceder a Amaratia.
        </Text>

        {/* Círculos indicadores del PIN */}
        <View className="flex-row gap-x-4 mb-16">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View 
              key={index} 
              className={`w-5 h-5 rounded-full border-2 ${
                index < pin.length 
                  ? 'bg-fuchsia-500 border-fuchsia-500 shadow-sm shadow-fuchsia-500/50' 
                  : 'bg-transparent border-slate-700'
              }`}
            />
          ))}
        </View>

        {isDecrypting ? (
          <View className="items-center mt-10">
            <ActivityIndicator size="large" color="#d946ef" />
            <Text className="text-fuchsia-400 mt-4 font-medium animate-pulse">
              Verificando PIN y descifrando llaves...
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
                pin.length === 6 ? 'bg-fuchsia-600 active:bg-fuchsia-500 shadow-fuchsia-600/30' : 'bg-slate-800 opacity-50'
              }`}
              disabled={pin.length !== 6}
              onPress={handleConfirm}
            >
              <Text className="text-white text-center font-bold text-lg">
                Desbloquear
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
