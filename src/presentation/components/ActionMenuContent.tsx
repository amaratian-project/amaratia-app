import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type ActionMenuContentProps = {
  onScanCitizen: () => void;
  onCreateProvince: () => void;
};

export const ActionMenuContent = ({ onScanCitizen, onCreateProvince }: ActionMenuContentProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sheetTitle}>Crear</Text>
        
      <TouchableOpacity style={styles.sheetButton} onPress={onScanCitizen}>
        <Text style={styles.sheetButtonIcon}>🛡️</Text>
        <View style={styles.sheetButtonTextContainer}>
          <Text style={styles.sheetButtonTitle}>Otorgar Visa</Text>
          <Text style={styles.sheetButtonSub}>Agregar ciudadano a tu red de confianza escaneando su codigo qr</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.sheetButton} onPress={onCreateProvince}>
        <Text style={styles.sheetButtonIcon}>🏛️</Text>
        <View style={styles.sheetButtonTextContainer}>
          <Text style={styles.sheetButtonTitle}>Fundar Provincia</Text>
          <Text style={styles.sheetButtonSub}>Crear un grupo (Requiere 3 firmas)</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  sheetTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  sheetButtonIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  sheetButtonTextContainer: {
    flex: 1,
  },
  sheetButtonTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sheetButtonSub: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
