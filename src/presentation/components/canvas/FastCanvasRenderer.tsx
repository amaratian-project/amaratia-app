import React, { useMemo } from 'react';
import { Group, Path, Circle, SkFont, Skia, PaintStyle, SkPath } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import { MapNode, MapLink } from '../../../types/canvas';

export const PALETTE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#94a3b8'];

export interface OverlayClusterPaths {
  linksCause: SkPath;
  linksInter: SkPath;
  linksMemb: SkPath;
  linksCross: SkPath;
  linksPrimary: Record<string, SkPath>;

  halos1: Record<string, SkPath>;
  halos2: Record<string, SkPath>;
  bodies: Record<string, SkPath>;

  strokesL0: SkPath;
  strokesLN1: SkPath;
  strokesLN2: SkPath;

  texts: SkPath;
  textsShadow: SkPath;

  selectedNode: {
    x: number;
    y: number;
    rMain: number;
    rSel: number;
    level: number;
    color: string;
  };
}

export interface FastCanvasRendererProps {
  nodes: MapNode[];
  links: MapLink[];
  overlayClusterData: SharedValue<OverlayClusterPaths | null>;
  focusTransition: SharedValue<number>;
  animMode: SharedValue<number>;
  fontBold: SkFont | null;
  scale: SharedValue<number>;
}

export const getRadius = (level: number) => {
  if (level === -2) return { rMain: 220, rSel: 250 };
  if (level === -1) return { rMain: 90, rSel: 120 };
  switch (level) {
    case 0: return { rMain: 28, rSel: 34 };
    case 1: return { rMain: 16, rSel: 22 };
    case 2: return { rMain: 11, rSel: 16 };
    case 3: default: return { rMain: 7, rSel: 11 };
  }
};

/**
 * Genera de forma síncrona (< 0.05ms) todos los Skia.Paths de la rama seleccionada
 * (incluyendo textos vectorizados de TODOS los nodos de la rama sin límite de cantidad)
 * para colocarlos en un SharedValue y renderizarlos en el Frame 0 de la GPU.
 */
