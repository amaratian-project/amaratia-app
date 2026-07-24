import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { database } from '../../infrastructure/database';
import { IdentityUseCase } from '../../use-cases/IdentityUseCase';
import { QuickCryptoService } from '../../infrastructure/security/QuickCryptoService';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export const DiagnosticScreen = () => {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Identity (BIP39 & Nostr)', status: 'pending' },
    { name: 'Cryptography (AES-GCM)', status: 'pending' },
    { name: 'WatermelonDB (Local-First)', status: 'pending' },
  ]);

  const runTests = async () => {
    // Reset tests
    setTests(prev => prev.map(t => ({ ...t, status: 'running', message: undefined })));
    await new Promise(resolve => setTimeout(resolve, 100)); // Yield para renderizar 'running'

    // 1. Test Identity
    let identityKeys: any = null;
    try {
      const identityUseCase = new IdentityUseCase();
      const mnemonic = identityUseCase.generateMnemonic();
      const keys = identityUseCase.deriveKeysFromMnemonic(mnemonic);
      
      if (!mnemonic || !keys.npub) throw new Error('Llaves incompletas');
      identityKeys = keys;
      updateTest('Identity (BIP39 & Nostr)', 'success', `Generada pubkey: ${keys.npub.substring(0, 10)}...`);
    } catch (e: any) {
      updateTest('Identity (BIP39 & Nostr)', 'error', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 100)); // Yield

    // 2. Test Cryptography
    try {
      if (!identityKeys) throw new Error('Requiere identidad previa');
      const cryptoService = new QuickCryptoService();
      const payload = "secreto_top_secret";
      const encrypted = await cryptoService.encryptWithPin(payload, '123456');
      const decrypted = await cryptoService.decryptWithPin(encrypted, '123456');
      
      if (decrypted !== payload) throw new Error('Fallo en descifrado');
      updateTest('Cryptography (AES-GCM)', 'success', 'AES-256-GCM Cifrado/Descifrado OK');
    } catch (e: any) {
      updateTest('Cryptography (AES-GCM)', 'error', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 100)); // Yield

    // 3. Test WatermelonDB
    try {
      await database.write(async () => {
        const citizensCollection = database.collections.get('citizens');
        
        const newCitizen = await citizensCollection.create((citizen: any) => {
          citizen.pubkey = identityKeys ? identityKeys.npub : 'dummy_pubkey';
          citizen.role = 'tourist';
          citizen.alias = 'Test User';
        });
        
        if (!newCitizen.id) throw new Error('Fallo al guardar en DB');
        updateTest('WatermelonDB (Local-First)', 'success', `Citizen creado ID: ${newCitizen.id}`);
      });
    } catch (e: any) {
      updateTest('WatermelonDB (Local-First)', 'error', e.message);
    }
  };

  const updateTest = (name: string, status: TestResult['status'], message?: string) => {
    setTests(prev => prev.map(t => t.name === name ? { ...t, status, message } : t));
  };

  return (
    <View className="flex-1 bg-slate-900 justify-center items-center p-6 absolute inset-0 z-50">
      <View className="bg-slate-800 p-6 rounded-3xl w-full max-w-md shadow-2xl border border-slate-700">
        <Text className="text-2xl font-bold text-white mb-2 text-center">Diagnóstico Nativo</Text>
        <Text className="text-slate-400 text-center mb-6 text-sm">
          Amaratia MVP Phase 4.5
        </Text>

        <ScrollView className="mb-6 max-h-64">
          {tests.map((test, index) => (
            <View key={index} className="mb-4 bg-slate-700/50 p-4 rounded-xl">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-white font-semibold flex-1">{test.name}</Text>
                {test.status === 'running' && <ActivityIndicator size="small" color="#38bdf8" />}
                {test.status === 'success' && <Text className="text-emerald-400 font-bold">✅ OK</Text>}
                {test.status === 'error' && <Text className="text-rose-400 font-bold">❌ FAIL</Text>}
                {test.status === 'pending' && <Text className="text-slate-500 font-bold">⏳ WAIT</Text>}
              </View>
              {test.message && (
                <Text className={`text-xs mt-1 ${test.status === 'error' ? 'text-rose-300' : 'text-emerald-300/70'}`}>
                  {test.message}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity 
          onPress={runTests}
          className="bg-sky-500 py-4 rounded-2xl active:bg-sky-600"
        >
          <Text className="text-white text-center font-bold text-lg shadow-sm">
            Ejecutar Pruebas
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
