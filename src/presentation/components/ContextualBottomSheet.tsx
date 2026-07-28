import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, runOnJS, SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ContextualBottomSheetProps = {
  children: React.ReactNode;
  panelTranslateY: SharedValue<number>;
  onClose: () => void;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const ContextualBottomSheet = ({ children, panelTranslateY, onClose }: ContextualBottomSheetProps) => {
  const insets = useSafeAreaInsets();

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Solo arrastrar hacia abajo por ahora
      if (event.translationY > 0) {
        panelTranslateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      // Ajustes del spring: más rápido y firme (stiffness alto, damping justo)
      const springConfig = { damping: 20, stiffness: 200, mass: 0.8 };

      if (event.translationY > 100 || event.velocityY > 600) {
        panelTranslateY.value = withSpring(SCREEN_HEIGHT, { ...springConfig, velocity: event.velocityY }, () => {
          runOnJS(onClose)();
        });
      } else {
        panelTranslateY.value = withSpring(0, springConfig);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: panelTranslateY.value }],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 20) }, animatedStyle]}>
        {/* Barra superior de arrastre */}
        <View style={styles.handleContainer}>
          <View style={styles.handleBar} />
        </View>
        
        {/* Contenido Inyectado */}
        <View style={styles.contentContainer}>
          {children}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  contentContainer: {
    paddingHorizontal: 20,
  }
});
