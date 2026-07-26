import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform } from 'react-native';
import { Canvas, Circle, Group, Line, vec, DashPathEffect, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';

const { width, height } = Dimensions.get('window');
const CENTER = vec(width / 2, height / 2);

interface MapNode {
  id: string;
  alias: string;
  localName?: string;
  merit: number;
  pos: { x: number; y: number };
  color: string;
  level: number;
  vx: number;
  vy: number;
}

interface MapLink {
  sourceId: string;
  targetId: string;
  level: number;
}

const PHYSICS_CONFIG = {
  ITERATIONS: 250, // Más iteraciones ya que es síncrono y hay menos nodos
  REPULSION: 30000, 
  REPULSION_SOFTENING: 300, 
  SPRING_K: 0.05, 
  RADIAL_SPRING_K: 0.08, 
  DAMPING: 0.6,
  MAX_VELOCITY: 50
};

interface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  font: any;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition }: NodeLabelProps) => {
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

  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const finalOpacity = useDerivedValue(() => {
    const baseZoomOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);
    if (baseZoomOpacity === 0) return 0;
    
    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
    
    return baseZoomOpacity * focusMultiplier;
  });

  const transform = useDerivedValue(() => [
    { translateX: posX.value }, 
    { translateY: posY.value + nodeRadius + 14 }
  ]);

  const textWidth = font.getTextWidth(displayName);

  return (
    <Group transform={transform} opacity={finalOpacity}>
      <SkiaText x={-textWidth/2} y={1} text={displayName} font={font} color="rgba(0, 0, 0, 0.8)" />
      <SkiaText x={-textWidth/2} y={0} text={displayName} font={font} color="rgba(255, 255, 255, 0.7)" />
    </Group>
  );
}, (prev, next) => prev.node.id === next.node.id);

interface SkiaNodeProps {
  node: MapNode;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaNode = React.memo(({ node, activeFocusState, focusTransition }: SkiaNodeProps) => {
  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const getRadius = (level: number) => {
    switch (level) {
      case 0: return { rMain: 28, rSel: 34 };
      case 1: return { rMain: 16, rSel: 22 }; 
      case 2: return { rMain: 11, rSel: 16 }; 
      case 3: default: return { rMain: 7, rSel: 11 }; 
    }
  };
  const { rMain, rSel } = getRadius(node.level);

  // En lugar de calcular cx/cy constantemente, aplicamos un transform matricial
  const transform = useDerivedValue(() => [{ translateX: posX.value }, { translateY: posY.value }]);
  
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

interface SkiaLinkProps {
  link: { sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaLink = React.memo(({ link, activeFocusState, focusTransition }: SkiaLinkProps) => {
  const p1X = useSharedValue(link.p1.x);
  const p1Y = useSharedValue(link.p1.y);
  const p2X = useSharedValue(link.p2.x);
  const p2Y = useSharedValue(link.p2.y);

  useEffect(() => {
    p1X.value = withSpring(link.p1.x);
    p1Y.value = withSpring(link.p1.y);
    p2X.value = withSpring(link.p2.x);
    p2Y.value = withSpring(link.p2.y);
  }, [link.p1.x, link.p1.y, link.p2.x, link.p2.y]);

  const p1 = useDerivedValue(() => vec(p1X.value, p1Y.value));
  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
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
        color={link.isPrimary !== false ? `${link.color}33` : '#ffffff22'} // Blanco muy tenue para secundarios
        strokeWidth={2} // Todas a 2px
      >
        {link.isPrimary === false && <DashPathEffect intervals={[4, 6]} />}
      </Line>
    </Group>
  );
}, (prev, next) => prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);

export const CanvasMap = () => {
  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../assets/Modelica-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Modelica-Bold.ttf'), 14);

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);
  
  const [nodeLimit, setNodeLimit] = useState(300);
  const [sliderVal, setSliderVal] = useState(300);

  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  // ESTADO 100% NATIVO PARA EL FOCUS MODE (CERO REACT RENDER)
  const activeFocusState = useSharedValue<{ selected: string | null, connected: Record<string, boolean> }>({ selected: null, connected: {} });
  const focusTransition = useSharedValue(0);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  const originFocalX = useSharedValue(0);
  const originFocalY = useSharedValue(0);

  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      await injectDummyTopology();
      const topology = await CitizenRepository.getHydratedCitizens();
      setFullTopology(topology);
    };
    fetchTopology();
  }, []);

