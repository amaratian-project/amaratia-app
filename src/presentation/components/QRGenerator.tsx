import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { nip19, finalizeEvent } from 'nostr-tools';
import type { KeyPair } from '../../domain/identity/IIdentityUseCase';

type QRGeneratorProps = {
  identity: KeyPair;
  onClose: () => void;
};

export const QRGenerator = ({ identity, onClose }: QRGeneratorProps) => {
  const [qrData, setQrData] = useState<string | null>(null);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const generateToken = () => {
      try {
        const { type, data } = nip19.decode(identity.nsec);
        if (type !== 'nsec') throw new Error('Invalid nsec');
        
        const privateKeyBytes = data as Uint8Array;
        
        const event = {
          kind: 21000,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: 'Amaratia Handshake',
        };
        
        const signedEvent = finalizeEvent(event, privateKeyBytes);
        setQrData(JSON.stringify(signedEvent));
      } catch(e) {
        console.error("Error firmando QR", e);
      }
    };
    
    generateToken();
    timer = setInterval(generateToken, 30000); // Rotar cada 30 segundos
    
    return () => clearInterval(timer);
  }, [identity.nsec]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Tu Identidad Pública</Text>
        <Text style={styles.subtitle}>
          Muestra este código a un compañero para que te acredite en su red de confianza local (Nivel 1).
        </Text>
        
        <View style={styles.qrContainer}>
          {qrData ? (
            <QRCode
              value={qrData}
              size={220}
              color="#0f172a"
              backgroundColor="white"
            />
          ) : (
            <View style={{ width: 220, height: 220, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          )}
        </View>

        <Text style={styles.alias}>{identity.alias}</Text>

        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 30,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 25,
    fontSize: 14,
    lineHeight: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
  },
  alias: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 25,
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
