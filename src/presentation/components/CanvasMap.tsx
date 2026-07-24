import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec, Paint, BlurMask } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const CENTER = vec(width / 2, height / 2);

export const CanvasMap = () => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pan gesture para mover el mapa
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Pinch gesture para hacer zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  // Simulación de Nodos del 1er y 2do anillo
  const nodes = [
    { pos: vec(CENTER.x - 80, CENTER.y - 100), color: '#3b82f6' },
    { pos: vec(CENTER.x + 100, CENTER.y - 60), color: '#3b82f6' },
    { pos: vec(CENTER.x - 40, CENTER.y + 120), color: '#3b82f6' },
    { pos: vec(CENTER.x + 120, CENTER.y + 80), color: '#3b82f6' },
  ];

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Canvas style={styles.canvas}>
            {/* Conexiones */}
            {nodes.map((node, i) => (
              <Line 
                key={`line-${i}`}
                p1={CENTER} 
                p2={node.pos} 
                color="rgba(255, 255, 255, 0.2)" 
                strokeWidth={2} 
              />
            ))}

            {/* Nodos Periféricos */}
            {nodes.map((node, i) => (
              <Group key={`node-${i}`}>
                <Circle c={node.pos} r={18} color={node.color} />
                <Circle c={node.pos} r={24} color="rgba(59, 130, 246, 0.3)">
                  <BlurMask blur={10} style="normal" />
                </Circle>
              </Group>
            ))}

            {/* Nodo Central (El Ciudadano) */}
            <Group>
              <Circle c={CENTER} r={32} color="#10b981" />
              <Circle c={CENTER} r={45} color="rgba(16, 185, 129, 0.3)">
                <BlurMask blur={15} style="normal" />
              </Circle>
              <Circle c={CENTER} r={28} color="#059669" />
            </Group>
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  }
});
