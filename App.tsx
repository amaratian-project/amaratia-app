import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './global.css';
import { CanvasMap } from './src/presentation/components/CanvasMap';
import { CitizenSheet } from './src/presentation/components/CitizenSheet';
import { DiagnosticScreen } from './src/presentation/screens/DiagnosticScreen';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Fondo Topológico (Grafo Web of Trust) */}
      <CanvasMap />

      {/* Panel Deslizante de Información Cívica y Kanban */}
      <CitizenSheet />
      
      {/* Pantalla temporal de diagnóstico (Fase 4.5) */}
      <DiagnosticScreen />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
});
