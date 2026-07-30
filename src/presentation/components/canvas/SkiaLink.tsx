import React from 'react';
import { Group, Line, vec, DashPathEffect } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { MapLink } from '../../../types/canvas';

interface SkiaLinkProps {
  link: MapLink;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
  animMode: SharedValue<number>;
}

export const SkiaLink = React.memo(({ link, activeFocusState, focusTransition, animMode }: SkiaLinkProps) => {
  const p1 = vec(link.p1.x, link.p1.y);
  const p2 = vec(link.p2.x, link.p2.y);
  
  const focusOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    const isConnectedToFocus = state.selected !== null && (!!state.connected[link.sourceId] && !!state.connected[link.targetId]);

    // Cálculo base de LOD
    let baseLODOpacity = 1;
    if (isConnectedToFocus && focusTransition.value > 0) {
      // Si el enlace conecta nodos del ecosistema seleccionado, permanece 100% visible en cualquier zoom!
      baseLODOpacity = 1.0;
    } else if (link.type === 'MEMBERSHIP' || (link as any).type === 'PROVINCE_INTERCONNECT') {
      // Enlaces de Provincia (membresía o interconexión): visibles solo en LOD >= 2
      baseLODOpacity = Math.max(0, Math.min(1, animMode.value - 1));
    } else {
      // Trust link: atenúa en LOD >= 2
      baseLODOpacity = animMode.value >= 2 ? 0.2 : 1.0 - (animMode.value - 1) * 0.8;
      baseLODOpacity = Math.max(0.2, Math.min(1, baseLODOpacity));
    }

    if (!state.selected) return baseLODOpacity;
    const isDimmed = !isConnectedToFocus;
    const focusMultiplier = isDimmed ? 1 - (0.95 * focusTransition.value) : 1;
    return baseLODOpacity * focusMultiplier;
  });

  const isInterconnect = (link as any).type === 'PROVINCE_INTERCONNECT';
  const isMembership = link.type === 'MEMBERSHIP';

  return (
    <Group opacity={focusOpacity}>
      <Line 
        p1={p1} 
        p2={p2} 
        color={
          isInterconnect 
            ? '#ffffffaa' 
            : isMembership 
              ? '#f59e0b88' 
              : (link.isPrimary !== false ? `${link.color}33` : '#ffffff22')
        } 
        strokeWidth={isInterconnect ? 2 : (isMembership ? 3 : 2)}
      >
        {isInterconnect && <DashPathEffect intervals={[8, 8]} />}
        {!isMembership && !isInterconnect && link.isPrimary === false && <DashPathEffect intervals={[4, 6]} />}
      </Line>
    </Group>
  );
}, (prev, next) => prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);
