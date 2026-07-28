import React from 'react';
import { Group, Circle } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { MapNode } from '../../../types/canvas';

interface SkiaNodeProps {
  node: MapNode;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

export const SkiaNode = React.memo(({ node, activeFocusState, focusTransition }: SkiaNodeProps) => {

  const getRadius = (level: number) => {
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
    if (!state.selected) return 1;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    return isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
  });

  const selOpacity = useDerivedValue(() => {
    return activeFocusState.value.selected === node.id ? focusTransition.value : 0;
  });

  return (
    <Group transform={transform} opacity={focusOpacity}>
      <Circle cx={0} cy={0} r={rMain * 1.8} color={node.color} opacity={0.15} />
      <Circle cx={0} cy={0} r={rMain * 1.4} color={node.color} opacity={0.3} />
      <Circle cx={0} cy={0} r={rMain} color={node.color} />
      <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} opacity={selOpacity} />
    </Group>
  );
}, (prev, next) => prev.node.id === next.node.id);
