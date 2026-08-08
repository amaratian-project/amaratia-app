import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { database } from '../../../infrastructure/database';
import { ScreenContainer } from '../../components/ScreenContainer';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

export const WelcomeScreen = ({ navigation }: Props) => {
  const [hasVault, setHasVault] = useState<boolean | null>(null);

  useEffect(() => {
    const checkVault = async () => {
      try {
        const count = await database.collections.get('vaults').query().fetchCount();
        setHasVault(count > 0);
      } catch (error) {
        console.error('Error verificando bóveda:', error);
        setHasVault(false);
      }
    };
    checkVault();
  }, []);

  return (
    <ScreenContainer backgroundColor="#020617">
      <View className="flex-1 justify-center items-center p-8">
        {/* Círculos decorativos de fondo (Glassmorphism effect) */}
        <View className="absolute top-20 -left-10 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl" />
        <View className="absolute bottom-20 -right-10 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl" />

        <View className="flex-1 justify-center items-center w-full">
          <Text className="text-5xl font-black text-white tracking-tighter mb-2 text-center">
            AMARATIA
          </Text>
          <Text className="text-slate-400 text-lg text-center mb-12 font-medium px-4">
            The Pocket Network State. Resistencia civil a través de topología local-first y ZKP.
          </Text>

          {hasVault === null ? (
            <ActivityIndicator size="large" color="#38bdf8" />
          ) : hasVault ? (
            <TouchableOpacity 
              className="w-full bg-fuchsia-600 py-4 rounded-2xl active:bg-fuchsia-500 shadow-lg shadow-fuchsia-600/30"
              onPress={() => navigation.navigate('Login')}
            >
              <Text className="text-white text-center font-bold text-lg">
                Desbloquear Bóveda
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="w-full">
              <TouchableOpacity 
                className="w-full bg-sky-500 py-4 rounded-2xl active:bg-sky-400 shadow-lg shadow-sky-500/30"
                onPress={() => navigation.navigate('IdentityGeneration')}
              >
                <Text className="text-white text-center font-bold text-lg">
                  Crear Nueva Ciudadanía
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="w-full mt-4 py-4 rounded-2xl active:bg-white/5 border border-white/10"
                onPress={() => navigation.navigate('IdentityRestore')}
              >
                <Text className="text-slate-300 text-center font-semibold text-base">
                  Ya tengo una identidad (Restaurar)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
};