  // 2. Ejecutar motor de físicas cuando cambie el límite o los datos
  useEffect(() => {
    if (!fullTopology) return;
    
    let isActive = true;
    const topology = fullTopology;
      
      let simLinks: MapLink[] = [];

      const nodeMap = new Map<string, MapNode>();

      topology.nodes.forEach(cit => {
        const colorByLevel = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'];
        nodeMap.set(cit.networkData.id, {
          id: cit.networkData.id,
          alias: cit.networkData.alias,
          localName: cit.localData.localName,
          merit: cit.networkData.merit,
          pos: { x: 0, y: 0 },
          color: colorByLevel[cit.level] || '#94a3b8',
          level: cit.level,
          vx: 0,
          vy: 0
        });
      });

      const mainNodes = topology.nodes.filter(n => n.level === 0);
      if (mainNodes.length === 0) {
        setIsLoading(false);
        return;
      }
      
      // Iniciar al maestro en el centro ANTES de crear los links para no perder la referencia de memoria
      const mainId = mainNodes[0].networkData.id;
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      const allSimNodes = Array.from(nodeMap.values()).slice(0, nodeLimit);
      const allowedIds = new Set(allSimNodes.map(n => n.id));
      
      const allSimLinks = topology.links
        .filter(l => allowedIds.has(l.sourceId) && allowedIds.has(l.targetId))
        .map(l => ({
          sourceId: l.sourceId,
          targetId: l.targetId,
          p1: nodeMap.get(l.sourceId)!.pos,
          p2: nodeMap.get(l.targetId)!.pos,
          level: l.level,
          color: nodeMap.get(l.targetId)!.color,
          isPrimary: false
        }));

      // 3. Generar Mapa de Hijos y detectar Enlaces Cruzados
      const childrenMap = new Map<string, string[]>();
      allSimNodes.forEach(n => childrenMap.set(n.id, []));
      
      const seenTargets = new Set<string>();
      // Ordenamos para priorizar los enlaces de nivel más bajo (más cercanos al centro) como primarios
      allSimLinks.sort((a, b) => a.level - b.level).forEach(l => {
        if (!seenTargets.has(l.targetId)) {
          l.isPrimary = true;
          seenTargets.add(l.targetId);
          childrenMap.get(l.sourceId)?.push(l.targetId);
        } else {
          l.isPrimary = false;
        }
      });

      // 4. Algoritmo de Estrella Fractal 360° (O(N)) sin físicas
      const nodeWeight = new Map<string, number>();
      const calculateWeight = (nodeId: string): number => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) {
          nodeWeight.set(nodeId, 1);
          return 1;
        }
        let weight = 0;
        children.forEach(childId => {
          weight += calculateWeight(childId);
        });
        nodeWeight.set(nodeId, weight);
        return weight;
      };
      calculateWeight(mainId);

      const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        // 1. Fractal Cónico: Solo el nivel 0 explota en 360°, el resto forma un abanico direccional
        const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle;
        let currentAngleStart = currentLevel === 0 ? 0 : directionAngle - actualSweep / 2;
        
        // 2. Phyllotaxis (Girasol): Si hay demasiados hijos en una misma rama, usamos el empaquetado botánico
        const useSunflower = children.length > 12 && currentLevel > 0;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          let finalAngle = 0;
          let finalRadius = 0;
          
          if (useSunflower) {
             const PHI = (1 + Math.sqrt(5)) / 2;
             const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1/PHI); // ~137.5 grados
             
             // Empaquetado denso que gira infinitamente usando el ángulo áureo
             finalAngle = directionAngle + (index * GOLDEN_ANGLE);
             
