import React from 'react';
import { Group, Circle } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { MapNode } from '../../../types/canvas';

interface SkiaNodeProps {
  node: MapNode;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
  animMode: SharedValue<number>;
}

export const SkiaNode = React.memo(({ node, activeFocusState, focusTransition, animMode }: SkiaNodeProps) => {

  const getRadius = (level: number) => {
    if (level === -2) return { rMain: 220, rSel: 250 }; // Causa (LOD 3)
    if (level === -1) return { rMain: 90, rSel: 120 }; // Provincia (LOD 2)

    switch (level) {
      case 0: return { rMain: 28, rSel: 34 };
      case 1: return { rMain: 16, rSel: 22 };
      case 2: return { rMain: 11, rSel: 16 };
      case 3: default: return { rMain: 7, rSel: 11 };
    }
  };
  const { rMain, rSel } = getRadius(node.level);

  const transform = [{ translateX: node.pos.x }, { translateY: node.pos.y }];

  const focusOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    const isConnectedToFocus = state.selected !== null && (state.selected === node.id || !!state.connected[node.id]);

    // Cálculo base de LOD
    let baseLODOpacity = 1;
    if (isConnectedToFocus && focusTransition.value > 0) {
      // Si el nodo pertenece al ecosistema enfocado, se mantiene 100% visible en cualquier nivel de zoom!
      baseLODOpacity = 1.0;
    } else if (node.level === -2) {
      // Causa: visible en LOD 3 (animMode >= 2 a 3)
      // Multiplicamos por 2 para que aguante más tiempo visible mientras hacemos zoom in. 
      // Solo empezará a desaparecer cuando estemos muy cerca del Nivel 2.
      baseLODOpacity = Math.max(0, Math.min(1, (animMode.value - 2) * 2));
    } else if (node.level === -1) {
      // Provincia: visible en LOD 2 (animMode = 2)
      if (animMode.value > 2) {
        // Al hacer zoom OUT hacia Nivel 3, se desvanece suavemente
        baseLODOpacity = 1.0 - (animMode.value - 2) * 0.8;
      } else {
        // Al hacer zoom IN hacia Nivel 1. 
        // Multiplicamos por 2 para que aguante más tiempo visible antes de desaparecer.
        baseLODOpacity = Math.max(0, Math.min(1, (animMode.value - 1) * 2));
      }
    } else {
      // Ciudadano: atenúa en LOD >= 2
      baseLODOpacity = animMode.value >= 2 ? 0.2 : 1.0 - (animMode.value - 1) * 0.8;
      baseLODOpacity = Math.max(0.2, Math.min(1, baseLODOpacity));
    }

    if (!state.selected) return baseLODOpacity;

    const isDimmed = !isConnectedToFocus;
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;

    return baseLODOpacity * focusMultiplier;
  });

  const selOpacity = useDerivedValue(() => {
    return activeFocusState.value.selected === node.id ? focusTransition.value : 0;
  });

  return (
    <Group transform={transform} opacity={focusOpacity}>
      <Circle cx={0} cy={0} r={rMain * 1.8} color={node.color} opacity={0.15} />
      <Circle cx={0} cy={0} r={rMain * 1.4} color={node.color} opacity={0.3} />
      <Circle cx={0} cy={0} r={rMain} color={node.color} />

      {node.level === 0 && <Circle cx={0} cy={0} r={rMain} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.3)" />}
      {node.level === -1 && <Circle cx={0} cy={0} r={rMain} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.4)" />}
      {node.level === -2 && <Circle cx={0} cy={0} r={rMain} style="stroke" strokeWidth={3} color="rgba(255,255,255,0.6)" />}

      <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={node.level < 0 ? 8 : 2} opacity={selOpacity} />
    </Group>
  );
}, (prev, next) => prev.node.id === next.node.id);
