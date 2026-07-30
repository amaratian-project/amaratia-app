import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withSpring, runOnJS, withTiming } from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import { MapNode } from '../../types/canvas';

const { width, height } = Dimensions.get('window');

enum GestureMode {
  NONE = 0,
  PANNING = 1,
  PINCHING = 2,
  TAPPING = 3
}

interface GesturesConfig {
  bounds: { R: number, citizenR?: number, provinceR?: number };
  nodes: MapNode[];
  handleNodePress: (node: MapNode) => void;
  closePanels: () => void;
}

export const useCanvasGestures = ({
  bounds,
  nodes,
  handleNodePress,
  closePanels
}: GesturesConfig) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originFocalX = useSharedValue(0);
  const originFocalY = useSharedValue(0);

  const activeGesture = useSharedValue(GestureMode.NONE);

  const MIN_SCALE = Math.max(0.05, Math.min(width, height) / (bounds.R * 2.5));
  const MAX_SCALE = 4.0;

  // Calculamos las escalas ideales para que el árbol se ajuste exactamente en pantalla
  const scaleLOD1 = Math.min(1.0, Math.min(width, height) / ((bounds.citizenR || bounds.R) * 2.2));
  const scaleLOD2 = Math.min(1.0, Math.min(width, height) / ((bounds.provinceR || bounds.R) * 2.2));
  const scaleLOD3 = Math.min(0.15, scaleLOD2 * 0.4); // Aún más lejos

  const goToLOD = (level: number) => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    if (level === 1) {
      scale.value = withSpring(scaleLOD1);
    } else if (level === 2) {
      scale.value = withSpring(scaleLOD2);
    } else if (level === 3) {
      scale.value = withSpring(scaleLOD3);
    }
  };

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      if (activeGesture.value !== GestureMode.NONE) return;
      activeGesture.value = GestureMode.PANNING;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (activeGesture.value !== GestureMode.PANNING) return;
      const panLimitX = Math.max(0, bounds.R * scale.value - width / 2 + 150);
      const panLimitY = Math.max(0, bounds.R * scale.value - width / 2 + 200);
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      if (nextX > panLimitX) nextX = panLimitX + (nextX - panLimitX) * 0.15;
      if (nextX < -panLimitX) nextX = -panLimitX + (nextX + panLimitX) * 0.15;
      if (nextY > panLimitY) nextY = panLimitY + (nextY - panLimitY) * 0.15;
      if (nextY < -panLimitY) nextY = -panLimitY + (nextY + panLimitY) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      if (activeGesture.value !== GestureMode.PANNING) return;
      const panLimitX = Math.max(0, bounds.R * scale.value - width / 2 + 150);
      const panLimitY = Math.max(0, bounds.R * scale.value - width / 2 + 200);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    })
    .onFinalize(() => {
      if (activeGesture.value === GestureMode.PANNING) activeGesture.value = GestureMode.NONE;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      if (activeGesture.value !== GestureMode.NONE) return;
      activeGesture.value = GestureMode.PINCHING;
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      originFocalX.value = e.focalX;
      originFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      if (activeGesture.value !== GestureMode.PINCHING) return;
      if (e.numberOfPointers < 2) return;

      let nextScale = savedScale.value * e.scale;
      
      if (nextScale > MAX_SCALE) {
        nextScale = MAX_SCALE + (nextScale - MAX_SCALE) * 0.15;
      } else if (nextScale < MIN_SCALE) {
        nextScale = MIN_SCALE - (MIN_SCALE - nextScale) * 0.15;
      }
      scale.value = nextScale;

      const Px_start = originFocalX.value - width / 2;
      const Py_start = originFocalY.value - height / 2;

      const scaleRatio = nextScale / savedScale.value;
      translateX.value = savedTranslateX.value * scaleRatio + Px_start * (1 - scaleRatio);
      translateY.value = savedTranslateY.value * scaleRatio + Py_start * (1 - scaleRatio);
    })
    .onEnd(() => {
      if (activeGesture.value !== GestureMode.PINCHING) return;
      let finalScale = scale.value;
      if (scale.value < MIN_SCALE) finalScale = MIN_SCALE;
      if (scale.value > MAX_SCALE) finalScale = MAX_SCALE;

      const panLimitX = Math.max(0, bounds.R * finalScale - width / 2 + 150);
      const panLimitY = Math.max(0, bounds.R * finalScale - width / 2 + 200);

      let targetX = translateX.value;
      let targetY = translateY.value;

      if (finalScale !== scale.value) {
        const R = finalScale / scale.value;
        targetX = translateX.value * R;
        targetY = translateY.value * R;
        scale.value = withSpring(finalScale);
      }

      if (targetX > panLimitX) targetX = panLimitX;
      if (targetX < -panLimitX) targetX = -panLimitX;
      if (targetY > panLimitY) targetY = panLimitY;
      if (targetY < -panLimitY) targetY = -panLimitY;

      if (targetX !== translateX.value) translateX.value = withSpring(targetX);
      if (targetY !== translateY.value) translateY.value = withSpring(targetY);
      
      // ELIMINADO: La lógica de thresholds que forzaba cambios de nivel abruptos.
      // Ahora el usuario tiene control libre continuo.
    })
    .onFinalize(() => {
      if (activeGesture.value === GestureMode.PINCHING) activeGesture.value = GestureMode.NONE;
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .runOnJS(true)
    .onEnd((e) => {
      if (activeGesture.value !== GestureMode.NONE) return;
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      let foundNode = null;
      let minDistance = Infinity;
      const dynamicHitbox = 40 / scale.value;
      
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= dynamicHitbox && distance < minDistance) { 
          minDistance = distance;
          foundNode = node;
        }
      }

      if (foundNode) {
        runOnJS(handleNodePress)(foundNode);
      } else {
        runOnJS(closePanels)();
      }
    });

  const composed = Gesture.Exclusive(panGesture, pinchGesture, tapGesture);

  const globalTransform = useDerivedValue(() => {
    return [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ];
  });

  return { composed, globalTransform, scale, translateX, translateY, goToLOD, scales: { scaleLOD1, scaleLOD2, scaleLOD3 } };
};