             // El radio crece proporcional a la raíz cuadrada del índice (Matemática real de los girasoles)
             const c = currentLevel === 1 ? 25 : 15; // Factor de espaciado
             const startMargin = currentLevel === 1 ? 40 : 25; // Hueco central para el padre
             finalRadius = startMargin + c * Math.sqrt(index + 1);
          } else {
             const weight = nodeWeight.get(childId) || 1;
             const sliceAngle = (weight / totalWeight) * actualSweep;

             const myAngleStart = currentAngleStart;
             const myAngleEnd = currentAngleStart + sliceAngle;
             
             const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
             const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
             finalAngle = baseCenterAngle + angleJitter;
             
             let baseRadius = branchLengths[currentLevel + 1] || 40;
             if (currentLevel === 0) {
               baseRadius = 250 + (index % 5) * 150; // Escalonamiento de brazos principales
             } else if (currentLevel === 1) {
               baseRadius = 120 + (index % 3) * 40;
             }
             
             const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
             finalRadius = baseRadius + radiusStagger;
             
             currentAngleStart = myAngleEnd;
          }

          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Propagar: El siguiente nivel usa un abanico más estrecho para no chocar con las ramas vecinas
          const childSweep = currentLevel === 0 ? Math.PI * 1.5 : Math.PI * 0.8;
          distributeStarNodes(childId, childNode.pos, finalAngle, childSweep, currentLevel + 1);
        });
      };

      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);

      // 4.5 Jiggle de Relajación (Micro-Físicas de Colisión para evitar amontonamientos perfectos)
      const MIN_DIST = 25; // Distancia mínima segura entre centros
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < allSimNodes.length; i++) {
          for (let j = i + 1; j < allSimNodes.length; j++) {
            const n1 = allSimNodes[i];
            const n2 = allSimNodes[j];
            if (n1.level === 0 || n2.level === 0) continue; // El centro no se mueve
            
            const dx = n2.pos.x - n1.pos.x;
            const dy = n2.pos.y - n1.pos.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > 0 && distSq < MIN_DIST * MIN_DIST) {
              const dist = Math.sqrt(distSq);
              const overlap = MIN_DIST - dist;
              const pushX = (dx / dist) * (overlap * 0.5);
              const pushY = (dy / dist) * (overlap * 0.5);
              
              n1.pos.x -= pushX; n1.pos.y -= pushY;
              n2.pos.x += pushX; n2.pos.y += pushY;
            }
          }
        }
      }

      let maxR = 0;
      allSimNodes.forEach(n => {
        const dx = n.pos.x - CENTER.x;
        const dy = n.pos.y - CENTER.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) maxR = dist;
      });
      // Añadimos 50px de margen extra alrededor de los nodos más lejanos
      setBounds({ R: maxR + 50 });

      // 5. Aplicar al Estado Visual
      setNodes([...allSimNodes]);
      setLinks([...allSimLinks]);
      setIsLoading(false);
  }, [fullTopology, nodeLimit]);

  const [bounds, setBounds] = useState({ R: 1000 });

  const MIN_SCALE = Math.max(0.05, Math.min(width, height) / (bounds.R * 2.5)); // Zoom out generoso
  const MAX_SCALE = 4.0; // Zoom in profundo para interactuar cómodamente con las hojas fucsias

  const panGesture = Gesture.Pan()
    .maxPointers(1) // EXCLUSIVIDAD: Solo un dedo permite el paneo.
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const panLimitX = Math.max(0, bounds.R * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, bounds.R * scale.value - height / 2 + 100);
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica dura (15%) si se pasa del límite
      if (nextX > panLimitX) nextX = panLimitX + (nextX - panLimitX) * 0.15;
      if (nextX < -panLimitX) nextX = -panLimitX + (nextX + panLimitX) * 0.15;
      if (nextY > panLimitY) nextY = panLimitY + (nextY - panLimitY) * 0.15;
      if (nextY < -panLimitY) nextY = -panLimitY + (nextY + panLimitY) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      const panLimitX = Math.max(0, bounds.R * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, bounds.R * scale.value - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin((e) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      originFocalX.value = e.focalX;
      originFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      let nextScale = savedScale.value * e.scale;
      
      // Resistencia elástica dura (15%) si se pasa del límite
      if (nextScale > MAX_SCALE) {
        nextScale = MAX_SCALE + (nextScale - MAX_SCALE) * 0.15;
      } else if (nextScale < MIN_SCALE) {
        nextScale = MIN_SCALE - (MIN_SCALE - nextScale) * 0.15;
      }
      scale.value = nextScale;

      // Magia de Focal Zoom: Compensar el paneo basándonos en cuánto creció la escala
      const adjustedFocalX = originFocalX.value - width / 2;
      const adjustedFocalY = originFocalY.value - height / 2;
      const scaleRatio = nextScale / savedScale.value;

      translateX.value = savedTranslateX.value * scaleRatio + adjustedFocalX * (1 - scaleRatio);
      translateY.value = savedTranslateY.value * scaleRatio + adjustedFocalY * (1 - scaleRatio);
    })
    .onEnd(() => {
      let finalScale = scale.value;
      if (scale.value < MIN_SCALE) {
        finalScale = MIN_SCALE;
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        finalScale = MAX_SCALE;
        scale.value = withSpring(MAX_SCALE);
      }

      // Si al terminar de hacer zoom, la cámara quedó "fuera de los límites" (porque el grafo encogió), 
      // forzamos a la cámara a regresar al límite del nuevo tamaño del grafo con un resorte.
      const panLimitX = Math.max(0, bounds.R * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, bounds.R * finalScale - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });

  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      Vibration.vibrate(50);
      const connected: Record<string, boolean> = {};
      connected[node.id] = true;
      links.forEach(l => {
        if (l.sourceId === node.id) connected[l.targetId] = true;
        if (l.targetId === node.id) connected[l.sourceId] = true;
      });
      activeFocusState.value = { selected: node.id, connected };
      focusTransition.value = withTiming(1, { duration: 300 });
    } else {
      activeFocusState.value = { selected: null, connected: {} };
      focusTransition.value = withTiming(0, { duration: 300 });
    }
    
    // Solo dispara re-render en React para mostrar el cuadro de información en la parte inferior, 
    // pero los componentes Skia no se reconciliarán (gracias al React.memo sin props booleanas)
    setSelectedNode(node);
  };

  const tapGesture = Gesture.Tap()
    .maxDistance(10) // EXCLUSIVIDAD: Si el dedo se mueve más de 10px, se cancela el tap.
    .runOnJS(true) // <-- Evita que 'nodes' se serialice al hilo de UI y choque con el motor de físicas
    .onEnd((e) => {
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      let foundNode = null;
      let minDistance = Infinity;
      // Hitbox semántico: 40px fijos en pantalla. 
      // Al hacer zoom out (scale < 1) necesitas abarcar más espacio del mundo (ej: 40/0.5 = 80px en el mundo)
      const dynamicHitbox = 40 / scale.value;
      
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Nearest Absolute: Seleccionamos estrictamente el más cercano al centro de la huella
        if (distance <= dynamicHitbox && distance < minDistance) { 
          minDistance = distance;
          foundNode = node;
        }
      }

      runOnJS(handleNodeSelection)(foundNode);
    });

  const composed = Gesture.Exclusive(panGesture, pinchGesture, tapGesture);

  const globalTransform = useDerivedValue(() => {
    return [
      { translateX: CENTER.x + translateX.value },
      { translateY: CENTER.y + translateY.value },
      { scale: scale.value },
      { translateX: -CENTER.x },
      { translateY: -CENTER.y },
    ];
  });

  if (isLoading || !fontNormal || !fontBold) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  const debugPan = Gesture.Pan()
    .onUpdate((e) => {
      // Mapeo simple: 0px a 200px = 0 a 300 nodos
      let newVal = Math.floor((e.x / 200) * 300);
      newVal = Math.max(1, Math.min(300, newVal));
      runOnJS(setSliderVal)(newVal);
    })
    .onEnd((e) => {
      let newVal = Math.floor((e.x / 200) * 300);
      newVal = Math.max(1, Math.min(300, newVal));
      runOnJS(setNodeLimit)(newVal);
    });

  return (
    <View style={styles.container}>
      {/* DEBUGER UI (Temporal) */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 10 }}>
        <Text style={{ color: 'white', marginBottom: 5 }}>Nodos: {sliderVal}</Text>
        <GestureDetector gesture={debugPan}>
          <View style={{ width: 200, height: 40, backgroundColor: '#333', justifyContent: 'center' }}>
            <View style={{ width: (sliderVal / 300) * 200, height: 40, backgroundColor: '#06b6d4', opacity: 0.5 }} />
          </View>
        </GestureDetector>
        <Text style={{ color: '#aaa', fontSize: 10, marginTop: 5 }}>Desliza para ajustar</Text>
      </View>

      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={globalTransform}>
        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => {
          return <SkiaLink key={`link-${index}`} link={link} activeFocusState={activeFocusState} focusTransition={focusTransition} />;
        })}
        {/* Nodos por encima */}
        {nodes.map(node => {
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}
        {/* Textos por encima de los nodos */}
        {nodes.map(node => {
          const font = node.level === 0 ? fontBold : fontNormal;
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={scale} 
              font={font}
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => Logger.log('Ver perfil de', selectedNode.id)}
          onUpdateLocalName={(newName) => {
            // Actualizar el estado local para reflejar el cambio instantáneamente en el mapa
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  }
});
