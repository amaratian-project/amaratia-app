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
  animMode: SharedValue<number>;
}

export const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition, animMode }: NodeLabelProps) => {
  if (!font) return null;

  const getRadius = (level: number) => {
    if (level === -2) return 220;
    if (level === -1) return 90;
    switch (level) {
      case 0: return 28;
      case 1: return 16;
      case 2: return 11;
      default: return 7;
    }
  };
  const nodeRadius = getRadius(node.level);
  const fontScale = node.level === -2 ? 6.0 : (node.level === -1 ? 4.0 : 1);
  const displayName = node.localName || node.alias;

  const finalOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    const isConnectedToFocus = state.selected !== null && (state.selected === node.id || !!state.connected[node.id]);

    let baseZoomOpacity = 1;

    if (isConnectedToFocus && focusTransition.value > 0) {
      baseZoomOpacity = 1.0;
    } else if (node.level === -2) {
      baseZoomOpacity = Math.max(0, Math.min(1, (animMode.value - 2) * 2));
    } else if (node.level === -1) {
      if (animMode.value > 2) {
        baseZoomOpacity = 1.0 - (animMode.value - 2) * 0.8;
      } else {
        baseZoomOpacity = Math.max(0, Math.min(1, (animMode.value - 1) * 2));
      }
    } else {
      // Ciudadano: Desaparece completamente si pasamos a Nivel 2 (animMode >= 2)
      // En Nivel 1, también desaparece si el zoom es muy pequeño para evitar amontonamiento de texto
      const isLOD1 = animMode.value < 1.5;
      const citizenScaleOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);
      baseZoomOpacity = isLOD1 ? citizenScaleOpacity * (1.5 - animMode.value) * 2 : 0;
      baseZoomOpacity = Math.max(0, Math.min(1, baseZoomOpacity));
    }

    if (baseZoomOpacity === 0) return 0;

    if (!state.selected) return baseZoomOpacity;

    const isDimmed = !isConnectedToFocus;
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;

    return baseZoomOpacity * focusMultiplier;
  });

  const transform = [{ translateX: node.pos.x }, { translateY: node.pos.y + nodeRadius + 14 * fontScale }];
  const textWidth = font.getTextWidth(displayName);

  return (
    <Group transform={transform} opacity={finalOpacity}>
      <Group transform={[{ scale: fontScale }]}>
        <SkiaText x={-textWidth / 2} y={1} text={displayName} font={font} color="rgba(0, 0, 0, 0.8)" />
        <SkiaText x={-textWidth / 2} y={0} text={displayName} font={font} color="rgba(255, 255, 255, 0.7)" />
      </Group>
    </Group>
  );
}, (prev, next) => prev.node.id === next.node.id);