export function buildOverlayCluster(
  selectedNode: MapNode,
  allNodes: MapNode[],
  allLinks: MapLink[],
  fontBold: SkFont | null
): OverlayClusterPaths {
  const nodeMap = new Map<string, MapNode>();
  allNodes.forEach(n => nodeMap.set(n.id, n));

  const halos1: Record<string, any> = {};
  const halos2: Record<string, any> = {};
  const bodies: Record<string, any> = {};
  const linksPrimary: Record<string, any> = {};

  PALETTE_COLORS.forEach(c => {
    halos1[c] = Skia.Path.Make();
    halos2[c] = Skia.Path.Make();
    bodies[c] = Skia.Path.Make();
    linksPrimary[c] = Skia.Path.Make();
  });

  const strokesL0 = Skia.Path.Make();
  const strokesLN1 = Skia.Path.Make();
  const strokesLN2 = Skia.Path.Make();

  const linksCause = Skia.Path.Make();
  const linksInter = Skia.Path.Make();
  const linksMemb = Skia.Path.Make();
  const linksCross = Skia.Path.Make();

  const texts = Skia.Path.Make();
  const textsShadow = Skia.Path.Make();

  const addNodeToCluster = (n: MapNode) => {
    const { rMain } = getRadius(n.level);
    const c = PALETTE_COLORS.includes(n.color) ? n.color : '#94a3b8';

    halos1[c].addCircle(n.pos.x, n.pos.y, rMain * 1.8);
    halos2[c].addCircle(n.pos.x, n.pos.y, rMain * 1.4);
    bodies[c].addCircle(n.pos.x, n.pos.y, rMain);

    if (n.level === 0) strokesL0.addCircle(n.pos.x, n.pos.y, rMain);
    else if (n.level === -1) strokesLN1.addCircle(n.pos.x, n.pos.y, rMain);
    else if (n.level === -2) strokesLN2.addCircle(n.pos.x, n.pos.y, rMain);

    // Renderizado vectorial de texto ultra-rápido (GPU pura, sin límites de slots)
    if (fontBold) {
      const fontScale = n.level === -2 ? 6.0 : (n.level === -1 ? 4.0 : 1.0);
      const displayName = n.localName || n.alias;
      const textWidth = fontBold.getTextWidth(displayName);
      const x = n.pos.x;
      const y = n.pos.y + rMain + 14 * fontScale;

      const rawPath = Skia.Path.MakeFromText(displayName, 0, 0, fontBold);
      if (rawPath) {
        const m = Skia.Matrix().translate(x - (textWidth * fontScale) / 2, y).scale(fontScale, fontScale);
        const transformed = Skia.Path.Make();
        transformed.addPath(rawPath, m);
        texts.addPath(transformed);

        const mShadow = Skia.Matrix().translate(x - (textWidth * fontScale) / 2, y + 1).scale(fontScale, fontScale);
        const transformedShadow = Skia.Path.Make();
        transformedShadow.addPath(rawPath, mShadow);
        textsShadow.addPath(transformedShadow);
      }
    }
  };

  // 1. Agregar el nodo seleccionado
  addNodeToCluster(selectedNode);

  // 2. Encontrar enlaces de la rama y nodos conectados
  const connectedNodeIds = new Set<string>();

  allLinks.forEach((l: any) => {
    const isConn = l.sourceId === selectedNode.id || l.targetId === selectedNode.id;
    if (!isConn) return;

    const otherId = l.sourceId === selectedNode.id ? l.targetId : l.sourceId;
    connectedNodeIds.add(otherId);

    if (l.type === 'PROVINCE_TO_CAUSE') {
      linksCause.moveTo(l.p1.x, l.p1.y); linksCause.lineTo(l.p2.x, l.p2.y);
    } else if (l.type === 'PROVINCE_INTERCONNECT') {
      linksInter.moveTo(l.p1.x, l.p1.y); linksInter.lineTo(l.p2.x, l.p2.y);
    } else if (l.type === 'MEMBERSHIP') {
      linksMemb.moveTo(l.p1.x, l.p1.y); linksMemb.lineTo(l.p2.x, l.p2.y);
    } else if (l.isPrimary === false) {
      linksCross.moveTo(l.p1.x, l.p1.y); linksCross.lineTo(l.p2.x, l.p2.y);
    } else {
      const c = PALETTE_COLORS.includes(l.color) ? l.color : '#3b82f6';
      linksPrimary[c].moveTo(l.p1.x, l.p1.y); linksPrimary[c].lineTo(l.p2.x, l.p2.y);
    }
  });

  // 3. Agregar todos los nodos conectados (sin límite)
  connectedNodeIds.forEach(id => {
    const neighbor = nodeMap.get(id);
    if (neighbor) addNodeToCluster(neighbor);
  });

  const { rMain, rSel } = getRadius(selectedNode.level);

  return {
    halos1,
    halos2,
    bodies,
    strokesL0,
    strokesLN1,
    strokesLN2,
    linksCause,
    linksInter,
    linksMemb,
    linksCross,
    linksPrimary,
    texts,
    textsShadow,
    selectedNode: {
      x: selectedNode.pos.x,
      y: selectedNode.pos.y,
      rMain,
      rSel,
      level: selectedNode.level,
      color: selectedNode.color,
    }
  };
}

// Capa de nivel estática agrupada en Skia Paths (cero worklets individuales, 120 FPS)
const StaticLevelLayer = React.memo(({
  level,
  staticPath,
  halo1Path,
  halo2Path,
  textPath,
  textShadowPath,
  color,
  animMode,
  unfocusedMultiplier,
  scale
}: any) => {
  const baseLODOpacity = useDerivedValue(() => {
    let opacity = 1;
    if (level === -2) {
      opacity = Math.max(0, Math.min(1, (animMode.value - 2) * 2));
    } else if (level === -1) {
      if (animMode.value > 2) opacity = 1.0 - (animMode.value - 2) * 0.8;
      else opacity = Math.max(0, Math.min(1, (animMode.value - 1) * 2));
    } else {
      opacity = animMode.value >= 2 ? 0.2 : 1.0 - (animMode.value - 1) * 0.8;
      opacity = Math.max(0.2, Math.min(1, opacity));
    }
    return opacity * unfocusedMultiplier.value;
  });

  const textOpacity = useDerivedValue(() => {
    let base = baseLODOpacity.value;
    if (level >= 0) {
      const isLOD1 = animMode.value < 1.5;
      const citizenScaleOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);
      base = isLOD1 ? citizenScaleOpacity * (1.5 - animMode.value) * 2 * unfocusedMultiplier.value : 0;
      base = Math.max(0, Math.min(1, base));
    }
    return base;
  });

  const oHalo1 = useDerivedValue(() => baseLODOpacity.value * 0.15);
  const oHalo2 = useDerivedValue(() => baseLODOpacity.value * 0.3);

  return (
    <Group>
      <Group opacity={oHalo1}><Path path={halo1Path} color={color} /></Group>
      <Group opacity={oHalo2}><Path path={halo2Path} color={color} /></Group>

      <Group opacity={baseLODOpacity}>
        <Path path={staticPath} color={color} />
        {level === 0 && <Path path={staticPath} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.3)" />}
        {level === -1 && <Path path={staticPath} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.4)" />}
        {level === -2 && <Path path={staticPath} style="stroke" strokeWidth={3} color="rgba(255,255,255,0.6)" />}
      </Group>

      {textPath && (
        <Group opacity={textOpacity}>
          <Path path={textShadowPath} color="rgba(0, 0, 0, 0.8)" />
          <Path path={textPath} color="rgba(255, 255, 255, 0.7)" />
        </Group>
      )}
    </Group>
  );
});

