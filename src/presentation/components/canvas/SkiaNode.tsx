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
    if (level === -1) return { rMain: 180, rSel: 200 }; // Provincia equilibrada r=180

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
    } else if (node.level === -1) {
      // Provincia: visible solo en LOD >= 2 (animMode >= 2)
      baseLODOpacity = Math.max(0, Math.min(1, animMode.value - 1));
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
      <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={node.level === -1 ? 8 : 2} opacity={selOpacity} />
    </Group>
  );
}, (prev, next) => prev.node.id === next.node.id);
