import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { verifyEvent, nip19 } from 'nostr-tools';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scanner'>;
};

export const ScannerScreen = ({ navigation }: Props) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View className="flex-1 bg-slate-950" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center px-6">
        <Text className="text-white text-center mb-6">Necesitamos permiso para usar la cámara y escanear el QR del ciudadano.</Text>
        <TouchableOpacity 
          className="bg-sky-500 py-3 px-6 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-white font-bold">Otorgar Permiso</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="mt-6 p-2"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-slate-400">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    
    try {
      const event = JSON.parse(data);
      
      // Validaciones Estructurales
      if (!event.id || !event.pubkey || !event.sig || event.kind !== 21000) {
        throw new Error("Formato inválido");
      }
      
      // 1. Prueba de Presencia (Liveliness Proof) - 120 segundos de tolerancia
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - event.created_at);
      if (timeDiff > 120) {
        Alert.alert('Código Expirado', 'Este código QR ha vencido. Pídele al ciudadano que muestre uno nuevo.', [
          { text: 'Ok', onPress: () => setScanned(false) }
        ]);
        return;
      }
      
      // 2. Prueba de Propiedad (Criptografía de Curvas Elípticas)
      const isValid = verifyEvent(event);
      if (!isValid) {
        Alert.alert('Firma Falsa', 'La firma criptográfica no coincide con la llave pública. Posible suplantación.', [
          { text: 'Ok', onPress: () => setScanned(false) }
        ]);
        return;
      }
      
      // Convertir el Hex Público a Npub
      const newNpub = nip19.npubEncode(event.pubkey);
      
      Alert.alert(
        'Turista Detectado',
        `¿Deseas otorgarle una Visa a esta persona y agregarla a tu Red de Confianza (Nivel 1)?\n\nID: Amarata-${newNpub.substring(5, 9).toUpperCase()}`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setScanned(false) },
          { 
            text: 'Otorgar Visa', 
            style: 'default',
            onPress: () => {
              navigation.navigate('MainApp', { addCitizen: newNpub });
            }
          }
        ]
      );
      
    } catch(e) {
      // Compatibilidad temporal con npub crudo (opcional, pero mejor forzar seguridad)
      Alert.alert('Código Inválido', 'Este código no posee una Firma Criptográfica de Presencia válida.', [
        { text: 'Ok', onPress: () => setScanned(false) }
      ]);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      <View className="absolute bottom-10 left-0 right-0 items-center">
        <TouchableOpacity 
          className="bg-slate-900/80 px-8 py-4 rounded-full border border-slate-700"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-white font-bold text-lg">Cancelar Escaneo</Text>
        </TouchableOpacity>
      </View>
      <View className="absolute top-20 left-0 right-0 items-center">
        <Text className="text-white font-medium text-lg bg-black/50 px-4 py-2 rounded-lg">Apunta al código QR del ciudadano</Text>
      </View>
    </View>
  );
};
