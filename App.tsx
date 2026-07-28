import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import './global.css';
import { AppNavigator } from './src/presentation/navigation/AppNavigator';
import { AuthProvider } from './src/application/context/AuthContext';
import { DependencyProvider } from './src/application/context/DependencyContext';
import { CitizenRepository } from './src/domain/repositories/CitizenRepository';
import { injectDummyTopology } from './src/infrastructure/database/dummyData';

const dependencies = {
  citizenRepository: new CitizenRepository(),
};

const darkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0f172a',
  },
};

export default function App() {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const init = async () => {
      await injectDummyTopology();
      setIsReady(true);
    };
    init();
  }, []);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
          <StatusBar style="light" />
          <AuthProvider>
            <DependencyProvider dependencies={dependencies}>
              <NavigationContainer theme={darkTheme}>
                <AppNavigator />
              </NavigationContainer>
            </DependencyProvider>
          </AuthProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
});
