import React from 'react';
import { Group, Line, vec, DashPathEffect } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { MapLink } from '../../../types/canvas';

interface SkiaLinkProps {
  link: MapLink;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

export const SkiaLink = React.memo(({ link, activeFocusState, focusTransition }: SkiaLinkProps) => {
  const p1 = vec(link.p1.x, link.p1.y);
  const p2 = vec(link.p2.x, link.p2.y);
  
  const focusOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    if (!state.selected) return 1;
    const isDimmed = !(state.connected[link.sourceId] && state.connected[link.targetId]);
    return isDimmed ? 1 - (0.95 * focusTransition.value) : 1;
  });

  return (
    <Group opacity={focusOpacity}>
      <Line 
        p1={p1} 
        p2={p2} 
        color={link.isPrimary !== false ? `${link.color}33` : '#ffffff22'} 
        strokeWidth={2}
      >
        {link.isPrimary === false && <DashPathEffect intervals={[4, 6]} />}
      </Line>
    </Group>
  );
}, (prev, next) => prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);
