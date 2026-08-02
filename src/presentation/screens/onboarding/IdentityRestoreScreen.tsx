import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { IdentityUseCase } from '../../../application/use-cases/IdentityUseCase';
import * as bip39 from '@scure/bip39';
// @ts-ignore: module resolution for wordlist
import { wordlist } from '@scure/bip39/wordlists/english';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'IdentityRestore'>;
};

export const IdentityRestoreScreen = ({ navigation }: Props) => {
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    // Unir las palabras filtrando vacías
    const cleanMnemonic = words.map(w => w.trim().toLowerCase()).join(' ');
    const filledWords = words.filter(w => w.trim().length > 0);

    if (filledWords.length !== 12) {
      Alert.alert('Error', 'Debes completar exactamente las 12 palabras.');
      return;
    }

    setIsRestoring(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const isValid = bip39.validateMnemonic(cleanMnemonic, wordlist);
      if (!isValid) {
        throw new Error('La frase semilla es inválida o tiene palabras incorrectas.');
      }

      const identityUseCase = new IdentityUseCase();
      const keys = identityUseCase.deriveKeysFromMnemonic(cleanMnemonic);

      navigation.navigate('PinSetup', { 
        identity: {
          ...keys,
          mnemonic: cleanMnemonic
        } 
      });
    } catch (error: any) {
      Alert.alert('Fallo al restaurar', error.message || 'La identidad no pudo ser recuperada.');
    } finally {
      setIsRestoring(false);
    }
  };

  const isFormComplete = words.filter(w => w.trim().length > 0).length === 12;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-950"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-16 pb-10">
          <View className="w-16 h-16 bg-sky-500/20 rounded-full justify-center items-center mb-6 border border-sky-500/30">
            <Text className="text-3xl">🔄</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            Restaurar Ciudadanía
          </Text>
          <Text className="text-slate-400 mb-8">
            Ingresa tus 12 palabras secretas en orden.
          </Text>

          <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
            {words.map((word, index) => (
              <View key={index} className="w-[48%] bg-slate-900 rounded-xl px-2 py-1 flex-row items-center border border-slate-800 focus:border-sky-500/50">
                <Text className="text-slate-500 font-mono mr-1 w-5 text-right">{index + 1}.</Text>
                <TextInput
                  className="flex-1 text-white font-bold text-base py-2"
                  value={word}
                  onChangeText={(text) => {
                    const pasted = text.trim().toLowerCase().split(/\s+/);
                    if (pasted.length > 1) {
                      // Soporte para pegar múltiples palabras a la vez
                      const newWords = [...words];
                      for (let i = 0; i < pasted.length && index + i < 12; i++) {
                        newWords[index + i] = pasted[i];
                      }
                      setWords(newWords);
                    } else {
                      const newWords = [...words];
                      newWords[index] = text.trim().toLowerCase();
                      setWords(newWords);
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={`palabra`}
                  placeholderTextColor="#334155"
                />
              </View>
            ))}
          </View>

          <View className="mt-auto pt-4">
            <TouchableOpacity 
              className={`w-full py-4 rounded-2xl shadow-lg ${
                isFormComplete && !isRestoring
                  ? 'bg-sky-500 active:bg-sky-400 shadow-sky-500/30' 
                  : 'bg-slate-800 opacity-50'
              }`}
              disabled={!isFormComplete || isRestoring}
              onPress={handleRestore}
            >
              <Text className="text-white text-center font-bold text-lg">
                {isRestoring ? 'Verificando...' : 'Restaurar Identidad'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="w-full mt-4 py-4 rounded-2xl active:bg-white/5"
              onPress={() => navigation.goBack()}
            >
              <Text className="text-slate-400 text-center font-semibold text-base">
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
