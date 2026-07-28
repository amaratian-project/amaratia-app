import React from 'react';
import { Group, Text as SkiaText } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import { MapNode } from '../../../types/canvas';

interface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  font: any;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

export const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition }: NodeLabelProps) => {
  if (!font) return null;

  const getRadius = (level: number) => {
    switch (level) {
      case 0: return 28;
      case 1: return 16;
      case 2: return 11;
      default: return 7;
    }
  };
  const nodeRadius = getRadius(node.level);
  const displayName = node.localName || node.alias;

  const finalOpacity = useDerivedValue(() => {
    const baseZoomOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);
    if (baseZoomOpacity === 0) return 0;
    
    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
    
    return baseZoomOpacity * focusMultiplier;
  });

  const transform = [{ translateX: node.pos.x }, { translateY: node.pos.y + nodeRadius + 14 }];
  const textWidth = font.getTextWidth(displayName);

  return (
    <Group transform={transform} opacity={finalOpacity}>
      <SkiaText x={-textWidth/2} y={1} text={displayName} font={font} color="rgba(0, 0, 0, 0.8)" />
      <SkiaText x={-textWidth/2} y={0} text={displayName} font={font} color="rgba(255, 255, 255, 0.7)" />
    </Group>
  );
}, (prev, next) => prev.node.id === next.node.id);
