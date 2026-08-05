import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, withSpring, withTiming, runOnJS, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import { MapNode } from '../../types/canvas';

const { width, height } = Dimensions.get('window');
const SCREEN_MIN = Math.min(width, height);

enum GestureMode {
  NONE = 0,
  PANNING = 1,
  PINCHING = 2,
  TAPPING = 3
}

interface GesturesConfig {
  bounds: { R: number; citizenR?: number; provinceR?: number; causeR?: number };
  nodes: MapNode[];
  handleNodePress: (node: MapNode) => void;
  closePanels: () => void;
  animatedPosition?: SharedValue<number>;
}

export const useCanvasGestures = ({
  bounds,
  nodes,
  handleNodePress,
  closePanels,
  animatedPosition
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

  const citR = bounds.citizenR || bounds.R * 0.3;
  const provR = bounds.provinceR || bounds.R * 0.6;
  const causeR = bounds.causeR || bounds.R;

  // Escalas por nivel (LOD1: Ciudadanos = 1.0; LOD2: Provincias = medio; LOD3: Causas = vista global)
  const scaleLOD1 = Math.max(0.7, Math.min(1.2, SCREEN_MIN / (citR * 1.8)));
  const scaleLOD2 = Math.min(scaleLOD1 * 0.5, Math.max(0.18, SCREEN_MIN / (provR * 2.0)));
  const scaleLOD3 = Math.min(scaleLOD2 * 0.4, Math.max(0.02, SCREEN_MIN / (causeR * 2.2)));

  const MIN_SCALE = Math.max(0.01, scaleLOD3 * 0.7);
  const MAX_SCALE = 4.0;

  // Radio activo según la escala actual (permite límites de arrastre progresivos por nivel)
  const activeRadius = useDerivedValue(() => {
    return interpolate(
      scale.value,
      [scaleLOD3, scaleLOD2, scaleLOD1],
      [causeR, provR, citR],
      Extrapolation.CLAMP
    );
  });

  const goToLOD = (level: number) => {
    const config = { duration: 350 };
    translateX.value = withTiming(0, config);
    translateY.value = withTiming(0, config);
    if (level === 1) {
      scale.value = withTiming(scaleLOD1, config);
    } else if (level === 2) {
      scale.value = withTiming(scaleLOD2, config);
    } else if (level === 3) {
      scale.value = withTiming(scaleLOD3, config);
    }
  };

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesDown((e, manager) => {
      'worklet';
      // Si el toque cae en el área del BottomSheet, FALLAR el gesto
      // para liberar el toque y que el FlatList nativo lo reciba.
      // Antes solo retornábamos de onStart, pero el gesto seguía en
      // estado ACTIVE, capturando el toque e impidiendo el scroll.
      const touch = e.changedTouches[0];
      if (animatedPosition && touch.absoluteY >= animatedPosition.value - 10) {
        manager.fail();
      }
    })
    .onTouchesMove((_e, manager) => {
      'worklet';
      // El toque está en el canvas (no fue fallado en onTouchesDown).
      // Activar el gesto de paneo del mapa.
      manager.activate();
    })
    .onStart(() => {
      if (activeGesture.value !== GestureMode.NONE) return;
      activeGesture.value = GestureMode.PANNING;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (activeGesture.value !== GestureMode.PANNING) return;

      // El límite de arrastre permite centrar el nodo más lejano del nivel activo sin perder nodos en pantalla
      const panLimit = activeRadius.value * scale.value + 50;
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica suave al sobrepasar los bordes del nivel
      if (nextX > panLimit) nextX = panLimit + (nextX - panLimit) * 0.2;
      if (nextX < -panLimit) nextX = -panLimit + (nextX + panLimit) * 0.2;
      if (nextY > panLimit) nextY = panLimit + (nextY - panLimit) * 0.2;
      if (nextY < -panLimit) nextY = -panLimit + (nextY + panLimit) * 0.2;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      if (activeGesture.value !== GestureMode.PANNING) return;
      const panLimit = activeRadius.value * scale.value + 50;
      if (translateX.value > panLimit) translateX.value = withSpring(panLimit, { damping: 18 });
      if (translateX.value < -panLimit) translateX.value = withSpring(-panLimit, { damping: 18 });
      if (translateY.value > panLimit) translateY.value = withSpring(panLimit, { damping: 18 });
      if (translateY.value < -panLimit) translateY.value = withSpring(-panLimit, { damping: 18 });
    })
    .onFinalize(() => {
      if (activeGesture.value === GestureMode.PANNING) activeGesture.value = GestureMode.NONE;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      if (animatedPosition && e.focalY >= animatedPosition.value - 10) return;
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

      const panLimit = activeRadius.value * finalScale + 50;

      let targetX = translateX.value;
      let targetY = translateY.value;

      if (finalScale !== scale.value) {
        const R = finalScale / scale.value;
        targetX = translateX.value * R;
        targetY = translateY.value * R;
        scale.value = withSpring(finalScale, { damping: 18 });
      }

      if (targetX > panLimit) targetX = panLimit;
      if (targetX < -panLimit) targetX = -panLimit;
      if (targetY > panLimit) targetY = panLimit;
      if (targetY < -panLimit) targetY = -panLimit;

      if (targetX !== translateX.value) translateX.value = withSpring(targetX, { damping: 18 });
      if (targetY !== translateY.value) translateY.value = withSpring(targetY, { damping: 18 });
    })
    .onFinalize(() => {
      if (activeGesture.value === GestureMode.PINCHING) activeGesture.value = GestureMode.NONE;
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .runOnJS(true)
    .onEnd((e) => {
      if (animatedPosition && e.y >= animatedPosition.value - 10) return;
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
