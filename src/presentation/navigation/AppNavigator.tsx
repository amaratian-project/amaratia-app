import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { IdentityGenerationScreen } from '../screens/onboarding/IdentityGenerationScreen';
import { IdentityRestoreScreen } from '../screens/onboarding/IdentityRestoreScreen';
import { PinSetupScreen } from '../screens/onboarding/PinSetupScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { CanvasMap } from '../components/CanvasMap';

// Definición de las rutas y sus parámetros
export type RootStackParamList = {
  Welcome: undefined;
  IdentityGeneration: undefined;
  IdentityRestore: undefined;
  PinSetup: { identity: any }; // Pasa la identidad generada para cifrarla
  Login: undefined;
  MainApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false, // UI inmersiva, sin cabeceras nativas
        animation: 'fade', // Transiciones suaves
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="IdentityGeneration" component={IdentityGenerationScreen} />
      <Stack.Screen name="IdentityRestore" component={IdentityRestoreScreen} />
      <Stack.Screen name="PinSetup" component={PinSetupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainApp" component={CanvasMap} />
    </Stack.Navigator>
  );
};
