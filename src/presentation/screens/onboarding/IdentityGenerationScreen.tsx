import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { IdentityUseCase } from '../../../use-cases/IdentityUseCase';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'IdentityGeneration'>;
};

export const IdentityGenerationScreen = ({ navigation }: Props) => {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [identityKeys, setIdentityKeys] = useState<any>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    // Generar identidad asíncronamente para no bloquear la UI en el render inicial
    setTimeout(() => {
      try {
        const identityUseCase = new IdentityUseCase();
        const generatedMnemonic = identityUseCase.generateMnemonic();
        const keys = identityUseCase.deriveKeysFromMnemonic(generatedMnemonic);
        
        setMnemonic(generatedMnemonic);
        setIdentityKeys(keys);
      } catch (error) {
        console.error('Error generando identidad', error);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  }, []);

  const handleContinue = () => {
    if (identityKeys && mnemonic) {
      // Pasamos tanto las llaves como las 12 palabras para guardarlas en la Bóveda
      navigation.navigate('PinSetup', { 
        identity: { 
          ...identityKeys, 
          mnemonic 
        } 
      });
    }
  };

  return (
    <View className="flex-1 bg-slate-950 p-6 justify-center">
      <View className="flex-1 justify-center items-center mt-10">
        <Text className="text-3xl font-bold text-white mb-2 text-center">
          Tu Identidad Secreta
        </Text>
        <Text className="text-slate-400 text-center mb-8 px-4">
          Estas 12 palabras son la única llave maestra hacia tu ciudadanía. Si las pierdes, perderás el acceso a Amaratia para siempre. Anótalas en un papel.
        </Text>

        {isGenerating ? (
          <View className="p-10 justify-center items-center">
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text className="text-slate-500 mt-4">Forjando llaves criptográficas...</Text>
          </View>
        ) : (
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => setIsRevealed(!isRevealed)}
            className="w-full bg-slate-900 rounded-3xl p-6 border border-slate-800 overflow-hidden"
          >
            {!isRevealed && (
              <View className="absolute inset-0 bg-slate-900/90 z-10 justify-center items-center backdrop-blur-md rounded-3xl">
                <Text className="text-white font-bold text-lg">Toca para revelar</Text>
              </View>
            )}
            
            <View className="flex-row flex-wrap justify-between gap-y-4">
              {mnemonic?.split(' ').map((word, index) => (
                <View key={index} className="w-[48%] bg-slate-800 rounded-xl p-3 flex-row items-center">
                  <Text className="text-slate-500 font-mono mr-2 w-5 text-right">{index + 1}.</Text>
                  <Text className="text-white font-bold text-lg">{word}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}

        <View className="mt-8 bg-sky-500/10 p-4 rounded-2xl border border-sky-500/20">
          <Text className="text-sky-300 text-sm text-center">
            Nunca tomes una captura de pantalla de estas palabras. Un ciudadano protege sus secretos en el mundo físico.
          </Text>
        </View>
      </View>

      <View className="mb-8">
        <TouchableOpacity 
          className={`w-full py-4 rounded-2xl shadow-lg ${isRevealed ? 'bg-sky-500 active:bg-sky-400 shadow-sky-500/30' : 'bg-slate-800 opacity-50'}`}
          disabled={!isRevealed || isGenerating}
          onPress={handleContinue}
        >
          <Text className="text-white text-center font-bold text-lg">
            He guardado estas palabras
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