export const FastCanvasRenderer = React.memo(({
  nodes,
  links,
  overlayClusterData,
  focusTransition,
  animMode,
  fontBold,
  scale
}: FastCanvasRendererProps) => {

  // ═══════════════════════════════════════════════════════════════
  // 1. BASE ESTÁTICA INMUTABLE EN SKIA PATHS AGRUPADOS
  //    Compilada UNA sola vez. Totalmente libre de worklets por nodo.
  // ═══════════════════════════════════════════════════════════════
  const staticData = useMemo(() => {
    const levels = new Map<number, {
      path: any;
      halo1: any;
      halo2: any;
      textPath: any;
      textShadowPath: any;
      color: string;
    }>();

    nodes.forEach(n => {
      if (!levels.has(n.level)) {
        levels.set(n.level, {
          path: Skia.Path.Make(),
          halo1: Skia.Path.Make(),
          halo2: Skia.Path.Make(),
          textPath: Skia.Path.Make(),
          textShadowPath: Skia.Path.Make(),
          color: n.color
        });
      }
      const layer = levels.get(n.level)!;
      const { rMain } = getRadius(n.level);
      layer.path.addCircle(n.pos.x, n.pos.y, rMain);
      layer.halo1.addCircle(n.pos.x, n.pos.y, rMain * 1.8);
      layer.halo2.addCircle(n.pos.x, n.pos.y, rMain * 1.4);

      if (fontBold) {
        const fontScale = n.level === -2 ? 6.0 : (n.level === -1 ? 4.0 : 1.0);
        const displayName = n.localName || n.alias;
        const textWidth = fontBold.getTextWidth(displayName);
        const x = n.pos.x;
        const y = n.pos.y + rMain + 14 * fontScale;

        const rawPath = Skia.Path.MakeFromText(displayName, 0, 0, fontBold);
        if (rawPath) {
          const m = Skia.Matrix().translate(x - (textWidth * fontScale) / 2, y).scale(fontScale, fontScale);
          const transformed = Skia.Path.Make();
          transformed.addPath(rawPath, m);
          layer.textPath.addPath(transformed);

          const mShadow = Skia.Matrix().translate(x - (textWidth * fontScale) / 2, y + 1).scale(fontScale, fontScale);
          const transformedShadow = Skia.Path.Make();
          transformedShadow.addPath(rawPath, mShadow);
          layer.textShadowPath.addPath(transformedShadow);
        }
      }
    });

    const linksCause = Skia.Path.Make();
    const linksInter = Skia.Path.Make();
    const linksMemb = Skia.Path.Make();
    const linksCross = Skia.Path.Make();
    const linksPrimary = new Map<string, any>();

    links.forEach((l: any) => {
      if (l.type === 'PROVINCE_TO_CAUSE') {
        linksCause.moveTo(l.p1.x, l.p1.y); linksCause.lineTo(l.p2.x, l.p2.y);
      } else if (l.type === 'PROVINCE_INTERCONNECT') {
        linksInter.moveTo(l.p1.x, l.p1.y); linksInter.lineTo(l.p2.x, l.p2.y);
      } else if (l.type === 'MEMBERSHIP') {
        linksMemb.moveTo(l.p1.x, l.p1.y); linksMemb.lineTo(l.p2.x, l.p2.y);
      } else if (l.isPrimary === false) {
        linksCross.moveTo(l.p1.x, l.p1.y); linksCross.lineTo(l.p2.x, l.p2.y);
      } else {
        const c = l.color || '#3b82f6';
        if (!linksPrimary.has(c)) linksPrimary.set(c, Skia.Path.Make());
        linksPrimary.get(c)!.moveTo(l.p1.x, l.p1.y); linksPrimary.get(c)!.lineTo(l.p2.x, l.p2.y);
      }
    });

    return {
      levels: Array.from(levels.entries()),
      links: {
        cause: linksCause,
        inter: linksInter,
        memb: linksMemb,
        cross: linksCross,
        primary: Array.from(linksPrimary.entries())
      }
    };
  }, [nodes, links, fontBold]);

  // ═══════════════════════════════════════════════════════════════
  // 2. ATENUACIÓN DEL FONDO (GPU pura, 4 useDerivedValues en total)
  // ═══════════════════════════════════════════════════════════════
  const unfocusedMultiplier = useDerivedValue(() => {
    return 1 - (0.85 * focusTransition.value);
  });

  const linkOpacities = useDerivedValue(() => {
    let causeLOD = Math.max(0, Math.min(1, animMode.value - 2));
    let provLOD = animMode.value > 2 ? 1.0 - (animMode.value - 2) * 0.8 : Math.max(0, Math.min(1, (animMode.value - 1) * 2));
    let citLOD = Math.max(0.2, Math.min(1, animMode.value >= 2 ? 0.2 : 1.0 - (animMode.value - 1) * 0.8));
    return {
      cause: causeLOD * unfocusedMultiplier.value,
      prov: provLOD * unfocusedMultiplier.value,
      cit: citLOD * unfocusedMultiplier.value
    };
  });

  const oCause = useDerivedValue(() => linkOpacities.value.cause);
  const oProv = useDerivedValue(() => linkOpacities.value.prov);
  const oCit = useDerivedValue(() => linkOpacities.value.cit);

  // Halos del overlay
  const oOverlayHalo1 = useDerivedValue(() => focusTransition.value * 0.15 * 0.85);
  const oOverlayHalo2 = useDerivedValue(() => focusTransition.value * 0.30 * 0.85);
  const branchOpacity = useDerivedValue(() => focusTransition.value);

  // Opacidad del texto del overlay: Se complementa con la atenuación del fondo (1 - 0.85*t + 0.85*t = 1.0 constante)
  const overlayTextOpacity = useDerivedValue(() => {
    return focusTransition.value * 0.85;
  });

  // Pinturas cacheadas para enlaces
  const dashEffectCause = useMemo(() => Skia.PathEffect.MakeDash([8, 8]), []);
  const dashEffectCross = useMemo(() => Skia.PathEffect.MakeDash([4, 6]), []);

  const paintCause = useMemo(() => { const p = Skia.Paint(); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(3); p.setColor(Skia.Color('#ec4899aa')); p.setPathEffect(dashEffectCause); return p; }, [dashEffectCause]);
  const paintInter = useMemo(() => { const p = Skia.Paint(); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(2); p.setColor(Skia.Color('#ffffffaa')); p.setPathEffect(dashEffectCause); return p; }, [dashEffectCause]);
  const paintMemb = useMemo(() => { const p = Skia.Paint(); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(3); p.setColor(Skia.Color('#f59e0b88')); return p; }, []);
  const paintCross = useMemo(() => { const p = Skia.Paint(); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(2); p.setColor(Skia.Color('#ffffff22')); p.setPathEffect(dashEffectCross); return p; }, [dashEffectCross]);
  const paintPrimary = useMemo(() => {
    const cache = new Map<string, any>();
    return (color: string) => {
      if (!cache.has(color)) {
        const p = Skia.Paint(); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(2); p.setColor(Skia.Color(`${color}33`)); cache.set(color, p);
      }
      return cache.get(color);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 3. OVERLAY GPU INSTANTÁNEO (SharedValues puros, Frame 0)
  // ═══════════════════════════════════════════════════════════════
  const emptyPath = useMemo(() => Skia.Path.Make(), []);

  // Links
  const pLinksCause = useDerivedValue(() => overlayClusterData.value?.linksCause ?? emptyPath);
  const pLinksInter = useDerivedValue(() => overlayClusterData.value?.linksInter ?? emptyPath);
  const pLinksMemb = useDerivedValue(() => overlayClusterData.value?.linksMemb ?? emptyPath);
  const pLinksCross = useDerivedValue(() => overlayClusterData.value?.linksCross ?? emptyPath);

  const pPrimary_green = useDerivedValue(() => overlayClusterData.value?.linksPrimary['#10b981'] ?? emptyPath);
  const pPrimary_blue = useDerivedValue(() => overlayClusterData.value?.linksPrimary['#3b82f6'] ?? emptyPath);
  const pPrimary_amber = useDerivedValue(() => overlayClusterData.value?.linksPrimary['#f59e0b'] ?? emptyPath);
  const pPrimary_pink = useDerivedValue(() => overlayClusterData.value?.linksPrimary['#ec4899'] ?? emptyPath);
  const pPrimary_gray = useDerivedValue(() => overlayClusterData.value?.linksPrimary['#94a3b8'] ?? emptyPath);

  // Halos 1.8x
  const pHalo1_green = useDerivedValue(() => overlayClusterData.value?.halos1['#10b981'] ?? emptyPath);
  const pHalo1_blue = useDerivedValue(() => overlayClusterData.value?.halos1['#3b82f6'] ?? emptyPath);
  const pHalo1_amber = useDerivedValue(() => overlayClusterData.value?.halos1['#f59e0b'] ?? emptyPath);
  const pHalo1_pink = useDerivedValue(() => overlayClusterData.value?.halos1['#ec4899'] ?? emptyPath);
  const pHalo1_gray = useDerivedValue(() => overlayClusterData.value?.halos1['#94a3b8'] ?? emptyPath);

  // Halos 1.4x
  const pHalo2_green = useDerivedValue(() => overlayClusterData.value?.halos2['#10b981'] ?? emptyPath);
  const pHalo2_blue = useDerivedValue(() => overlayClusterData.value?.halos2['#3b82f6'] ?? emptyPath);
  const pHalo2_amber = useDerivedValue(() => overlayClusterData.value?.halos2['#f59e0b'] ?? emptyPath);
  const pHalo2_pink = useDerivedValue(() => overlayClusterData.value?.halos2['#ec4899'] ?? emptyPath);
  const pHalo2_gray = useDerivedValue(() => overlayClusterData.value?.halos2['#94a3b8'] ?? emptyPath);

  // Cuerpos
  const pBody_green = useDerivedValue(() => overlayClusterData.value?.bodies['#10b981'] ?? emptyPath);
  const pBody_blue = useDerivedValue(() => overlayClusterData.value?.bodies['#3b82f6'] ?? emptyPath);
  const pBody_amber = useDerivedValue(() => overlayClusterData.value?.bodies['#f59e0b'] ?? emptyPath);
  const pBody_pink = useDerivedValue(() => overlayClusterData.value?.bodies['#ec4899'] ?? emptyPath);
  const pBody_gray = useDerivedValue(() => overlayClusterData.value?.bodies['#94a3b8'] ?? emptyPath);

  // Bordes
  const pStrokesL0 = useDerivedValue(() => overlayClusterData.value?.strokesL0 ?? emptyPath);
  const pStrokesLN1 = useDerivedValue(() => overlayClusterData.value?.strokesLN1 ?? emptyPath);
  const pStrokesLN2 = useDerivedValue(() => overlayClusterData.value?.strokesLN2 ?? emptyPath);

  // Textos del overlay (Vector Path GPU)
  const pOverlayTexts = useDerivedValue(() => overlayClusterData.value?.texts ?? emptyPath);
  const pOverlayTextsShadow = useDerivedValue(() => overlayClusterData.value?.textsShadow ?? emptyPath);

  // Anillo de selección blanco
  const selRingTransform = useDerivedValue(() => {
    const sn = overlayClusterData.value?.selectedNode;
    if (!sn) return [{ translateX: 0 }, { translateY: 0 }];
    return [{ translateX: sn.x }, { translateY: sn.y }];
  });

  const selRingR = useDerivedValue(() => overlayClusterData.value?.selectedNode.rSel ?? 0);
  const selRingStrokeWidth = useDerivedValue(() => {
    const sn = overlayClusterData.value?.selectedNode;
    return sn && sn.level < 0 ? 8 : 2;
  });

  const ringOpacity = useDerivedValue(() => {
    if (!overlayClusterData.value) return 0;
    return focusTransition.value;
  });

  return (
    <Group>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CAPA 1: MAPA BASE ESTÁTICO (Paths Compilados, 120 FPS)     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Group opacity={oCause}><Path path={staticData.links.cause} paint={paintCause} /></Group>
      <Group opacity={oProv}><Path path={staticData.links.inter} paint={paintInter} /></Group>
      <Group opacity={oProv}><Path path={staticData.links.memb} paint={paintMemb} /></Group>
      <Group opacity={oCit}><Path path={staticData.links.cross} paint={paintCross} /></Group>
      {staticData.links.primary.map(([color, path]) => (
        <Group key={`base-p-${color}`} opacity={oCit}><Path path={path} paint={paintPrimary(color)} /></Group>
      ))}

      {staticData.levels.map(([level, data]) => (
        <StaticLevelLayer
          key={`base-level-${level}`}
          level={level}
          staticPath={data.path}
          halo1Path={data.halo1}
          halo2Path={data.halo2}
          textPath={data.textPath}
          textShadowPath={data.textShadowPath}
          color={data.color}
          animMode={animMode}
          unfocusedMultiplier={unfocusedMultiplier}
          scale={scale}
        />
      ))}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CAPA 2: OVERLAY GPU DE LA RAMA ENFOCADA (Frame 0)          */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* 1. Líneas de la rama enfocada */}
      <Group opacity={branchOpacity}>
        <Path path={pLinksCause} paint={paintCause} />
        <Path path={pLinksInter} paint={paintInter} />
        <Path path={pLinksMemb} paint={paintMemb} />
        <Path path={pLinksCross} paint={paintCross} />
        <Path path={pPrimary_green} paint={paintPrimary('#10b981')} />
        <Path path={pPrimary_blue} paint={paintPrimary('#3b82f6')} />
        <Path path={pPrimary_amber} paint={paintPrimary('#f59e0b')} />
        <Path path={pPrimary_pink} paint={paintPrimary('#ec4899')} />
        <Path path={pPrimary_gray} paint={paintPrimary('#94a3b8')} />
      </Group>

      {/* 2. Aros decorativos transparentes (Halos 1.8x y 1.4x) de la rama */}
      <Group opacity={oOverlayHalo1}>
        <Path path={pHalo1_green} color="#10b981" />
        <Path path={pHalo1_blue} color="#3b82f6" />
        <Path path={pHalo1_amber} color="#f59e0b" />
        <Path path={pHalo1_pink} color="#ec4899" />
        <Path path={pHalo1_gray} color="#94a3b8" />
      </Group>
      <Group opacity={oOverlayHalo2}>
        <Path path={pHalo2_green} color="#10b981" />
        <Path path={pHalo2_blue} color="#3b82f6" />
        <Path path={pHalo2_amber} color="#f59e0b" />
        <Path path={pHalo2_pink} color="#ec4899" />
        <Path path={pHalo2_gray} color="#94a3b8" />
      </Group>

      {/* 3. Cuerpos sólidos de los nodos (100% de brillo fijo) */}
      <Group>
        <Path path={pBody_green} color="#10b981" />
        <Path path={pBody_blue} color="#3b82f6" />
        <Path path={pBody_amber} color="#f59e0b" />
        <Path path={pBody_pink} color="#ec4899" />
        <Path path={pBody_gray} color="#94a3b8" />

        {/* Bordes de nivel */}
        <Path path={pStrokesL0} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.3)" />
        <Path path={pStrokesLN1} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.4)" />
        <Path path={pStrokesLN2} style="stroke" strokeWidth={3} color="rgba(255,255,255,0.6)" />
      </Group>

      {/* 4. Anillo blanco animado en el nodo seleccionado */}
      <Group opacity={ringOpacity} transform={selRingTransform}>
        <Circle cx={0} cy={0} r={selRingR} color="#ffffff" style="stroke" strokeWidth={selRingStrokeWidth} />
      </Group>

      {/* 5. Textos vectorizados de la rama (Ilimitados, Frame 0 GPU pura) */}
      <Group opacity={overlayTextOpacity}>
        <Path path={pOverlayTextsShadow} color="rgba(0, 0, 0, 0.8)" />
        <Path path={pOverlayTexts} color="rgba(255, 255, 255, 0.7)" />
      </Group>
    </Group>
  );
});
