# ENTIRE HISTORY OF CHANGES TO CanvasMap.tsx\n\n## Step 268 - write_to_file\nInstruction: Lienzo Topológico interactivo con React Native Skia\nWRITE ENTIRE FILE (Omitted for brevity)\n\n---\n\n## Step 847 - replace_file_content\nInstruction: Rewrite CanvasMap to use dynamic data and Polar Coordinates\n### Target (Chunk 1)\n```tsx\nimport React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Line, vec, Paint, BlurMask } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const CENTER = vec(width / 2, height / 2);

export const CanvasMap = () => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pan gesture para mover el mapa
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Pinch gesture para hacer zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  // Simulación de Nodos del 1er y 2do anillo
  const nodes = [
    { pos: vec(CENTER.x - 80, CENTER.y - 100), color: '#3b82f6' },
    { pos: vec(CENTER.x + 100, CENTER.y - 60), color: '#3b82f6' },
    { pos: vec(CENTER.x - 40, CENTER.y + 120), color: '#3b82f6' },
    { pos: vec(CENTER.x + 120, CENTER.y + 80), color: '#3b82f6' },
  ];

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Canvas style={styles.canvas}>
            {/* Conexiones */}
            {nodes.map((node, i) => (
              <Line 
                key={`line-${i}`}
                p1={CENTER} 
                p2={node.pos} 
                color="rgba(255, 255, 255, 0.2)" 
                strokeWidth={2} 
              />
            ))}

            {/* Nodos Periféricos */}
            {nodes.map((node, i) => (
              <Group key={`node-${i}`}>
                <Circle c={node.pos} r={18} color={node.color} />
                <Circle c={node.pos} r={24} color="rgba(59, 130, 246, 0.3)">
                  <BlurMask blur={10} style="normal" />
                </Circle>
              </Group>
            ))}

            {/* Nodo Central (El Ciudadano) */}
            <Group>
              <Circle c={CENTER} r={32} color="#10b981" />
              <Circle c={CENTER} r={45} color="rgba(16, 185, 129, 0.3)">
                <BlurMask blur={15} style="normal" />
              </Circle>
              <Circle c={CENTER} r={28} color="#059669" />
            </Group>
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  }
});\n```\n### Replacement (Chunk 1)\n```tsx\nimport React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';

const { width, height } = Dimensions.get('window');
const CENTER = vec(width / 2, height / 2);

interface MapNode {
  id: string;
  alias: string;
  merit: number;
  pos: { x: number; y: number };
  color: string;
  level: number;
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Intentamos cargar una fuente por defecto de sistema para Skia, si no, omitimos el texto.
  // En Expo, Skia requiere una fuente cargada desde assets (ej. .ttf). 
  // Por ahora, obviaremos el texto si no tenemos fuente, o usamos círculos puros.

  useEffect(() => {
    const loadTopology = async () => {
      // 1. Inyectar datos si está vacío
      await injectDummyTopology();

      // 2. Extraer datos
      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      // 3. Algoritmo Orbital Básico (Polares a Cartesianas)
      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      // Nodo central
      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981', // Verde central
        level: 0
      });

      // Distribuir los demás en círculos según Nivel
      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          // De Polar a Cartesiano
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            // Si es Nivel 1, la línea va desde CENTER hasta Node
            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1); // Anillo 1 (Azul)
      distributeOrbit(level2Links, 260, '#8b5cf6', 2); // Anillo 2 (Morado)

      // (Opcional: Faltaría dibujar las líneas entre Nivel 1 y Nivel 2, para simplicidad omitimos aquí)

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // e.x y e.y son relativas a la pantalla.
      // Para detectar colisiones tendríamos que invertir la matriz (scale/translate).
      // Lo dejaremos para el Overlay en el siguiente paso.
      console.log('Tapped en:', e.x, e.y);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Canvas style={styles.canvas}>
            {/* Aristas (Enlaces) */}
            {links.map((link, i) => (
              <Line 
                key={`line-${i}`}
                p1={link.p1} 
                p2={link.p2} 
                color="rgba(255, 255, 255, 0.15)" 
                strokeWidth={1.5} 
              />
            ))}

            {/* Nodos */}
            {nodes.map((node, i) => (
              <Group key={`node-${node.id}`}>
                {/* Aura Glow */}
                <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                  <BlurMask blur={15} style="normal" />
                </Circle>
                {/* Núcleo sólido */}
                <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
              </Group>
            ))}
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Slate 950 ultra oscuro
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  }
});\n```\n\n---\n\n## Step 874 - replace_file_content\nInstruction: Add TapGesture logic and render NodeInfoOverlay\n### Target (Chunk 1)\n```tsx\nimport { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';

const { width, height } = Dimensions.get('window');
const CENTER = vec(width / 2, height / 2);

interface MapNode {
  id: string;
  alias: string;
  merit: number;
  pos: { x: number; y: number };
  color: string;
  level: number;
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Intentamos cargar una fuente por defecto de sistema para Skia, si no, omitimos el texto.
  // En Expo, Skia requiere una fuente cargada desde assets (ej. .ttf). 
  // Por ahora, obviaremos el texto si no tenemos fuente, o usamos círculos puros.

  useEffect(() => {
    const loadTopology = async () => {
      // 1. Inyectar datos si está vacío
      await injectDummyTopology();

      // 2. Extraer datos
      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      // 3. Algoritmo Orbital Básico (Polares a Cartesianas)
      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      // Nodo central
      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981', // Verde central
        level: 0
      });

      // Distribuir los demás en círculos según Nivel
      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          // De Polar a Cartesiano
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            // Si es Nivel 1, la línea va desde CENTER hasta Node
            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1); // Anillo 1 (Azul)
      distributeOrbit(level2Links, 260, '#8b5cf6', 2); // Anillo 2 (Morado)

      // (Opcional: Faltaría dibujar las líneas entre Nivel 1 y Nivel 2, para simplicidad omitimos aquí)

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // e.x y e.y son relativas a la pantalla.
      // Para detectar colisiones tendríamos que invertir la matriz (scale/translate).
      // Lo dejaremos para el Overlay en el siguiente paso.
      console.log('Tapped en:', e.x, e.y);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Canvas style={styles.canvas}>
            {/* Aristas (Enlaces) */}
            {links.map((link, i) => (
              <Line 
                key={`line-${i}`}
                p1={link.p1} 
                p2={link.p2} 
                color="rgba(255, 255, 255, 0.15)" 
                strokeWidth={1.5} 
              />
            ))}

            {/* Nodos */}
            {nodes.map((node, i) => (
              <Group key={`node-${node.id}`}>
                {/* Aura Glow */}
                <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                  <BlurMask blur={15} style="normal" />
                </Circle>
                {/* Núcleo sólido */}
                <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
              </Group>
            ))}
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};\n```\n### Replacement (Chunk 1)\n```tsx\nimport { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      distributeOrbit(level2Links, 260, '#8b5cf6', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // Invertimos la transformación para saber en qué parte del Canvas matemático tocó
      // e.x = (canvas.x * scale) + translateX
      // => canvas.x = (e.x - translateX) / scale
      const touchX = (e.x - translateX.value) / scale.value;
      const touchY = (e.y - translateY.value) / scale.value;

      // Buscar colisión radial (r=30px de holgura aprox)
      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { // Radio de colisión táctil tolerante
          foundNode = node;
          break;
        }
      }

      if (foundNode) {
        // Ejecutamos la actualización de estado en el hilo de UI de React Native
        // Ya que GestureDetector corre nativamente en Reanimated
        import('react-native-reanimated').then(({ runOnJS }) => {
          runOnJS(setSelectedNode)(foundNode);
        });
      } else {
        import('react-native-reanimated').then(({ runOnJS }) => {
          runOnJS(setSelectedNode)(null);
        });
      }
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Canvas style={styles.canvas}>
            {links.map((link, i) => (
              <Line 
                key={`line-${i}`}
                p1={link.p1} 
                p2={link.p2} 
                color="rgba(255, 255, 255, 0.15)" 
                strokeWidth={1.5} 
              />
            ))}

            {nodes.map((node, i) => (
              <Group key={`node-${node.id}`}>
                <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                  <BlurMask blur={15} style="normal" />
                </Circle>
                <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
              </Group>
            ))}
          </Canvas>
        </Animated.View>
      </GestureDetector>

      {/* Overlay Component */}
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );
};\n```\n\n---\n\n## Step 886 - replace_file_content\nInstruction: Remove dynamic import of runOnJS and use it directly\n### Target (Chunk 1)\n```tsx\nimport Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      distributeOrbit(level2Links, 260, '#8b5cf6', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // Invertimos la transformación para saber en qué parte del Canvas matemático tocó
      // e.x = (canvas.x * scale) + translateX
      // => canvas.x = (e.x - translateX) / scale
      const touchX = (e.x - translateX.value) / scale.value;
      const touchY = (e.y - translateY.value) / scale.value;

      // Buscar colisión radial (r=30px de holgura aprox)
      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { // Radio de colisión táctil tolerante
          foundNode = node;
          break;
        }
      }

      if (foundNode) {
        // Ejecutamos la actualización de estado en el hilo de UI de React Native
        // Ya que GestureDetector corre nativamente en Reanimated
        import('react-native-reanimated').then(({ runOnJS }) => {
          runOnJS(setSelectedNode)(foundNode);
        });
      } else {
        import('react-native-reanimated').then(({ runOnJS }) => {
          runOnJS(setSelectedNode)(null);
        });
      }
    });\n```\n### Replacement (Chunk 1)\n```tsx\nimport Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      distributeOrbit(level2Links, 260, '#8b5cf6', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // Invertimos la transformación para saber en qué parte del Canvas matemático tocó
      const touchX = (e.x - translateX.value) / scale.value;
      const touchY = (e.y - translateY.value) / scale.value;

      // Buscar colisión radial (r=30px de holgura aprox)
      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }
      }

      if (foundNode) {
        runOnJS(setSelectedNode)(foundNode);
      } else {
        runOnJS(setSelectedNode)(null);
      }
    });\n```\n\n---\n\n## Step 892 - replace_file_content\nInstruction: Update tap collision math for scale origin\n### Target (Chunk 1)\n```tsx\n    .onEnd((e) => {
      // Invertimos la transformación para saber en qué parte del Canvas matemático tocó
      const touchX = (e.x - translateX.value) / scale.value;
      const touchY = (e.y - translateY.value) / scale.value;

      // Buscar colisión radial (r=30px de holgura aprox)
      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }\n```\n### Replacement (Chunk 1)\n```tsx\n      // El origen del escalado en React Native es el centro de la vista por defecto
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      // Buscar colisión radial (r=40px de holgura)
      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }\n```\n\n---\n\n## Step 895 - replace_file_content\nInstruction: Fix syntax error missing .onEnd in TapGesture\n### Target (Chunk 1)\n```tsx\n  const tapGesture = Gesture.Tap()
      // El origen del escalado en React Native es el centro de la vista por defecto
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      // Buscar colisión radial (r=40px de holgura)
      let foundNode = null;\n```\n### Replacement (Chunk 1)\n```tsx\n  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // El origen del escalado en React Native es el centro de la vista por defecto
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      // Buscar colisión radial (r=40px de holgura)
      let foundNode = null;\n```\n\n---\n\n## Step 904 - replace_file_content\nInstruction: Wrap Animated.View in a plain View to detach Gesture from scaled component\n### Target (Chunk 1)\n```tsx\n  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
          <Canvas style={styles.canvas}>
            {links.map((link, i) => (
              <Line 
                key={`line-${i}`}
                p1={link.p1} 
                p2={link.p2} 
                color="rgba(255, 255, 255, 0.15)" 
                strokeWidth={1.5} 
              />
            ))}

            {nodes.map((node, i) => (
              <Group key={`node-${node.id}`}>
                <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                  <BlurMask blur={15} style="normal" />
                </Circle>
                <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
              </Group>
            ))}
          </Canvas>
        </Animated.View>
      </GestureDetector>

      {/* Overlay Component */}
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );\n```\n### Replacement (Chunk 1)\n```tsx\n  return (
    <View style={styles.container}>
      {/* 
        El GestureDetector debe estar en una vista NO escalada (absoluta)
        para que e.x y e.y sean coordenadas crudas de pantalla.
      */}
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <Canvas style={styles.canvas}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color="rgba(255, 255, 255, 0.15)" 
                  strokeWidth={1.5} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                </Group>
              ))}
            </Canvas>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Overlay Component */}
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );\n```\n\n---\n\n## Step 910 - replace_file_content\nInstruction: Add haptic vibration and visual selection ring\n### Target (Chunk 1)\n```tsx\nimport React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      distributeOrbit(level2Links, 260, '#8b5cf6', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      // El origen del escalado en React Native es el centro de la vista por defecto
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      // Buscar colisión radial (r=40px de holgura)
      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }
      }

      if (foundNode) {
        runOnJS(setSelectedNode)(foundNode);
      } else {
        runOnJS(setSelectedNode)(null);
      }
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 
        El GestureDetector debe estar en una vista NO escalada (absoluta)
        para que e.x y e.y sean coordenadas crudas de pantalla.
      */}
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <Canvas style={styles.canvas}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color="rgba(255, 255, 255, 0.15)" 
                  strokeWidth={1.5} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                </Group>
              ))}
            </Canvas>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Overlay Component */}
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );
};\n```\n### Replacement (Chunk 1)\n```tsx\nimport React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      distributeOrbit(level2Links, 260, '#8b5cf6', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      // Feedback háptico nativo (vibración corta de 50ms)
      Vibration.vibrate(50);
    }
    setSelectedNode(node);
  };

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }
      }

      runOnJS(handleNodeSelection)(foundNode);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <Canvas style={styles.canvas}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color="rgba(255, 255, 255, 0.15)" 
                  strokeWidth={1.5} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {/* Feedback Visual: Anillo de Selección */}
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Canvas>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Overlay Component */}
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );
};\n```\n\n---\n\n## Step 919 - replace_file_content\nInstruction: Add absolute positioned text labels below the canvas nodes\n### Target (Chunk 1)\n```tsx\n              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {/* Feedback Visual: Anillo de Selección */}
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Canvas>
          </Animated.View>
        </View>
      </GestureDetector>\n```\n### Replacement (Chunk 1)\n```tsx\n              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {/* Feedback Visual: Anillo de Selección */}
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Canvas>

            {/* Capa de Texto Nativo Superpuesta */}
            {/* 
              Usamos Text de React Native (position absolute) porque 
              Skia requiere archivos .ttf para renderizar texto y no tenemos.
              Además, esto garantiza nitidez al hacer zoom.
            */}
            {nodes.map((node) => {
              const nodeRadius = node.level === 0 ? 28 : 16;
              const displayName = node.localName || node.alias;
              
              return (
                <View 
                  key={`label-${node.id}`}
                  pointerEvents="none" // <-- CRUCIAL: Para que no intercepte los TapGestures
                  style={{
                    position: 'absolute',
                    left: node.pos.x - 100, // Centrado asumiendo ancho 200
                    top: node.pos.y + nodeRadius + 12,
                    width: 200,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: node.level === 0 ? 14 : 11,
                    fontWeight: node.level === 0 ? 'bold' : 'normal',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3
                  }}>
                    {displayName}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>\n```\n\n---\n\n## Step 922 - replace_file_content\nInstruction: Import Text from react-native\n### Target (Chunk 1)\n```tsx\nimport { StyleSheet, View, Dimensions, ActivityIndicator, Vibration } from 'react-native';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text } from 'react-native';\n```\n\n---\n\n## Step 928 - replace_file_content\nInstruction: Add connection lines for Level 2 nodes and improve opacity handling for Skia circles\n### Target (Chunk 1)\n```tsx\n      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      distributeOrbit(level2Links, 260, '#8b5cf6', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };\n```\n### Replacement (Chunk 1)\n```tsx\n      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            } else if (level === 2) {
              // Buscar al ciudadano de Nivel 1 que invitó a este de Nivel 2
              const sourceId = (link as any)._raw.from_citizen_id;
              const sourceNode = newNodes.find(n => n.id === sourceId);
              if (sourceNode) {
                newLinks.push({ p1: sourceNode.pos, p2: vec(nodeX, nodeY), level: 2 });
              } else {
                // Si por alguna razón no encontramos el origen, lo conectamos al centro tenuemente
                newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 2 });
              }
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      // Nivel 2: cambiamos a color fucsia para que resalte mucho más
      distributeOrbit(level2Links, 260, '#ec4899', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };\n```\n\n---\n\n## Step 931 - replace_file_content\nInstruction: Update Line rendering to visually distinguish level 1 and level 2 links\n### Target (Chunk 1)\n```tsx\n              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color="rgba(255, 255, 255, 0.15)" 
                  strokeWidth={1.5} 
                />
              ))}\n```\n### Replacement (Chunk 1)\n```tsx\n              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)"} 
                  strokeWidth={link.level === 1 ? 2 : 1} 
                />
              ))}\n```\n\n---\n\n## Step 937 - replace_file_content\nInstruction: Rewrite layout algorithm to position nodes around their parent, and use opacity instead of hex alpha in Skia circles\n### Target (Chunk 1)\n```tsx\n      // 3. Algoritmo Orbital Básico (Polares a Cartesianas)
      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      const level1Links = allLinks.filter((l: any) => l.level === 1);
      const level2Links = allLinks.filter((l: any) => l.level === 2);

      const distributeOrbit = (linksToProcess: any[], radius: number, baseColor: string, level: number) => {
        const angleStep = (Math.PI * 2) / linksToProcess.length;
        linksToProcess.forEach((link, i) => {
          const angle = i * angleStep;
          const nodeX = CENTER.x + radius * Math.cos(angle);
          const nodeY = CENTER.y + radius * Math.sin(angle);
          
          const targetId = (link as any)._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: baseColor,
              level
            });

            if (level === 1) {
              newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 1 });
            } else if (level === 2) {
              // Buscar al ciudadano de Nivel 1 que invitó a este de Nivel 2
              const sourceId = (link as any)._raw.from_citizen_id;
              const sourceNode = newNodes.find(n => n.id === sourceId);
              if (sourceNode) {
                newLinks.push({ p1: sourceNode.pos, p2: vec(nodeX, nodeY), level: 2 });
              } else {
                // Si por alguna razón no encontramos el origen, lo conectamos al centro tenuemente
                newLinks.push({ p1: CENTER, p2: vec(nodeX, nodeY), level: 2 });
              }
            }
          }
        });
      };

      distributeOrbit(level1Links, 140, '#3b82f6', 1);
      // Nivel 2: cambiamos a color fucsia para que resalte mucho más
      distributeOrbit(level2Links, 260, '#ec4899', 2);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Algoritmo Orbital Jerárquico (N Niveles)
      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      // Nodo central (Nivel 0)
      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      // Función recursiva para ubicar los hijos alrededor de un nodo padre
      const orbitRadiusByLevel = [0, 140, 100, 70]; // El radio disminuye en niveles más profundos
      const colorByLevel = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b'];

      const calculateOrbitForNode = (parentId: string, parentPos: {x:number, y:number}, parentLevel: number) => {
        // Encontrar todos los links donde este nodo es el origen
        const childLinks = allLinks.filter((l: any) => l._raw.from_citizen_id === parentId);
        
        if (childLinks.length === 0) return;

        const childLevel = parentLevel + 1;
        const radius = orbitRadiusByLevel[childLevel] || 50;
        const color = colorByLevel[childLevel] || '#94a3b8';

        const angleStep = (Math.PI * 2) / childLinks.length;
        
        childLinks.forEach((link: any, i: number) => {
          // El ángulo base puede rotarse un poco para no quedar simétrico siempre
          const angle = (i * angleStep) + (parentLevel * 0.5); 
          
          // La órbita es relativa a la posición del PADRE, no del centro
          const nodeX = parentPos.x + radius * Math.cos(angle);
          const nodeY = parentPos.y + radius * Math.sin(angle);
          
          const targetId = link._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: color,
              level: childLevel
            });

            // Guardar la línea conectando el padre con el hijo
            newLinks.push({ 
              p1: parentPos, 
              p2: vec(nodeX, nodeY), 
              level: childLevel 
            });

            // Llamada recursiva para procesar los hijos de este hijo (Nivel 2, Nivel 3...)
            calculateOrbitForNode(cit.id, vec(nodeX, nodeY), childLevel);
          }
        });
      };

      // Disparar la recursión desde el nodo central
      calculateOrbitForNode(mainCit.id, CENTER, 0);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };\n```\n\n---\n\n## Step 940 - replace_file_content\nInstruction: Change node rendering to use opacity={0.3} instead of 8-digit hex\n### Target (Chunk 1)\n```tsx\n              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={`${node.color}50`}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {/* Feedback Visual: Anillo de Selección */}
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}\n```\n### Replacement (Chunk 1)\n```tsx\n              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  {/* Aura (Opacidad 30%) */}
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={node.color} opacity={0.3}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  
                  {/* Núcleo sólido */}
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {/* Feedback Visual: Anillo de Selección */}
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}\n```\n\n---\n\n## Step 959 - replace_file_content\nInstruction: Replace CanvasMap with custom physics engine and Skia Group transform\n### Target (Chunk 1)\n```tsx\nimport React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      // 3. Algoritmo Orbital Jerárquico (N Niveles)
      const newNodes: MapNode[] = [];
      const newLinks: any[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      // Nodo central (Nivel 0)
      newNodes.push({
        id: mainCit.id,
        alias: (mainCit as any).alias || 'Yo',
        localName: (mainCit as any).localName,
        merit: (mainCit as any).merit || 0,
        pos: CENTER,
        color: '#10b981',
        level: 0
      });

      // Función recursiva para ubicar los hijos alrededor de un nodo padre
      const orbitRadiusByLevel = [0, 140, 100, 70]; // El radio disminuye en niveles más profundos
      const colorByLevel = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b'];

      const calculateOrbitForNode = (parentId: string, parentPos: {x:number, y:number}, parentLevel: number) => {
        // Encontrar todos los links donde este nodo es el origen
        const childLinks = allLinks.filter((l: any) => l._raw.from_citizen_id === parentId);
        
        if (childLinks.length === 0) return;

        const childLevel = parentLevel + 1;
        const radius = orbitRadiusByLevel[childLevel] || 50;
        const color = colorByLevel[childLevel] || '#94a3b8';

        const angleStep = (Math.PI * 2) / childLinks.length;
        
        childLinks.forEach((link: any, i: number) => {
          // El ángulo base puede rotarse un poco para no quedar simétrico siempre
          const angle = (i * angleStep) + (parentLevel * 0.5); 
          
          // La órbita es relativa a la posición del PADRE, no del centro
          const nodeX = parentPos.x + radius * Math.cos(angle);
          const nodeY = parentPos.y + radius * Math.sin(angle);
          
          const targetId = link._raw.to_citizen_id;
          const cit = allCitizens.find(c => c.id === targetId);

          if (cit) {
            newNodes.push({
              id: cit.id,
              alias: (cit as any).alias || 'Unknown',
              localName: (cit as any).localName,
              merit: (cit as any).merit || 0,
              pos: vec(nodeX, nodeY),
              color: color,
              level: childLevel
            });

            // Guardar la línea conectando el padre con el hijo
            newLinks.push({ 
              p1: parentPos, 
              p2: vec(nodeX, nodeY), 
              level: childLevel 
            });

            // Llamada recursiva para procesar los hijos de este hijo (Nivel 2, Nivel 3...)
            calculateOrbitForNode(cit.id, vec(nodeX, nodeY), childLevel);
          }
        });
      };

      // Disparar la recursión desde el nodo central
      calculateOrbitForNode(mainCit.id, CENTER, 0);

      setNodes(newNodes);
      setLinks(newLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      // Feedback háptico nativo (vibración corta de 50ms)
      Vibration.vibrate(50);
    }
    setSelectedNode(node);
  };

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }
      }

      runOnJS(handleNodeSelection)(foundNode);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <Canvas style={styles.canvas}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)"} 
                  strokeWidth={link.level === 1 ? 2 : 1} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  {/* Aura (Opacidad 30%) */}
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={node.color} opacity={0.3}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  
                  {/* Núcleo sólido */}
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {/* Feedback Visual: Anillo de Selección */}
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Canvas>

            {/* Capa de Texto Nativo Superpuesta */}
            {/* 
              Usamos Text de React Native (position absolute) porque 
              Skia requiere archivos .ttf para renderizar texto y no tenemos.
              Además, esto garantiza nitidez al hacer zoom.
            */}
            {nodes.map((node) => {
              const nodeRadius = node.level === 0 ? 28 : 16;
              const displayName = node.localName || node.alias;
              
              return (
                <View 
                  key={`label-${node.id}`}
                  pointerEvents="none" // <-- CRUCIAL: Para que no intercepte los TapGestures
                  style={{
                    position: 'absolute',
                    left: node.pos.x - 100, // Centrado asumiendo ancho 200
                    top: node.pos.y + nodeRadius + 12,
                    width: 200,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: node.level === 0 ? 14 : 11,
                    fontWeight: node.level === 0 ? 'bold' : 'normal',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3
                  }}>
                    {displayName}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Overlay Component */}
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Slate 950 ultra oscuro
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  }
});\n```\n### Replacement (Chunk 1)\n```tsx\nimport React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS, useDerivedValue } from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';

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
  // Físicas
  vx: number;
  vy: number;
}

interface MapLink {
  sourceId: string;
  targetId: string;
  level: number;
}

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      let simNodes: MapNode[] = [];
      let simLinks: MapLink[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      // 1. Recopilar todos los nodos y enlaces válidos
      const nodeMap = new Map<string, MapNode>();

      const addNode = (cit: any, level: number) => {
        if (!nodeMap.has(cit.id)) {
          const colorByLevel = ['#10b981', '#3b82f6', '#06b6d4', '#f59e0b']; // Nivel 2 es Cyan
          nodeMap.set(cit.id, {
            id: cit.id,
            alias: cit.alias || 'Unknown',
            localName: cit.localName,
            merit: cit.merit || 0,
            pos: { 
              x: CENTER.x + (Math.random() - 0.5) * 100, 
              y: CENTER.y + (Math.random() - 0.5) * 100 
            }, // Posición inicial aleatoria cerca del centro
            color: colorByLevel[level] || '#94a3b8',
            level,
            vx: 0,
            vy: 0
          });
        }
      };

      addNode(mainCit, 0); // Yo
      // Yo siempre estoy bloqueado en el centro
      nodeMap.get(mainCit.id)!.pos = { x: CENTER.x, y: CENTER.y };

      // Primero mapeamos Nivel 1
      const level1Links = allLinks.filter((l: any) => l.level === 1);
      level1Links.forEach((link: any) => {
        const targetId = link._raw.to_citizen_id;
        const cit = allCitizens.find(c => c.id === targetId);
        if (cit) {
          addNode(cit, 1);
          simLinks.push({ sourceId: mainCit.id, targetId: cit.id, level: 1 });
        }
      });

      // Luego Nivel 2 (Conectados a Nivel 1)
      const level2Links = allLinks.filter((l: any) => l.level === 2);
      level2Links.forEach((link: any) => {
        const sourceId = link._raw.from_citizen_id;
        const targetId = link._raw.to_citizen_id;
        const cit = allCitizens.find(c => c.id === targetId);
        if (cit && nodeMap.has(sourceId)) {
          addNode(cit, 2);
          simLinks.push({ sourceId, targetId: cit.id, level: 2 });
        }
      });

      simNodes = Array.from(nodeMap.values());

      // 2. Motor de Físicas Iterativas (Force-Directed Graph)
      const ITERATIONS = 150;
      const REPULSION = 8000; // Fuerza magnética
      const SPRING_K = 0.05; // Rigidez del resorte
      const IDEAL_LENGTH_L1 = 160;
      const IDEAL_LENGTH_L2 = 120;
      const DAMPING = 0.7; // Fricción

      for (let iter = 0; iter < ITERATIONS; iter++) {
        // A. Repulsión entre todos los pares de nodos (Ley de Coulomb)
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            
            const dx = n1.pos.x - n2.pos.x;
            const dy = n1.pos.y - n2.pos.y;
            let distSq = dx * dx + dy * dy;
            if (distSq === 0) distSq = 0.01; // Evitar división por 0
            const dist = Math.sqrt(distSq);

            // Fuerza inversamente proporcional al cuadrado de la distancia
            const force = REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          }
        }

        // B. Atracción de enlaces (Resortes)
        simLinks.forEach(link => {
          const source = nodeMap.get(link.sourceId)!;
          const target = nodeMap.get(link.targetId)!;
          
          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          
          const idealDist = link.level === 1 ? IDEAL_LENGTH_L1 : IDEAL_LENGTH_L2;
          const displacement = dist - idealDist;
          
          // Fuerza del resorte
          const force = displacement * SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.level !== 0) { source.vx += fx; source.vy += fy; }
          if (target.level !== 0) { target.vx -= fx; target.vy -= fy; }
        });

        // C. Gravedad central ligera para que el grafo no se escape
        simNodes.forEach(node => {
          if (node.level !== 0) {
            const dx = CENTER.x - node.pos.x;
            const dy = CENTER.y - node.pos.y;
            node.vx += dx * 0.005;
            node.vy += dy * 0.005;
          }
        });

        // D. Aplicar velocidades y fricción
        simNodes.forEach(node => {
          if (node.level !== 0) {
            node.pos.x += node.vx;
            node.pos.y += node.vy;
            node.vx *= DAMPING;
            node.vy *= DAMPING;
          }
        });
      }

      // Convertimos los links simulados al formato renderizable
      const renderLinks = simLinks.map(link => {
        const source = nodeMap.get(link.sourceId)!;
        const target = nodeMap.get(link.targetId)!;
        return { p1: source.pos, p2: target.pos, level: link.level };
      });

      setNodes(simNodes);
      setLinks(renderLinks);
      setIsLoading(false);
    };

    loadTopology();
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      Vibration.vibrate(50);
    }
    setSelectedNode(node);
  };

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const originX = width / 2;
      const originY = height / 2;
      
      const touchX = (e.x - translateX.value - originX) / scale.value + originX;
      const touchY = (e.y - translateY.value - originY) / scale.value + originY;

      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }
      }

      runOnJS(handleNodeSelection)(foundNode);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  // Generamos el array de transformaciones para Skia
  const skiaTransform = useDerivedValue(() => {
    return [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ];
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          {/* El Canvas ahora ocupa toda la pantalla de forma estática */}
          <Canvas style={{ flex: 1 }}>
            {/* El Group aplica la matriz de transformación nativa (Zoom/Pan) desde el centro */}
            <Group transform={skiaTransform} origin={CENTER}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)"} 
                  strokeWidth={link.level === 1 ? 2 : 1} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={node.color} opacity={0.3}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Group>
          </Canvas>

          {/* Textos Nativos Superpuestos */}
          {/* Al quitar el Animated.View wrapper, tenemos que recrear la transformación para los textos en RN */}
          {nodes.map((node) => {
            const nodeRadius = node.level === 0 ? 28 : 16;
            const displayName = node.localName || node.alias;
            
            return (
              <View 
                key={`label-${node.id}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  // Usamos transformaciones para alinear el texto de forma idéntica a Skia
                  transform: [
                    { translateX: translateX.value },
                    { translateY: translateY.value },
                    { translateX: CENTER.x },
                    { translateY: CENTER.y },
                    { scale: scale.value },
                    { translateX: -CENTER.x },
                    { translateY: -CENTER.y },
                    { translateX: node.pos.x - 100 }, 
                    { translateY: node.pos.y + nodeRadius + 12 }
                  ],
                  width: 200,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: node.level === 0 ? 14 : 11,
                  fontWeight: node.level === 0 ? 'bold' : 'normal',
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3
                }}>
                  {displayName}
                </Text>
              </View>
            );
          })}
        </View>
      </GestureDetector>

      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Slate 950 ultra oscuro
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  }
});\n```\n\n---\n\n## Step 963 - replace_file_content\nInstruction: Fix syntax error in line color and use Animated.View for native texts overlay\n### Target (Chunk 1)\n```tsx\n  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={skiaTransform} origin={CENTER}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)}
                  strokeWidth={link.level === 1 ? 2 : 1} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={node.color} opacity={0.3}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Group>
          </Canvas>

          {nodes.map((node) => {
            const nodeRadius = node.level === 0 ? 28 : 16;
            const displayName = node.localName || node.alias;
            
            return (
              <View 
                key={`label-${node.id}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  transform: [
                    { translateX: translateX.value },
                    { translateY: translateY.value },
                    { translateX: CENTER.x },
                    { translateY: CENTER.y },
                    { scale: scale.value },
                    { translateX: -CENTER.x },
                    { translateY: -CENTER.y },
                    { translateX: node.pos.x - 100 }, 
                    { translateY: node.pos.y + nodeRadius + 12 }
                  ],
                  width: 200,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: node.level === 0 ? 14 : 11,
                  fontWeight: node.level === 0 ? 'bold' : 'normal',
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3
                }}>
                  {displayName}
                </Text>
              </View>
            );
          })}
        </View>
      </GestureDetector>\n```\n### Replacement (Chunk 1)\n```tsx\n  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          {/* El Canvas ahora ocupa toda la pantalla de forma estática */}
          <Canvas style={{ flex: 1 }}>
            {/* El Group aplica la matriz de transformación nativa (Zoom/Pan) desde el centro */}
            <Group transform={skiaTransform} origin={CENTER}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)"} 
                  strokeWidth={link.level === 1 ? 2 : 1} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={node.color} opacity={0.3}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Group>
          </Canvas>

          {/* Textos Nativos Superpuestos */}
          <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
            {nodes.map((node) => {
              const nodeRadius = node.level === 0 ? 28 : 16;
              const displayName = node.localName || node.alias;
              
              return (
                <View 
                  key={`label-${node.id}`}
                  style={{
                    position: 'absolute',
                    left: node.pos.x - 100, 
                    top: node.pos.y + nodeRadius + 12,
                    width: 200,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: node.level === 0 ? 14 : 11,
                    fontWeight: node.level === 0 ? 'bold' : 'normal',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3
                  }}>
                    {displayName}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>\n```\n\n---\n\n## Step 974 - replace_file_content\nInstruction: Restore Animated and useAnimatedStyle imports from react-native-reanimated\n### Target (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue } from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n\n---\n\n## Step 980 - replace_file_content\nInstruction: Adjust Level 2 colors to Amber, increase line thickness, and fix 'Yo' alias\n### Target (Chunk 1)\n```tsx\n      const addNode = (cit: any, level: number) => {
        if (!nodeMap.has(cit.id)) {
          const colorByLevel = ['#10b981', '#3b82f6', '#06b6d4', '#f59e0b']; 
          nodeMap.set(cit.id, {
            id: cit.id,
            alias: cit.alias || 'Unknown',
            localName: cit.localName,
            merit: cit.merit || 0,
            pos: { 
              x: CENTER.x + (Math.random() - 0.5) * 100, 
              y: CENTER.y + (Math.random() - 0.5) * 100 
            },
            color: colorByLevel[level] || '#94a3b8',
            level,
            vx: 0,
            vy: 0
          });
        }
      };\n```\n### Replacement (Chunk 1)\n```tsx\n      const addNode = (cit: any, level: number) => {
        if (!nodeMap.has(cit.id)) {
          const colorByLevel = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899']; // Nivel 2 es Ámbar
          nodeMap.set(cit.id, {
            id: cit.id,
            alias: level === 0 ? 'Yo' : (cit.alias || 'Unknown'),
            localName: cit.localName,
            merit: cit.merit || 0,
            pos: { 
              x: CENTER.x + (Math.random() - 0.5) * 100, 
              y: CENTER.y + (Math.random() - 0.5) * 100 
            },
            color: colorByLevel[level] || '#94a3b8',
            level,
            vx: 0,
            vy: 0
          });
        }
      };\n```\n\n---\n\n## Step 983 - replace_file_content\nInstruction: Increase thickness and opacity of the connecting lines\n### Target (Chunk 1)\n```tsx\n            <Group transform={skiaTransform} origin={CENTER}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)"} 
                  strokeWidth={link.level === 1 ? 2 : 1} 
                />
              ))}\n```\n### Replacement (Chunk 1)\n```tsx\n            <Group transform={skiaTransform} origin={CENTER}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)"} 
                  strokeWidth={link.level === 1 ? 2.5 : 1.5} 
                />
              ))}\n```\n\n---\n\n## Step 1013 - replace_file_content\nInstruction: Pass onUpdateLocalName to NodeInfoOverlay and implement state update in CanvasMap\n### Target (Chunk 1)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
        />
      )}\n```\n### Replacement (Chunk 1)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
          onUpdateLocalName={(newName) => {
            // Actualizar el estado local para reflejar el cambio instantáneamente en el mapa
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
        />
      )}\n```\n\n---\n\n## Step 1041 - replace_file_content\nInstruction: Replace level 1 and 2 specific loops with a generic level-sorted loop that covers infinite levels\n### Target (Chunk 1)\n```tsx\n      const level1Links = allLinks.filter((l: any) => l.level === 1);
      level1Links.forEach((link: any) => {
        const targetId = link._raw.to_citizen_id;
        const cit = allCitizens.find(c => c.id === targetId);
        if (cit) {
          addNode(cit, 1);
          simLinks.push({ sourceId: mainCit.id, targetId: cit.id, level: 1 });
        }
      });

      const level2Links = allLinks.filter((l: any) => l.level === 2);
      level2Links.forEach((link: any) => {
        const sourceId = link._raw.from_citizen_id;
        const targetId = link._raw.to_citizen_id;
        const cit = allCitizens.find(c => c.id === targetId);
        if (cit && nodeMap.has(sourceId)) {
          addNode(cit, 2);
          simLinks.push({ sourceId, targetId: cit.id, level: 2 });
        }
      });\n```\n### Replacement (Chunk 1)\n```tsx\n      // Optimizamos la búsqueda de ciudadanos con un Map (O(1) en vez de O(N))
      const citizenMap = new Map(allCitizens.map(c => [c.id, c]));

      // Ordenamos los links por nivel para garantizar que los padres existan en el nodoMap antes que sus hijos
      const sortedLinks = allLinks.sort((a: any, b: any) => a.level - b.level);

      sortedLinks.forEach((link: any) => {
        const sourceId = link._raw.from_citizen_id;
        const targetId = link._raw.to_citizen_id;
        const level = link.level;
        
        const targetCitizen = citizenMap.get(targetId);
        
        // El sourceId siempre debe estar ya en el nodeMap porque procesamos de centro hacia afuera
        if (targetCitizen && nodeMap.has(sourceId)) {
          addNode(targetCitizen, level);
          simLinks.push({ sourceId, targetId, level });
        }
      });\n```\n\n---\n\n## Step 1206 - replace_file_content\nInstruction: Replace loadTopology raw database fetch with CitizenRepository call\n### Target (Chunk 1)\n```tsx\n      const allCitizens = await database.collections.get('citizens').query().fetch();
      const allLinks = await database.collections.get('trust_links').query().fetch();

      let simNodes: MapNode[] = [];
      let simLinks: MapLink[] = [];
      
      const mainCit = allCitizens[0];
      if (!mainCit) {
        setIsLoading(false);
        return;
      }

      const nodeMap = new Map<string, MapNode>();

      const addNode = (cit: any, level: number) => {
        if (!nodeMap.has(cit.id)) {
          const colorByLevel = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899']; // Nivel 2 es Ámbar
          nodeMap.set(cit.id, {
            id: cit.id,
            alias: level === 0 ? 'Yo' : (cit.alias || 'Unknown'),
            localName: cit.localName,
            merit: cit.merit || 0,
            pos: { 
              x: CENTER.x + (Math.random() - 0.5) * 100, 
              y: CENTER.y + (Math.random() - 0.5) * 100 
            },
            color: colorByLevel[level] || '#94a3b8',
            level,
            vx: 0,
            vy: 0
          });
        }
      };

      addNode(mainCit, 0);
      nodeMap.get(mainCit.id)!.pos = { x: CENTER.x, y: CENTER.y };

      // Optimizamos la búsqueda de ciudadanos con un Map (O(1) en vez de O(N))
      const citizenMap = new Map(allCitizens.map(c => [c.id, c]));

      // Ordenamos los links por nivel para garantizar que los padres existan en el nodoMap antes que sus hijos
      const sortedLinks = allLinks.sort((a: any, b: any) => a.level - b.level);

      sortedLinks.forEach((link: any) => {
        const sourceId = link._raw.from_citizen_id;
        const targetId = link._raw.to_citizen_id;
        const level = link.level;
        
        const targetCitizen = citizenMap.get(targetId);
        
        // El sourceId siempre debe estar ya en el nodeMap porque procesamos de centro hacia afuera
        if (targetCitizen && nodeMap.has(sourceId)) {
          addNode(targetCitizen, level);
          simLinks.push({ sourceId, targetId, level });
        }
      });

      simNodes = Array.from(nodeMap.values());\n```\n### Replacement (Chunk 1)\n```tsx\n      const topology = await CitizenRepository.getHydratedCitizens();
      
      const nodeMap = new Map<string, MapNode>();

      topology.nodes.forEach(cit => {
        const colorByLevel = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'];
        nodeMap.set(cit.networkData.id, {
          id: cit.networkData.id,
          alias: cit.networkData.alias,
          localName: cit.localData.localName,
          merit: cit.networkData.merit,
          pos: { 
            x: CENTER.x + (Math.random() - 0.5) * 100, 
            y: CENTER.y + (Math.random() - 0.5) * 100 
          },
          color: colorByLevel[cit.level] || '#94a3b8',
          level: cit.level,
          vx: 0,
          vy: 0
        });
      });

      // El nodo principal (nivel 0) siempre va al centro inicialmente
      const mainNodes = topology.nodes.filter(n => n.level === 0);
      if (mainNodes.length > 0) {
        nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };
      } else {
        setIsLoading(false);
        return;
      }

      simLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        level: l.level
      }));

      simNodes = Array.from(nodeMap.values());\n```\n\n---\n\n## Step 1209 - replace_file_content\nInstruction: Import CitizenRepository\n### Target (Chunk 1)\n```tsx\nimport React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Circle, Line, Group, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';\n```\n\n---\n\n## Step 1218 - replace_file_content\nInstruction: Add spring-based limits and rubber banding to pan and pinch gestures\n### Target (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });\n```\n### Replacement (Chunk 1)\n```tsx\n  const MIN_SCALE = 0.3;
  const MAX_SCALE = 2.5;
  const PAN_LIMIT = 1500;

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
      
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(console.log)("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
      savedScale.value = scale.value;
    });\n```\n\n---\n\n## Step 1239 - replace_file_content\nInstruction: Add missing let declarations for simNodes and simLinks\n### Target (Chunk 1)\n```tsx\n      const topology = await CitizenRepository.getHydratedCitizens();
      
      const nodeMap = new Map<string, MapNode>();\n```\n### Replacement (Chunk 1)\n```tsx\n      const topology = await CitizenRepository.getHydratedCitizens();
      
      let simNodes: MapNode[] = [];
      let simLinks: MapLink[] = [];

      const nodeMap = new Map<string, MapNode>();\n```\n\n---\n\n## Step 1248 - replace_file_content\nInstruction: Wrap console.log in a JS thread function to satisfy Reanimated strict worklet rules\n### Target (Chunk 1)\n```tsx\n  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(console.log)("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
      savedScale.value = scale.value;
    });\n```\n### Replacement (Chunk 1)\n```tsx\n  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
      savedScale.value = scale.value;
    });\n```\n\n---\n\n## Step 1266 - replace_file_content\nInstruction: Rewrite panGesture and pinchGesture to use onBegin for saved values and dynamic limits.\n### Target (Chunk 1)\n```tsx\n  const MIN_SCALE = 0.3;
  const MAX_SCALE = 2.5;
  const PAN_LIMIT = 1500;

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
      
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
      savedScale.value = scale.value;
    });\n```\n### Replacement (Chunk 1)\n```tsx\n  const [bounds, setBounds] = useState({ R: 1000 });

  const MIN_SCALE = Math.max(0.1, Math.min(width, height) / (bounds.R * 2 + 200));
  const MAX_SCALE = 1.5; // Reducido para que no ocupe toda la pantalla un solo nodo

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      const PAN_LIMIT = bounds.R * scale.value;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
    });\n```\n\n---\n\n## Step 1269 - replace_file_content\nInstruction: Calculate maxR after physics simulation and call setBounds\n### Target (Chunk 1)\n```tsx\n      const renderLinks = simLinks.map(link => {
        const source = nodeMap.get(link.sourceId)!;
        const target = nodeMap.get(link.targetId)!;
        return { p1: source.pos, p2: target.pos, level: link.level };
      });

      setNodes(simNodes);
      setLinks(renderLinks);
      setIsLoading(false);\n```\n### Replacement (Chunk 1)\n```tsx\n      const renderLinks = simLinks.map(link => {
        const source = nodeMap.get(link.sourceId)!;
        const target = nodeMap.get(link.targetId)!;
        return { p1: source.pos, p2: target.pos, level: link.level };
      });

      // Calcular el radio máximo dinámico (distancia del nodo más lejano al centro)
      let maxR = 100; // Mínimo
      simNodes.forEach(n => {
        const dist = Math.sqrt(Math.pow(n.pos.x - CENTER.x, 2) + Math.pow(n.pos.y - CENTER.y, 2));
        if (dist > maxR) maxR = dist;
      });
      setBounds({ R: maxR });

      setNodes(simNodes);
      setLinks(renderLinks);
      setIsLoading(false);\n```\n\n---\n\n## Step 1272 - replace_file_content\nInstruction: Change transform array order to put scale first for both skiaTransform and animatedStyle\n### Target (Chunk 1)\n```tsx\n  const skiaTransform = useDerivedValue(() => {
    return [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ];
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));\n```\n### Replacement (Chunk 1)\n```tsx\n  const skiaTransform = useDerivedValue(() => {
    return [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ];
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ]
  }));\n```\n\n---\n\n## Step 1284 - replace_file_content\nInstruction: Add NodeLabel component, replace Animated.View wrapper with direct NodeLabel rendering, and remove old animatedStyle\n### Target (Chunk 1)\n```tsx\n          {/* Textos Nativos Superpuestos */}
          <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
            {nodes.map((node) => {
              const nodeRadius = node.level === 0 ? 28 : 16;
              const displayName = node.localName || node.alias;
              
              return (
                <View 
                  key={`label-${node.id}`}
                  style={{
                    position: 'absolute',
                    left: node.pos.x - 100, 
                    top: node.pos.y + nodeRadius + 12,
                    width: 200,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: node.level === 0 ? 14 : 11,
                    fontWeight: node.level === 0 ? 'bold' : 'normal',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3
                  }}>
                    {displayName}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>\n```\n### Replacement (Chunk 1)\n```tsx\n          {/* Textos Nativos Superpuestos sin escalar */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {nodes.map((node) => (
              <NodeLabel 
                key={`label-${node.id}`} 
                node={node} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}
          </View>
        </View>
      </GestureDetector>\n```\n\n---\n\n## Step 1287 - replace_file_content\nInstruction: Remove animatedStyle and add NodeLabel component definition\n### Target (Chunk 1)\n```tsx\n  const skiaTransform = useDerivedValue(() => {
    return [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ];
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ]
  }));

  if (isLoading) {\n```\n### Replacement (Chunk 1)\n```tsx\n  const skiaTransform = useDerivedValue(() => {
    return [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ];
  });

  if (isLoading) {\n```\n\n---\n\n## Step 1290 - replace_file_content\nInstruction: Insert NodeLabel component definition\n### Target (Chunk 1)\n```tsx\ninterface MapLink {
  sourceId: string;
  targetId: string;
  level: number;
}

export const CanvasMap = () => {\n```\n### Replacement (Chunk 1)\n```tsx\ninterface MapLink {
  sourceId: string;
  targetId: string;
  level: number;
}

const NodeLabel = ({ node, scale, translateX, translateY }: any) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    return {
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

export const CanvasMap = () => {\n```\n\n---\n\n## Step 1293 - replace_file_content\nInstruction: Add rubber band friction logic during onUpdate for pan and pinch gestures\n### Target (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      const PAN_LIMIT = bounds.R * scale.value;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
    });\n```\n### Replacement (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const PAN_LIMIT = bounds.R * scale.value;
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica dura (10%) si se pasa del límite
      if (nextX > PAN_LIMIT) nextX = PAN_LIMIT + (nextX - PAN_LIMIT) * 0.15;
      if (nextX < -PAN_LIMIT) nextX = -PAN_LIMIT + (nextX + PAN_LIMIT) * 0.15;
      if (nextY > PAN_LIMIT) nextY = PAN_LIMIT + (nextY - PAN_LIMIT) * 0.15;
      if (nextY < -PAN_LIMIT) nextY = -PAN_LIMIT + (nextY + PAN_LIMIT) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      const PAN_LIMIT = bounds.R * scale.value;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      let nextScale = savedScale.value * e.scale;
      
      // Resistencia elástica dura (10%) si se pasa del límite
      if (nextScale > MAX_SCALE) {
        nextScale = MAX_SCALE + (nextScale - MAX_SCALE) * 0.15;
      } else if (nextScale < MIN_SCALE) {
        nextScale = MIN_SCALE - (MIN_SCALE - nextScale) * 0.15;
      }
      scale.value = nextScale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
    });\n```\n\n---\n\n## Step 1308 - replace_file_content\nInstruction: Add maxPointers(1) to panGesture and maxDistance(10) to tapGesture\n### Target (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const PAN_LIMIT = bounds.R * scale.value;
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica dura (10%) si se pasa del límite
      if (nextX > PAN_LIMIT) nextX = PAN_LIMIT + (nextX - PAN_LIMIT) * 0.15;
      if (nextX < -PAN_LIMIT) nextX = -PAN_LIMIT + (nextX + PAN_LIMIT) * 0.15;
      if (nextY > PAN_LIMIT) nextY = PAN_LIMIT + (nextY - PAN_LIMIT) * 0.15;
      if (nextY < -PAN_LIMIT) nextY = -PAN_LIMIT + (nextY + PAN_LIMIT) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      const PAN_LIMIT = bounds.R * scale.value;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      let nextScale = savedScale.value * e.scale;
      
      // Resistencia elástica dura (10%) si se pasa del límite
      if (nextScale > MAX_SCALE) {
        nextScale = MAX_SCALE + (nextScale - MAX_SCALE) * 0.15;
      } else if (nextScale < MIN_SCALE) {
        nextScale = MIN_SCALE - (MIN_SCALE - nextScale) * 0.15;
      }
      scale.value = nextScale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
    });\n```\n### Replacement (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
    .maxPointers(1) // EXCLUSIVIDAD: Solo un dedo permite el paneo.
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const PAN_LIMIT = bounds.R * scale.value;
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica dura (15%) si se pasa del límite
      if (nextX > PAN_LIMIT) nextX = PAN_LIMIT + (nextX - PAN_LIMIT) * 0.15;
      if (nextX < -PAN_LIMIT) nextX = -PAN_LIMIT + (nextX + PAN_LIMIT) * 0.15;
      if (nextY > PAN_LIMIT) nextY = PAN_LIMIT + (nextY - PAN_LIMIT) * 0.15;
      if (nextY < -PAN_LIMIT) nextY = -PAN_LIMIT + (nextY + PAN_LIMIT) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      const PAN_LIMIT = bounds.R * scale.value;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });

  const handleSemanticZoomOut = () => {
    console.log("⚠️ ZOOM OUT EXTREMO DETECTADO: Preparando transición a capa Provincias...");
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
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
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
    });\n```\n\n---\n\n## Step 1312 - replace_file_content\nInstruction: Add maxDistance(10) to tapGesture\n### Target (Chunk 1)\n```tsx\n  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const originX = width / 2;\n```\n### Replacement (Chunk 1)\n```tsx\n  const tapGesture = Gesture.Tap()
    .maxDistance(10) // EXCLUSIVIDAD: Si el dedo se mueve más de 10px, se cancela el tap.
    .onEnd((e) => {
      const originX = width / 2;\n```\n\n---\n\n## Step 1317 - replace_file_content\nInstruction: Insert SkiaNode and SkiaLink component definitions\n### Target (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: any) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    return {
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};\n```\n### Replacement (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: any) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    return {
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: any) => {
  const cx = useDerivedValue(() => CENTER.x + (node.pos.x - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (node.pos.y - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

const SkiaLink = ({ link, scale, translateX, translateY }: any) => {
  const p1 = useDerivedValue(() => vec(
    CENTER.x + (link.p1.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p1.y - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (link.p2.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p2.y - CENTER.y) * scale.value + translateY.value
  ));
  
  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={link.level === 1 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)"} 
      strokeWidth={link.level === 1 ? 2.5 : 1.5} 
    />
  );
};\n```\n\n---\n\n## Step 1320 - replace_file_content\nInstruction: Replace Canvas rendering block with SkiaNode and SkiaLink without Group transform\n### Target (Chunk 1)\n```tsx\n      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          {/* El Canvas ahora ocupa toda la pantalla de forma estática */}
          <Canvas style={{ flex: 1 }}>
            {/* El Group aplica la matriz de transformación nativa (Zoom/Pan) desde el centro */}
            <Group transform={skiaTransform} origin={CENTER}>
              {links.map((link, i) => (
                <Line 
                  key={`line-${i}`}
                  p1={link.p1} 
                  p2={link.p2} 
                  color={link.level === 1 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)"} 
                  strokeWidth={link.level === 1 ? 2.5 : 1.5} 
                />
              ))}

              {nodes.map((node, i) => (
                <Group key={`node-${node.id}`}>
                  <Circle c={node.pos} r={node.level === 0 ? 45 : 24} color={node.color} opacity={0.3}>
                    <BlurMask blur={15} style="normal" />
                  </Circle>
                  
                  <Circle c={node.pos} r={node.level === 0 ? 28 : 16} color={node.color} />
                  
                  {selectedNode?.id === node.id && (
                    <Circle 
                      c={node.pos} 
                      r={node.level === 0 ? 34 : 22} 
                      color="#ffffff" 
                      style="stroke" 
                      strokeWidth={2} 
                    />
                  )}
                </Group>
              ))}
            </Group>
          </Canvas>

          {/* Textos Nativos Superpuestos sin escalar */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {nodes.map((node) => (
              <NodeLabel 
                key={`label-${node.id}`} 
                node={node} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}
          </View>
        </View>
      </GestureDetector>\n```\n### Replacement (Chunk 1)\n```tsx\n      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            {links.map((link, i) => (
              <SkiaLink 
                key={`link-${i}`} 
                link={link} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}

            {nodes.map((node) => (
              <SkiaNode 
                key={`node-${node.id}`} 
                node={node} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
                isSelected={selectedNode?.id === node.id}
              />
            ))}
          </Canvas>

          {/* Textos Nativos Superpuestos sin escalar */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {nodes.map((node) => (
              <NodeLabel 
                key={`label-${node.id}`} 
                node={node} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}
          </View>
        </View>
      </GestureDetector>\n```\n\n---\n\n## Step 1323 - replace_file_content\nInstruction: Remove skiaTransform useDerivedValue block\n### Target (Chunk 1)\n```tsx\n  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const skiaTransform = useDerivedValue(() => {
    return [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ];
  });

  if (isLoading) {\n```\n### Replacement (Chunk 1)\n```tsx\n  const composed = Gesture.Exclusive(panGesture, pinchGesture, tapGesture);

  if (isLoading) {\n```\n\n---\n\n## Step 1341 - replace_file_content\nInstruction: Add re-centering translation checks in pinchGesture.onEnd using finalScale\n### Target (Chunk 1)\n```tsx\n    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
      }
    });\n```\n### Replacement (Chunk 1)\n```tsx\n    .onEnd(() => {
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
      const PAN_LIMIT = bounds.R * finalScale;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });\n```\n\n---\n\n## Step 1419 - replace_file_content\nInstruction: Insert PHYSICS_CONFIG, Interfaces for props, and remove any from SkiaNode, SkiaLink, NodeLabel\n### Target (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: any) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    return {
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: any) => {
  const cx = useDerivedValue(() => CENTER.x + (node.pos.x - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (node.pos.y - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

const SkiaLink = ({ link, scale, translateX, translateY }: any) => {
  const p1 = useDerivedValue(() => vec(
    CENTER.x + (link.p1.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p1.y - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (link.p2.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p2.y - CENTER.y) * scale.value + translateY.value
  ));
  
  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={link.level === 1 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)"} 
      strokeWidth={link.level === 1 ? 2.5 : 1.5} 
    />
  );
};\n```\n### Replacement (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 8000,
  SPRING_K: 0.05,
  RADIAL_SPRING_K: 0.1, // Fuerza gravitacional hacia la órbita concéntrica
  DAMPING: 0.7,
  ORBIT_RADII: {
    0: 0,
    1: 160,
    2: 300,
    3: 450
  } as Record<number, number>
};

interface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    return {
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

interface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isSelected: boolean;
}

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: SkiaNodeProps) => {
  const cx = useDerivedValue(() => CENTER.x + (node.pos.x - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (node.pos.y - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

interface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const SkiaLink = ({ link, scale, translateX, translateY }: SkiaLinkProps) => {
  const p1 = useDerivedValue(() => vec(
    CENTER.x + (link.p1.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p1.y - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (link.p2.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p2.y - CENTER.y) * scale.value + translateY.value
  ));
  
  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={link.level === 1 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)"} 
      strokeWidth={link.level === 1 ? 2.5 : 1.5} 
    />
  );
};\n```\n\n---\n\n## Step 1428 - replace_file_content\nInstruction: Replace the physics loop variables and the center gravity with Radial Gravity based on PHYSICS_CONFIG\n### Target (Chunk 1)\n```tsx\n      const ITERATIONS = 150;
      const REPULSION = 8000;
      const SPRING_K = 0.05;
      const IDEAL_LENGTH_L1 = 160;
      const IDEAL_LENGTH_L2 = 120;
      const DAMPING = 0.7;

      for (let iter = 0; iter < ITERATIONS; iter++) {
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            
            const dx = n1.pos.x - n2.pos.x;
            const dy = n1.pos.y - n2.pos.y;
            let distSq = dx * dx + dy * dy;
            if (distSq === 0) distSq = 0.01;
            const dist = Math.sqrt(distSq);

            const force = REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          }
        }

        simLinks.forEach(link => {
          const source = nodeMap.get(link.sourceId)!;
          const target = nodeMap.get(link.targetId)!;
          
          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          
          const idealDist = link.level === 1 ? IDEAL_LENGTH_L1 : IDEAL_LENGTH_L2;
          const displacement = dist - idealDist;
          
          const force = displacement * SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.level !== 0) { source.vx += fx; source.vy += fy; }
          if (target.level !== 0) { target.vx -= fx; target.vy -= fy; }
        });

        simNodes.forEach(node => {
          if (node.level !== 0) {
            const dx = CENTER.x - node.pos.x;
            const dy = CENTER.y - node.pos.y;
            node.vx += dx * 0.005;
            node.vy += dy * 0.005;
          }
        });

        simNodes.forEach(node => {
          if (node.level !== 0) {
            node.pos.x += node.vx;
            node.pos.y += node.vy;
            node.vx *= DAMPING;
            node.vy *= DAMPING;
          }
        });
      }\n```\n### Replacement (Chunk 1)\n```tsx\n      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
        // Fuerza 1: Repulsión (Nodos se empujan entre sí)
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            
            const dx = n1.pos.x - n2.pos.x;
            const dy = n1.pos.y - n2.pos.y;
            let distSq = dx * dx + dy * dy;
            if (distSq === 0) distSq = 0.01;
            const dist = Math.sqrt(distSq);

            const force = PHYSICS_CONFIG.REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          }
        }

        // Fuerza 2: Atracción de Enlace (El resorte tira entre padre e hijo para mantenerlos cercanos angularmente)
        simLinks.forEach(link => {
          const source = nodeMap.get(link.sourceId)!;
          const target = nodeMap.get(link.targetId)!;
          
          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          
          const idealDist = PHYSICS_CONFIG.ORBIT_RADII[link.level] - PHYSICS_CONFIG.ORBIT_RADII[link.level - 1];
          const displacement = dist - (idealDist > 0 ? idealDist : 100);
          
          const force = displacement * PHYSICS_CONFIG.SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.level !== 0) { source.vx += fx; source.vy += fy; }
          if (target.level !== 0) { target.vx -= fx; target.vy -= fy; }
        });

        // Fuerza 3: Gravedad Orbital (Empuja al nodo a su anillo concéntrico)
        simNodes.forEach(node => {
          if (node.level !== 0) {
            const dx = CENTER.x - node.pos.x;
            const dy = CENTER.y - node.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            
            const targetRadius = PHYSICS_CONFIG.ORBIT_RADII[node.level] || 500;
            const displacement = dist - targetRadius;
            
            const force = displacement * PHYSICS_CONFIG.RADIAL_SPRING_K;
            
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        });

        // Aplicar Cinemática
        simNodes.forEach(node => {
          if (node.level !== 0) {
            node.pos.x += node.vx;
            node.pos.y += node.vy;
            node.vx *= PHYSICS_CONFIG.DAMPING;
            node.vy *= PHYSICS_CONFIG.DAMPING;
          }
        });
      }\n```\n\n---\n\n## Step 1446 - replace_file_content\nInstruction: Add SharedValue to the react-native-reanimated import\n### Target (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, SharedValue } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n\n---\n\n## Step 1476 - replace_file_content\nInstruction: Update PHYSICS_CONFIG\n### Target (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 8000,
  SPRING_K: 0.05,
  RADIAL_SPRING_K: 0.1, // Fuerza gravitacional hacia la órbita concéntrica
  DAMPING: 0.7,
  ORBIT_RADII: {
    0: 0,
    1: 160,
    2: 300,
    3: 450
  } as Record<number, number>
};\n```\n### Replacement (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 12000,
  REPULSION_SOFTENING: 300, // Evita división por cero cuando los nodos están encimados
  SPRING_K: 0.05,
  RADIAL_SPRING_K: 0.1, 
  DAMPING: 0.7,
  MAX_VELOCITY: 40 // Límite de velocidad absoluta (Anti-explosión matemática)
};\n```\n\n---\n\n## Step 1482 - replace_file_content\nInstruction: Update NodeLabel style for culling\n### Target (Chunk 1)\n```tsx\n  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    return {
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });\n```\n### Replacement (Chunk 1)\n```tsx\n  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    
    // Level Of Detail (LOD) y Culling
    let opacity = 1;
    if (node.level > 1 && s < 0.6) {
      opacity = 0; // Ocultamos textos menores al alejar la cámara
    }
    // Culling espacial: si sale de los bordes del dispositivo, ni lo intentamos dibujar
    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      opacity = 0;
    }

    return {
      opacity,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });\n```\n\n---\n\n## Step 1488 - replace_file_content\nInstruction: Replace lines 217 to 283 with dynamic radii and clamped physics logic\n### Target (Chunk 1)\n```tsx\n      simNodes = Array.from(nodeMap.values());

      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
        // Fuerza 1: Repulsión (Nodos se empujan entre sí)
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            
            const dx = n1.pos.x - n2.pos.x;
            const dy = n1.pos.y - n2.pos.y;
            let distSq = dx * dx + dy * dy;
            if (distSq === 0) distSq = 0.01;
            const dist = Math.sqrt(distSq);

            const force = PHYSICS_CONFIG.REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          }
        }

        // Fuerza 2: Atracción de Enlace (El resorte tira entre padre e hijo para mantenerlos cercanos angularmente)
        simLinks.forEach(link => {
          const source = nodeMap.get(link.sourceId)!;
          const target = nodeMap.get(link.targetId)!;
          
          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          
          const idealDist = PHYSICS_CONFIG.ORBIT_RADII[link.level] - PHYSICS_CONFIG.ORBIT_RADII[link.level - 1];
          const displacement = dist - (idealDist > 0 ? idealDist : 100);
          
          const force = displacement * PHYSICS_CONFIG.SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.level !== 0) { source.vx += fx; source.vy += fy; }
          if (target.level !== 0) { target.vx -= fx; target.vy -= fy; }
        });

        // Fuerza 3: Gravedad Orbital (Empuja al nodo a su anillo concéntrico)
        simNodes.forEach(node => {
          if (node.level !== 0) {
            const dx = CENTER.x - node.pos.x;
            const dy = CENTER.y - node.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            
            const targetRadius = PHYSICS_CONFIG.ORBIT_RADII[node.level] || 500;
            const displacement = dist - targetRadius;
            
            const force = displacement * PHYSICS_CONFIG.RADIAL_SPRING_K;
            
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        });

        // Aplicar Cinemática
        simNodes.forEach(node => {
          if (node.level !== 0) {
            node.pos.x += node.vx;
            node.pos.y += node.vy;
            node.vx *= PHYSICS_CONFIG.DAMPING;
            node.vy *= PHYSICS_CONFIG.DAMPING;
          }
        });
      }\n```\n### Replacement (Chunk 1)\n```tsx\n      simNodes = Array.from(nodeMap.values());

      // 1. Cálculo de Radios Dinámicos Expansivos
      const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      simNodes.forEach(n => { 
        if (n.level > 0) levelCounts[n.level] = (levelCounts[n.level] || 0) + 1; 
      });
      
      const dynamicRadii: Record<number, number> = { 0: 0 };
      let lastRadius = 0;
      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; // 50px de espacio vital por nodo
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140; // Espaciado mínimo
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
          lastRadius = dynamicRadii[lvl];
        } else {
          dynamicRadii[lvl] = lastRadius + 140;
          lastRadius = dynamicRadii[lvl];
        }
      }

      // 2. Simulación de Físicas
      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
        // Fuerza 1: Repulsión (Anti-colisión suavizada)
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            
            const dx = n1.pos.x - n2.pos.x;
            const dy = n1.pos.y - n2.pos.y;
            let distSq = dx * dx + dy * dy;
            // Suavizado para evitar asintotas a infinito (división por cero)
            distSq += PHYSICS_CONFIG.REPULSION_SOFTENING;
            
            const dist = Math.sqrt(distSq);

            const force = PHYSICS_CONFIG.REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          }
        }

        // Fuerza 2: Atracción de Enlace
        simLinks.forEach(link => {
          const source = nodeMap.get(link.sourceId)!;
          const target = nodeMap.get(link.targetId)!;
          
          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          
          const idealDist = dynamicRadii[link.level] - dynamicRadii[link.level - 1];
          const displacement = dist - (idealDist > 0 ? idealDist : 100);
          
          const force = displacement * PHYSICS_CONFIG.SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.level !== 0) { source.vx += fx; source.vy += fy; }
          if (target.level !== 0) { target.vx -= fx; target.vy -= fy; }
        });

        // Fuerza 3: Gravedad Orbital
        simNodes.forEach(node => {
          if (node.level !== 0) {
            const dx = CENTER.x - node.pos.x;
            const dy = CENTER.y - node.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            
            const targetRadius = dynamicRadii[node.level] || 500;
            const displacement = dist - targetRadius;
            
            const force = displacement * PHYSICS_CONFIG.RADIAL_SPRING_K;
            
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        });

        // Aplicar Cinemática con Clamping (Anti-Explosión)
        simNodes.forEach(node => {
          if (node.level !== 0) {
            // Clamping de Velocidad
            node.vx = Math.max(-PHYSICS_CONFIG.MAX_VELOCITY, Math.min(PHYSICS_CONFIG.MAX_VELOCITY, node.vx));
            node.vy = Math.max(-PHYSICS_CONFIG.MAX_VELOCITY, Math.min(PHYSICS_CONFIG.MAX_VELOCITY, node.vy));
            
            node.pos.x += node.vx;
            node.pos.y += node.vy;
            node.vx *= PHYSICS_CONFIG.DAMPING;
            node.vy *= PHYSICS_CONFIG.DAMPING;
          }
        });
      }\n```\n\n---\n\n## Step 1527 - replace_file_content\nInstruction: Replace physics engine with deterministic radial tree layout\n### Target (Chunk 1)\n```tsx\n      // El nodo principal (nivel 0) siempre va al centro inicialmente
      const mainNodes = topology.nodes.filter(n => n.level === 0);
      if (mainNodes.length > 0) {
        nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };
      } else {
        setIsLoading(false);
        return;
      }

      simLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        level: l.level
      }));

      simNodes = Array.from(nodeMap.values());

      // 1. Cálculo de Radios Dinámicos Expansivos
      const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      simNodes.forEach(n => { 
        if (n.level > 0) levelCounts[n.level] = (levelCounts[n.level] || 0) + 1; 
      });
      
      const dynamicRadii: Record<number, number> = { 0: 0 };
      let lastRadius = 0;
      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; // 50px de espacio vital por nodo
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140; // Espaciado mínimo
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
          lastRadius = dynamicRadii[lvl];
        } else {
          dynamicRadii[lvl] = lastRadius + 140;
          lastRadius = dynamicRadii[lvl];
        }
      }

      // 2. Simulación de Físicas
      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
        // Fuerza 1: Repulsión (Anti-colisión suavizada)
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const n1 = simNodes[i];
            const n2 = simNodes[j];
            
            const dx = n1.pos.x - n2.pos.x;
            const dy = n1.pos.y - n2.pos.y;
            let distSq = dx * dx + dy * dy;
            // Suavizado para evitar asintotas a infinito (división por cero)
            distSq += PHYSICS_CONFIG.REPULSION_SOFTENING;
            
            const dist = Math.sqrt(distSq);

            const force = PHYSICS_CONFIG.REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          }
        }

        // Fuerza 2: Atracción de Enlace
        simLinks.forEach(link => {
          const source = nodeMap.get(link.sourceId)!;
          const target = nodeMap.get(link.targetId)!;
          
          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          
          const idealDist = dynamicRadii[link.level] - dynamicRadii[link.level - 1];
          const displacement = dist - (idealDist > 0 ? idealDist : 100);
          
          const force = displacement * PHYSICS_CONFIG.SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.level !== 0) { source.vx += fx; source.vy += fy; }
          if (target.level !== 0) { target.vx -= fx; target.vy -= fy; }
        });

        // Fuerza 3: Gravedad Orbital
        simNodes.forEach(node => {
          if (node.level !== 0) {
            const dx = CENTER.x - node.pos.x;
            const dy = CENTER.y - node.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            
            const targetRadius = dynamicRadii[node.level] || 500;
            const displacement = dist - targetRadius;
            
            const force = displacement * PHYSICS_CONFIG.RADIAL_SPRING_K;
            
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        });

        // Aplicar Cinemática con Clamping (Anti-Explosión)
        simNodes.forEach(node => {
          if (node.level !== 0) {
            // Clamping de Velocidad
            node.vx = Math.max(-PHYSICS_CONFIG.MAX_VELOCITY, Math.min(PHYSICS_CONFIG.MAX_VELOCITY, node.vx));
            node.vy = Math.max(-PHYSICS_CONFIG.MAX_VELOCITY, Math.min(PHYSICS_CONFIG.MAX_VELOCITY, node.vy));
            
            node.pos.x += node.vx;
            node.pos.y += node.vy;
            node.vx *= PHYSICS_CONFIG.DAMPING;
            node.vy *= PHYSICS_CONFIG.DAMPING;
          }
        });
      }

      setNodes(simNodes);
      setLinks(simLinks.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level
      })));
      setIsLoading(false);\n```\n### Replacement (Chunk 1)\n```tsx\n      const mainNodes = topology.nodes.filter(n => n.level === 0);
      if (mainNodes.length === 0) {
        setIsLoading(false);
        return;
      }
      const mainId = mainNodes[0].networkData.id;

      // 1. Construir árbol de adyacencia (Padre -> Hijos)
      const childrenMap = new Map<string, string[]>();
      topology.links.forEach(l => {
        if (!childrenMap.has(l.sourceId)) childrenMap.set(l.sourceId, []);
        childrenMap.get(l.sourceId)!.push(l.targetId);
      });

      // 2. Cálculo de Radios Dinámicos
      const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      topology.nodes.forEach(n => { 
        if (n.level > 0) levelCounts[n.level] = (levelCounts[n.level] || 0) + 1; 
      });
      
      const dynamicRadii: Record<number, number> = { 0: 0 };
      let lastRadius = 0;
      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; 
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140;
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
          lastRadius = dynamicRadii[lvl];
        }
      }

      // 3. Algoritmo Radial Determinista (O(N))
      const distributeNodes = (nodeId: string, angleStart: number, angleEnd: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const sliceAngle = (angleEnd - angleStart) / children.length;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const myAngleStart = angleStart + index * sliceAngle;
          const myAngleEnd = myAngleStart + sliceAngle;
          const centerAngle = (myAngleStart + myAngleEnd) / 2;

          const radius = dynamicRadii[currentLevel + 1];
          
          childNode.pos.x = CENTER.x + Math.cos(centerAngle) * radius;
          childNode.pos.y = CENTER.y + Math.sin(centerAngle) * radius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
        });
      };

      // Iniciar el nodo maestro en el centro y desplegar el árbol
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeNodes(mainId, 0, Math.PI * 2, 0);

      // 4. Preparar estado final
      const finalLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level
      }));

      setNodes(Array.from(nodeMap.values()));
      setLinks(finalLinks);
      setIsLoading(false);\n```\n\n---\n\n## Step 1533 - replace_file_content\nInstruction: Fix the deterministic layout logic\n### Target (Chunk 1)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; 
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140;
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
          lastRadius = dynamicRadii[lvl];
        return { p1: source.pos, p2: target.pos, level: link.level };
      });

      // Calcular el radio máximo dinámico (distancia del nodo más lejano al centro)
      let maxR = 100; // Mínimo
      simNodes.forEach(n => {
        const dist = Math.sqrt(Math.pow(n.pos.x - CENTER.x, 2) + Math.pow(n.pos.y - CENTER.y, 2));
        if (dist > maxR) maxR = dist;
      });
      setBounds({ R: maxR });

      setNodes(simNodes);
      setLinks(renderLinks);
      setIsLoading(false);\n```\n### Replacement (Chunk 1)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; 
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140;
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
          lastRadius = dynamicRadii[lvl];
        }
      }

      // 3. Algoritmo Radial Determinista (O(N))
      const distributeNodes = (nodeId: string, angleStart: number, angleEnd: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const sliceAngle = (angleEnd - angleStart) / children.length;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const myAngleStart = angleStart + index * sliceAngle;
          const myAngleEnd = myAngleStart + sliceAngle;
          const centerAngle = (myAngleStart + myAngleEnd) / 2;

          const radius = dynamicRadii[currentLevel + 1];
          
          childNode.pos.x = CENTER.x + Math.cos(centerAngle) * radius;
          childNode.pos.y = CENTER.y + Math.sin(centerAngle) * radius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
        });
      };

      // Iniciar el nodo maestro en el centro y desplegar el árbol
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeNodes(mainId, 0, Math.PI * 2, 0);

      // 4. Preparar estado final
      const simNodes = Array.from(nodeMap.values());
      const renderLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level
      }));\n```\n\n---\n\n## Step 1536 - replace_file_content\nInstruction: Add setBounds and setNodes back\n### Target (Chunk 1)\n```tsx\n      // 4. Preparar estado final
      const simNodes = Array.from(nodeMap.values());
      const renderLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level
      }));\n```\n### Replacement (Chunk 1)\n```tsx\n      // 4. Preparar estado final
      const simNodes = Array.from(nodeMap.values());
      const renderLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level
      }));

      // Calcular el radio máximo dinámico (distancia del nodo más lejano al centro)
      let maxR = 100; // Mínimo
      simNodes.forEach(n => {
        const dist = Math.sqrt(Math.pow(n.pos.x - CENTER.x, 2) + Math.pow(n.pos.y - CENTER.y, 2));
        if (dist > maxR) maxR = dist;
      });
      setBounds({ R: maxR });

      setNodes(simNodes);
      setLinks(renderLinks);
      setIsLoading(false);\n```\n\n---\n\n## Step 1542 - replace_file_content\nInstruction: Add withSpring to NodeLabel, SkiaNode and SkiaLink\n### Target (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (node.pos.x - CENTER.x) * s + translateX.value;
    // Mantenemos el margen de 12px intacto, sin que se escale, para evitar el drift.
    const y = CENTER.y + (node.pos.y - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    
    // Level Of Detail (LOD) y Culling
    let opacity = 1;
    if (node.level > 1 && s < 0.6) {
      opacity = 0; // Ocultamos textos menores al alejar la cámara
    }
    // Culling espacial: si sale de los bordes del dispositivo, ni lo intentamos dibujar
    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      opacity = 0;
    }

    return {
      opacity,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

interface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isSelected: boolean;
}

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: SkiaNodeProps) => {
  const cx = useDerivedValue(() => CENTER.x + (node.pos.x - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (node.pos.y - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

interface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const SkiaLink = ({ link, scale, translateX, translateY }: SkiaLinkProps) => {
  const p1 = useDerivedValue(() => vec(
    CENTER.x + (link.p1.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p1.y - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (link.p2.x - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (link.p2.y - CENTER.y) * scale.value + translateY.value
  ));\n```\n### Replacement (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (withSpring(node.pos.x) - CENTER.x) * s + translateX.value;
    const y = CENTER.y + (withSpring(node.pos.y) - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    
    let opacity = 1;
    if (node.level > 1 && s < 0.6) {
      opacity = 0;
    }
    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      opacity = 0;
    }

    return {
      opacity,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

interface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isSelected: boolean;
}

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: SkiaNodeProps) => {
  const cx = useDerivedValue(() => CENTER.x + (withSpring(node.pos.x) - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (withSpring(node.pos.y) - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

interface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const SkiaLink = ({ link, scale, translateX, translateY }: SkiaLinkProps) => {
  const p1 = useDerivedValue(() => vec(
    CENTER.x + (withSpring(link.p1.x) - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (withSpring(link.p1.y) - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (withSpring(link.p2.x) - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (withSpring(link.p2.y) - CENTER.y) * scale.value + translateY.value
  ));\n```\n\n---\n\n## Step 1560 - multi_replace_file_content\nInstruction: Fix syntax errors in CanvasMap\n### Target (Chunk 1)\n```tsx\n      let simNodes: MapNode[] = [];
      let simLinks: MapLink[] = [];\n```\n### Replacement (Chunk 1)\n```tsx\n      let simLinks: MapLink[] = [];\n```\n### Target (Chunk 2)\n```tsx\n          pos: { 
            x: CENTER.x + (Math.random() - 0.5) * 100, 
            y: CENTER.y + (Math.random() - 0.5) * 100 
          pos: { x: 0, y: 0 },\n```\n### Replacement (Chunk 2)\n```tsx\n          pos: { x: 0, y: 0 },\n```\n\n---\n\n## Step 1569 - multi_replace_file_content\nInstruction: Fix dynamicRadii undefined values\n### Target (Chunk 1)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; 
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140;
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
          lastRadius = dynamicRadii[lvl];
        }
      }\n```\n### Replacement (Chunk 1)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; 
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140;
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
        } else {
          dynamicRadii[lvl] = lastRadius + 140;
        }
        lastRadius = dynamicRadii[lvl];
      }\n```\n\n---\n\n## Step 1575 - replace_file_content\nInstruction: Fix withSpring usage by using useEffect to update SharedValues\n### Target (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (withSpring(node.pos.x) - CENTER.x) * s + translateX.value;
    const y = CENTER.y + (withSpring(node.pos.y) - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    
    let opacity = 1;
    if (node.level > 1 && s < 0.6) {
      opacity = 0;
    }
    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      opacity = 0;
    }

    return {
      opacity,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

interface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isSelected: boolean;
}

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: SkiaNodeProps) => {
  const cx = useDerivedValue(() => CENTER.x + (withSpring(node.pos.x) - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (withSpring(node.pos.y) - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

interface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const SkiaLink = ({ link, scale, translateX, translateY }: SkiaLinkProps) => {
  const p1 = useDerivedValue(() => vec(
    CENTER.x + (withSpring(link.p1.x) - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (withSpring(link.p1.y) - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (withSpring(link.p2.x) - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (withSpring(link.p2.y) - CENTER.y) * scale.value + translateY.value
  ));\n```\n### Replacement (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const nodeRadius = node.level === 0 ? 28 : 16;
  const displayName = node.localName || node.alias;

  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (posX.value - CENTER.x) * s + translateX.value;
    const y = CENTER.y + (posY.value - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;
    
    let opacity = 1;
    if (node.level > 1 && s < 0.6) {
      opacity = 0;
    }
    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      opacity = 0;
    }

    return {
      opacity,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
};

interface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isSelected: boolean;
}

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: SkiaNodeProps) => {
  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const cx = useDerivedValue(() => CENTER.x + (posX.value - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (posY.value - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};

interface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const SkiaLink = ({ link, scale, translateX, translateY }: SkiaLinkProps) => {
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

  const p1 = useDerivedValue(() => vec(
    CENTER.x + (p1X.value - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (p1Y.value - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (p2X.value - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (p2Y.value - CENTER.y) * scale.value + translateY.value
  ));\n```\n\n---\n\n## Step 1590 - multi_replace_file_content\nInstruction: Fix culling and dynamic radii gaps\n### Target (Chunk 1)\n```tsx\n    let opacity = 1;
    if (node.level > 1 && s < 0.6) {
      opacity = 0;
    }
    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {\n```\n### Replacement (Chunk 1)\n```tsx\n    let opacity = 1;
    if (node.level > 1 && s < 0.6) opacity = 0;
    else if (node.level === 1 && s < 0.3) opacity = 0;
    else if (node.level === 0 && s < 0.15) opacity = 0;

    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {\n```\n### Target (Chunk 2)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 50; 
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 160 : 140;
          dynamicRadii[lvl] = lastRadius + Math.max(minRadiusIncrement, requiredRadius);
        } else {
          dynamicRadii[lvl] = lastRadius + 140;
        }
        lastRadius = dynamicRadii[lvl];
      }\n```\n### Replacement (Chunk 2)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 25; // 25px de arco por nodo (más compacto)
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 120 : 100; // Gap mínimo entre niveles
          
          // La distancia total desde el centro debe ser al menos el requiredRadius, pero respetando el gap mínimo con su padre
          dynamicRadii[lvl] = Math.max(lastRadius + minRadiusIncrement, requiredRadius);
        } else {
          dynamicRadii[lvl] = lastRadius + 100;
        }
        lastRadius = dynamicRadii[lvl];
      }\n```\n\n---\n\n## Step 1611 - multi_replace_file_content\nInstruction: Fix culling and add organic jitter\n### Target (Chunk 1)\n```tsx\n    let opacity = 1;
    if (node.level > 1 && s < 0.6) opacity = 0;
    else if (node.level === 1 && s < 0.3) opacity = 0;
    else if (node.level === 0 && s < 0.15) opacity = 0;\n```\n### Replacement (Chunk 1)\n```tsx\n    let opacity = 1;
    if (s < 0.6) opacity = 0; // Todos los niveles desaparecen uniformemente al alejar\n```\n### Target (Chunk 2)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 25; // 25px de arco por nodo (más compacto)
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 120 : 100; // Gap mínimo entre niveles
          
          // La distancia total desde el centro debe ser al menos el requiredRadius, pero respetando el gap mínimo con su padre
          dynamicRadii[lvl] = Math.max(lastRadius + minRadiusIncrement, requiredRadius);\n```\n### Replacement (Chunk 2)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 25; // 25px de arco por nodo (compacto)
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 120 : 80; // Apretamos aún más las bandas base
          
          dynamicRadii[lvl] = Math.max(lastRadius + minRadiusIncrement, requiredRadius);\n```\n### Target (Chunk 3)\n```tsx\n          const myAngleStart = angleStart + index * sliceAngle;
          const myAngleEnd = myAngleStart + sliceAngle;
          const centerAngle = (myAngleStart + myAngleEnd) / 2;

          const radius = dynamicRadii[currentLevel + 1];
          
          childNode.pos.x = CENTER.x + Math.cos(centerAngle) * radius;
          childNode.pos.y = CENTER.y + Math.sin(centerAngle) * radius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
        });\n```\n### Replacement (Chunk 3)\n```tsx\n          const myAngleStart = angleStart + index * sliceAngle;
          const myAngleEnd = myAngleStart + sliceAngle;
          
          // Jitter Angular: pequeña desviación aleatoria determinista (± 0.1 radianes)
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = Math.sin(index * 73) * 0.1;
          const finalAngle = baseCenterAngle + angleJitter;

          // Jitter de Radio (Sub-órbitas): alternamos las distancias en una banda de ±30px
          const baseRadius = dynamicRadii[currentLevel + 1];
          const radiusStagger = (index % 3 - 1) * 30; // -30, 0, o 30
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = CENTER.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = CENTER.y + Math.sin(finalAngle) * finalRadius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
        });\n```\n\n---\n\n## Step 1626 - replace_file_content\nInstruction: Adjust dynamic radii calculation to account for sub-orbits and prevent collisions\n### Target (Chunk 1)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          const requiredCircumference = numNodes * 25; // 25px de arco por nodo (compacto)
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 120 : 80; // Apretamos aún más las bandas base
          
          dynamicRadii[lvl] = Math.max(lastRadius + minRadiusIncrement, requiredRadius);\n```\n### Replacement (Chunk 1)\n```tsx\n      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          // Ya que dividimos en 3 sub-órbitas, la cantidad efectiva de nodos por anillo es un tercio
          const effectiveNumNodes = Math.ceil(numNodes / 3);
          const requiredCircumference = effectiveNumNodes * 60; // 60px de espacio vital GARANTIZADO por nodo
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 130 : 90; 
          
          dynamicRadii[lvl] = Math.max(lastRadius + minRadiusIncrement, requiredRadius);\n```\n\n---\n\n## Step 1632 - replace_file_content\nInstruction: Use descendant weight for sliceAngle and clamp jitter\n### Target (Chunk 1)\n```tsx\n      // 3. Algoritmo Radial Determinista (O(N))
      const distributeNodes = (nodeId: string, angleStart: number, angleEnd: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const sliceAngle = (angleEnd - angleStart) / children.length;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const myAngleStart = angleStart + index * sliceAngle;
          const myAngleEnd = myAngleStart + sliceAngle;
          
          // Jitter Angular: pequeña desviación aleatoria determinista (± 0.1 radianes)
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = Math.sin(index * 73) * 0.1;
          const finalAngle = baseCenterAngle + angleJitter;

          // Jitter de Radio (Sub-órbitas): alternamos las distancias en una banda de ±30px
          const baseRadius = dynamicRadii[currentLevel + 1];
          const radiusStagger = (index % 3 - 1) * 30; // -30, 0, o 30
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = CENTER.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = CENTER.y + Math.sin(finalAngle) * finalRadius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
        });
      };\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Algoritmo Radial Determinista por Peso (O(N))
      // Primero calculamos el "peso" de cada rama (cuántos descendientes tiene)
      const nodeWeight = new Map<string, number>();
      const calculateWeight = (nodeId: string): number => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) {
          nodeWeight.set(nodeId, 1); // Un nodo hoja vale 1
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

      const distributeNodes = (nodeId: string, angleStart: number, angleEnd: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        const totalAngle = angleEnd - angleStart;
        
        let currentAngleStart = angleStart;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * totalAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          // Jitter Angular Limitado: nunca exceder el 25% de su propia porción para no invadir al vecino
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const maxJitter = sliceAngle * 0.25; 
          const angleJitter = Math.sin(index * 73) * maxJitter;
          const finalAngle = baseCenterAngle + angleJitter;

          // Jitter de Radio (Sub-órbitas): alternamos las distancias en una banda de ±25px
          const baseRadius = dynamicRadii[currentLevel + 1];
          const radiusStagger = (index % 3 - 1) * 25; // -25, 0, o 25
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = CENTER.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = CENTER.y + Math.sin(finalAngle) * finalRadius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n\n---\n\n## Step 1650 - replace_file_content\nInstruction: Replace deterministic layout with expanded star topology\n### Target (Chunk 1)\n```tsx\n      // 2. Cálculo de Radios Dinámicos
      const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      topology.nodes.forEach(n => { 
        if (n.level > 0) levelCounts[n.level] = (levelCounts[n.level] || 0) + 1; 
      });
      
      const dynamicRadii: Record<number, number> = { 0: 0 };
      let lastRadius = 0;
      for (let lvl = 1; lvl <= 5; lvl++) {
        const numNodes = levelCounts[lvl];
        if (numNodes > 0) {
          // Ya que dividimos en 3 sub-órbitas, la cantidad efectiva de nodos por anillo es un tercio
          const effectiveNumNodes = Math.ceil(numNodes / 3);
          const requiredCircumference = effectiveNumNodes * 60; // 60px de espacio vital GARANTIZADO por nodo
          const requiredRadius = requiredCircumference / (2 * Math.PI);
          const minRadiusIncrement = lvl === 1 ? 130 : 90; 
          
          dynamicRadii[lvl] = Math.max(lastRadius + minRadiusIncrement, requiredRadius);
        } else {
          dynamicRadii[lvl] = lastRadius + 100;
        }
        lastRadius = dynamicRadii[lvl];
      }

      // 3. Algoritmo Radial Determinista por Peso (O(N))
      // Primero calculamos el "peso" de cada rama (cuántos descendientes tiene)
      const nodeWeight = new Map<string, number>();
      const calculateWeight = (nodeId: string): number => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) {
          nodeWeight.set(nodeId, 1); // Un nodo hoja vale 1
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

      const distributeNodes = (nodeId: string, angleStart: number, angleEnd: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        const totalAngle = angleEnd - angleStart;
        
        let currentAngleStart = angleStart;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * totalAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          // Jitter Angular Limitado: nunca exceder el 25% de su propia porción para no invadir al vecino
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const maxJitter = sliceAngle * 0.25; 
          const angleJitter = Math.sin(index * 73) * maxJitter;
          const finalAngle = baseCenterAngle + angleJitter;

          // Jitter de Radio (Sub-órbitas): alternamos las distancias en una banda de ±25px
          const baseRadius = dynamicRadii[currentLevel + 1];
          const radiusStagger = (index % 3 - 1) * 25; // -25, 0, o 25
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = CENTER.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = CENTER.y + Math.sin(finalAngle) * finalRadius;

          distributeNodes(childId, myAngleStart, myAngleEnd, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };

      // Iniciar el nodo maestro en el centro y desplegar el árbol
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeNodes(mainId, 0, Math.PI * 2, 0);\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Algoritmo de Estrella Expandida (O(N))
      // Primero calculamos el "peso" de cada rama (cuántos descendientes tiene)
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

      const branchLengths: Record<number, number> = { 1: 200, 2: 120, 3: 80, 4: 60, 5: 50 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        let currentAngleStart = directionAngle - sweepAngle / 2;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * sweepAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          
          // Jitter angular mínimo para naturalidad
          const angleJitter = Math.sin(index * 73) * (sliceAngle * 0.1);
          const finalAngle = baseCenterAngle + angleJitter;

          // El primer nivel necesita calcular su radio dinámicamente si hay muchos nodos para no chocar en el centro
          let baseRadius = branchLengths[currentLevel + 1] || 50;
          if (currentLevel === 0) {
            const requiredCircumference = children.length * 50;
            baseRadius = Math.max(200, requiredCircumference / (2 * Math.PI));
          }
          
          // Jitter de Radio para efecto "racimo" (cluster)
          const radiusStagger = (index % 3 - 1) * 20; // -20, 0, o 20
          const finalRadius = baseRadius + radiusStagger;
          
          // Posición RELATIVA al padre (Constelación local)
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Hijos usan un abanico más amplio que su tajada estricta para formar racimos locales.
          // Limitamos el abanico a máximo 200 grados (aprox) para que no crezcan hacia atrás y choquen con el abuelo.
          const childSweep = Math.min(Math.PI * 1.1, sliceAngle * 1.8);
          
          distributeStarNodes(childId, childNode.pos, finalAngle, childSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };

      // Iniciar el nodo maestro en el centro y desplegar las estrellas
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);\n```\n\n---\n\n## Step 1677 - replace_file_content\nInstruction: Implement Pure 360 Fractal Layout\n### Target (Chunk 1)\n```tsx\n      const branchLengths: Record<number, number> = { 1: 200, 2: 120, 3: 80, 4: 60, 5: 50 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        let currentAngleStart = directionAngle - sweepAngle / 2;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * sweepAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          
          // Jitter angular mínimo para naturalidad
          const angleJitter = Math.sin(index * 73) * (sliceAngle * 0.1);
          const finalAngle = baseCenterAngle + angleJitter;

          // El primer nivel necesita calcular su radio dinámicamente si hay muchos nodos para no chocar en el centro
          let baseRadius = branchLengths[currentLevel + 1] || 50;
          if (currentLevel === 0) {
            const requiredCircumference = children.length * 50;
            baseRadius = Math.max(200, requiredCircumference / (2 * Math.PI));
          }
          
          // Jitter de Radio para efecto "racimo" (cluster)
          const radiusStagger = (index % 3 - 1) * 20; // -20, 0, o 20
          const finalRadius = baseRadius + radiusStagger;
          
          // Posición RELATIVA al padre (Constelación local)
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Hijos usan un abanico más amplio que su tajada estricta para formar racimos locales.
          // Limitamos el abanico a máximo 200 grados (aprox) para que no crezcan hacia atrás y choquen con el abuelo.
          const childSweep = Math.min(Math.PI * 1.1, sliceAngle * 1.8);
          
          distributeStarNodes(childId, childNode.pos, finalAngle, childSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n### Replacement (Chunk 1)\n```tsx\n      const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        // FASE 16: Estrella Fractal 360°. Siempre propagamos en un círculo completo.
        const actualSweep = Math.PI * 2;
        let currentAngleStart = directionAngle; // Iniciamos desde el ángulo de procedencia para variación rotacional
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          // Jitter angular mínimo (sólo para niveles profundos)
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            // Nivel 1: Órbitas Escalonadas Agresivas para hacer espacio al 360° de sus hijos
            // Repartimos los Nodos Nivel 1 en 5 órbitas diferentes separadas por 200px (ej: 250, 450, 650, 850, 1050)
            baseRadius = 250 + (index % 5) * 200; 
          } else if (currentLevel === 1) {
            baseRadius = 100;
          } else if (currentLevel === 2) {
            baseRadius = 40;
          }
          
          // Jitter de Radio para efecto orgánico sutil
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Llamada recursiva siempre forza 360 grados
          distributeStarNodes(childId, childNode.pos, finalAngle, actualSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n\n---\n\n## Step 1704 - multi_replace_file_content\nInstruction: Colorize links based on target node color\n### Target (Chunk 1)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}\n```\n### Replacement (Chunk 1)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}\n```\n### Target (Chunk 2)\n```tsx\n  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={link.level === 1 ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)"} 
      strokeWidth={link.level === 1 ? 2.5 : 1.5} 
    />
  );\n```\n### Replacement (Chunk 2)\n```tsx\n  return (
    <Line 
      p1={p1} 
      p2={p2} 
      // Añadimos transparencia en HEX al color (66 = 40%, 33 = 20%)
      color={link.level === 1 ? `${link.color}66` : `${link.color}33`} 
      strokeWidth={link.level === 1 ? 2.5 : 1.5} 
    />
  );\n```\n### Target (Chunk 3)\n```tsx\n  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);\n```\n### Replacement (Chunk 3)\n```tsx\n  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);\n```\n### Target (Chunk 4)\n```tsx\n      const renderLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level
      }));\n```\n### Replacement (Chunk 4)\n```tsx\n      const renderLinks = topology.links.map(l => {
        const targetNode = nodeMap.get(l.targetId)!;
        return {
          p1: nodeMap.get(l.sourceId)!.pos,
          p2: targetNode.pos,
          level: l.level,
          color: targetNode.color
        };
      });\n```\n\n---\n\n## Step 1710 - multi_replace_file_content\nInstruction: Hide links temporarily\n### Target (Chunk 1)\n```tsx\n          <Canvas style={{ flex: 1 }}>
            {links.map((link, i) => (
              <SkiaLink 
                key={`link-${i}`} 
                link={link} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}

            {nodes.map((node) => (\n```\n### Replacement (Chunk 1)\n```tsx\n          <Canvas style={{ flex: 1 }}>
            {/* Ocultamos las líneas temporalmente a petición
            {links.map((link, i) => (
              <SkiaLink 
                key={`link-${i}`} 
                link={link} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}
            */}

            {nodes.map((node) => (\n```\n\n---\n\n## Step 1732 - multi_replace_file_content\nInstruction: Implement Global Transform and remove redundant hooks\n### Target (Chunk 1)\n```tsx\ninterface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isSelected: boolean;
}

const SkiaNode = ({ node, scale, translateX, translateY, isSelected }: SkiaNodeProps) => {
  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const cx = useDerivedValue(() => CENTER.x + (posX.value - CENTER.x) * scale.value + translateX.value);
  const cy = useDerivedValue(() => CENTER.y + (posY.value - CENTER.y) * scale.value + translateY.value);
  const rBlur = useDerivedValue(() => (node.level === 0 ? 45 : 24) * scale.value);
  const rMain = useDerivedValue(() => (node.level === 0 ? 28 : 16) * scale.value);
  const rSel = useDerivedValue(() => (node.level === 0 ? 34 : 22) * scale.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={cx} cy={cy} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};\n```\n### Replacement (Chunk 1)\n```tsx\ninterface SkiaNodeProps {
  node: MapNode;
  isSelected: boolean;
}

const SkiaNode = ({ node, isSelected }: SkiaNodeProps) => {
  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const rBlur = node.level === 0 ? 45 : 24;
  const rMain = node.level === 0 ? 28 : 16;
  const rSel = node.level === 0 ? 34 : 22;

  // En lugar de calcular cx/cy constantemente, aplicamos un transform matricial
  const transform = useDerivedValue(() => [{ translateX: posX.value }, { translateY: posY.value }]);

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={0} cy={0} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};\n```\n### Target (Chunk 2)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string };
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const SkiaLink = ({ link, scale, translateX, translateY }: SkiaLinkProps) => {
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

  const p1 = useDerivedValue(() => vec(
    CENTER.x + (p1X.value - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (p1Y.value - CENTER.y) * scale.value + translateY.value
  ));
  const p2 = useDerivedValue(() => vec(
    CENTER.x + (p2X.value - CENTER.x) * scale.value + translateX.value,
    CENTER.y + (p2Y.value - CENTER.y) * scale.value + translateY.value
  ));
  
  return (\n```\n### Replacement (Chunk 2)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string };
}

const SkiaLink = ({ link }: SkiaLinkProps) => {
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
  
  return (\n```\n\n---\n\n## Step 1740 - multi_replace_file_content\nInstruction: Add globalTransform and wrap Canvas elements\n### Target (Chunk 1)\n```tsx\n  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            {/* Ocultamos las líneas temporalmente a petición
            {links.map((link, i) => (
              <SkiaLink 
                key={`link-${i}`} 
                link={link} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
              />
            ))}
            */}

            {nodes.map((node) => (
              <SkiaNode 
                key={`node-${node.id}`} 
                node={node} 
                scale={scale} 
                translateX={translateX} 
                translateY={translateY} 
                isSelected={selectedNode?.id === node.id}
              />
            ))}
          </Canvas>\n```\n### Replacement (Chunk 1)\n```tsx\n  const globalTransform = useDerivedValue(() => {
    return [
      { translateX: CENTER.x + translateX.value },
      { translateY: CENTER.y + translateY.value },
      { scale: scale.value },
      { translateX: -CENTER.x },
      { translateY: -CENTER.y },
    ];
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={globalTransform}>
              {/* Reactivamos las líneas conectoras */}
              {links.map((link, i) => (
                <SkiaLink 
                  key={`link-${i}`} 
                  link={link} 
                />
              ))}

              {nodes.map((node) => (
                <SkiaNode 
                  key={`node-${node.id}`} 
                  node={node} 
                  isSelected={selectedNode?.id === node.id}
                />
              ))}
            </Group>
          </Canvas>\n```\n\n---\n\n## Step 1746 - multi_replace_file_content\nInstruction: Implement Async Physics and Progressive Loading\n### Target (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 12000,
  REPULSION_SOFTENING: 300, // Evita división por cero cuando los nodos están encimados
  SPRING_K: 0.05,
  RADIAL_SPRING_K: 0.1, 
  DAMPING: 0.7,
  MAX_VELOCITY: 40 // Límite de velocidad absoluta (Anti-explosión matemática)
};\n```\n### Replacement (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 30000, // Fuerza extrema para evitar cualquier tipo de colisión
  REPULSION_SOFTENING: 300, 
  SPRING_K: 0.05,
  RADIAL_SPRING_K: 0.08, 
  DAMPING: 0.6,
  MAX_VELOCITY: 50
};\n```\n### Target (Chunk 2)\n```tsx\n      const mainNodes = topology.nodes.filter(n => n.level === 0);
      if (mainNodes.length === 0) {
        setIsLoading(false);
        return;
      }
      const mainId = mainNodes[0].networkData.id;

      // 1. Construir árbol de adyacencia (Padre -> Hijos)
      const childrenMap = new Map<string, string[]>();
      topology.links.forEach(l => {
        if (!childrenMap.has(l.sourceId)) childrenMap.set(l.sourceId, []);
        childrenMap.get(l.sourceId)!.push(l.targetId);
      });

      // 3. Algoritmo de Estrella Expandida (O(N))
      // Primero calculamos el "peso" de cada rama (cuántos descendientes tiene)
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
        
        // FASE 16: Estrella Fractal 360°. Siempre propagamos en un círculo completo.
        const actualSweep = Math.PI * 2;
        let currentAngleStart = directionAngle; // Iniciamos desde el ángulo de procedencia para variación rotacional
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          // Jitter angular mínimo (sólo para niveles profundos)
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            // Nivel 1: Órbitas Escalonadas Agresivas para hacer espacio al 360° de sus hijos
            // Repartimos los Nodos Nivel 1 en 5 órbitas diferentes separadas por 200px (ej: 250, 450, 650, 850, 1050)
            baseRadius = 250 + (index % 5) * 200; 
          } else if (currentLevel === 1) {
            baseRadius = 100;
          } else if (currentLevel === 2) {
            baseRadius = 40;
          }
          
          // Jitter de Radio para efecto orgánico sutil
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Llamada recursiva siempre forza 360 grados
          distributeStarNodes(childId, childNode.pos, finalAngle, actualSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };

      // Iniciar el nodo maestro en el centro y desplegar las estrellas
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);

      // 4. Preparar estado final
      const simNodes = Array.from(nodeMap.values());
      const renderLinks = topology.links.map(l => {
        const targetNode = nodeMap.get(l.targetId)!;
        return {
          p1: nodeMap.get(l.sourceId)!.pos,
          p2: targetNode.pos,
          level: l.level,
          color: targetNode.color
        };
      });

      // Calcular el radio máximo dinámico (distancia del nodo más lejano al centro)
      let maxR = 100; // Mínimo
      simNodes.forEach(n => {
        const dist = Math.sqrt(Math.pow(n.pos.x - CENTER.x, 2) + Math.pow(n.pos.y - CENTER.y, 2));
        if (dist > maxR) maxR = dist;
      });
      setBounds({ R: maxR });

      setNodes(simNodes);
      setLinks(renderLinks);
      setIsLoading(false);\n```\n### Replacement (Chunk 2)\n```tsx\n      const mainNodes = topology.nodes.filter(n => n.level === 0);
      if (mainNodes.length === 0) {
        setIsLoading(false);
        return;
      }
      
      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));

      // Iniciar a todos en el centro
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });

      nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };

      // Carga Progresiva Asíncrona (Nivel 0 y 1 primero)
      let currentVisibleLevel = 1;
      
      const updateVisibleGraph = () => {
        const visibleNodes = allSimNodes.filter(n => n.level <= currentVisibleLevel);
        const visibleLinks = allSimLinks.filter(l => l.level <= currentVisibleLevel);
        
        // Ejecutar 50 iteraciones de físicas para estabilizar el nuevo nivel antes de mostrarlo
        for (let iter = 0; iter < 50; iter++) {
          // Repulsión
          for (let i = 0; i < visibleNodes.length; i++) {
            for (let j = i + 1; j < visibleNodes.length; j++) {
              const n1 = visibleNodes[i];
              const n2 = visibleNodes[j];
              const dx = n2.pos.x - n1.pos.x;
              const dy = n2.pos.y - n1.pos.y;
              const distSq = dx * dx + dy * dy;
              
              if (distSq > 0 && distSq < 100000) { 
                const dist = Math.sqrt(distSq);
                const force = PHYSICS_CONFIG.REPULSION / (distSq + PHYSICS_CONFIG.REPULSION_SOFTENING);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                if (n1.level !== 0) { n1.vx -= fx; n1.vy -= fy; }
                if (n2.level !== 0) { n2.vx += fx; n2.vy += fy; }
              }
            }
          }
          
          // Resortes de Links
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const targetDist = link.level === 1 ? 250 : 100;
            const force = (dist - targetDist) * PHYSICS_CONFIG.SPRING_K;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });
          
          // Gravedad radial suave y Aplicar Velocidad
          visibleNodes.forEach(n => {
            if (n.level === 0) return;
            
            const dx = CENTER.x - n.pos.x;
            const dy = CENTER.y - n.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const radialForce = dist * PHYSICS_CONFIG.RADIAL_SPRING_K;
            n.vx += (dx / dist) * radialForce;
            n.vy += (dy / dist) * radialForce;
            
            n.vx *= PHYSICS_CONFIG.DAMPING;
            n.vy *= PHYSICS_CONFIG.DAMPING;
            
            const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (speed > PHYSICS_CONFIG.MAX_VELOCITY) {
              n.vx = (n.vx / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
              n.vy = (n.vy / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
            }
            
            n.pos.x += n.vx;
            n.pos.y += n.vy;
          });
        }

        // Renderizar (con withSpring interpolará bellamente los brincos)
        setNodes([...visibleNodes]);
        setLinks([...visibleLinks]);
        setBounds({ R: 1500 });
        
        if (currentVisibleLevel === 1) setIsLoading(false);

        if (currentVisibleLevel < 3) {
          currentVisibleLevel++;
          setTimeout(updateVisibleGraph, 800); // Inyectar siguiente nivel en 800ms
        }
      };

      // Iniciar cascada de renderizado asíncrono
      setTimeout(updateVisibleGraph, 100);\n```\n\n---\n\n## Step 1761 - replace_file_content\nInstruction: Fix Rules of Hooks violation by moving globalTransform up\n### Target (Chunk 1)\n```tsx\n  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  const globalTransform = useDerivedValue(() => {
    return [
      { translateX: CENTER.x + translateX.value },
      { translateY: CENTER.y + translateY.value },
      { scale: scale.value },
      { translateX: -CENTER.x },
      { translateY: -CENTER.y },
    ];
  });\n```\n### Replacement (Chunk 1)\n```tsx\n  const globalTransform = useDerivedValue(() => {
    return [
      { translateX: CENTER.x + translateX.value },
      { translateY: CENTER.y + translateY.value },
      { scale: scale.value },
      { translateX: -CENTER.x },
      { translateY: -CENTER.y },
    ];
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }\n```\n\n---\n\n## Step 1770 - multi_replace_file_content\nInstruction: Fix Worklet serialization warning in tapGesture\n### Target (Chunk 1)\n```tsx\n  const tapGesture = Gesture.Tap()
    .maxDistance(10) // EXCLUSIVIDAD: Si el dedo se mueve más de 10px, se cancela el tap.
    .onEnd((e) => {
      const originX = width / 2;
      const originY = height / 2;\n```\n### Replacement (Chunk 1)\n```tsx\n  const tapGesture = Gesture.Tap()
    .maxDistance(10) // EXCLUSIVIDAD: Si el dedo se mueve más de 10px, se cancela el tap.
    .runOnJS(true) // <-- Evita que 'nodes' se serialice al hilo de UI y choque con el motor de físicas
    .onEnd((e) => {
      const originX = width / 2;
      const originY = height / 2;\n```\n\n---\n\n## Step 1782 - multi_replace_file_content\nInstruction: Implement debugging slider and real-time topology filtering\n### Target (Chunk 1)\n```tsx\n  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    const loadTopology = async () => {
      await injectDummyTopology();

      const topology = await CitizenRepository.getHydratedCitizens();\n```\n### Replacement (Chunk 1)\n```tsx\n  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [nodeLimit, setNodeLimit] = useState(10);
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

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
    const topology = fullTopology;\n```\n### Target (Chunk 2)\n```tsx\n      // Iniciar a todos en el centro
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });

      nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };

      // Carga Progresiva Asíncrona (Nivel 0 y 1 primero)
      let currentVisibleLevel = 1;
      
      const updateVisibleGraph = () => {
        const visibleNodes = allSimNodes.filter(n => n.level <= currentVisibleLevel);
        const visibleLinks = allSimLinks.filter(l => l.level <= currentVisibleLevel);\n```\n### Replacement (Chunk 2)\n```tsx\n      // Iniciar a todos en el centro
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });

      nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };

      // Carga Progresiva Asíncrona (Nivel 0 y 1 primero)
      let currentVisibleLevel = 1;
      
      const updateVisibleGraph = () => {
        if (!isActive) return;

        // Limitar la cantidad de nodos y el nivel visible
        const allowedNodes = allSimNodes.slice(0, nodeLimit);
        const allowedIds = new Set(allowedNodes.map(n => n.id));
        
        const visibleNodes = allowedNodes.filter(n => n.level <= currentVisibleLevel);
        const visibleLinks = allSimLinks.filter(l => 
          l.level <= currentVisibleLevel && allowedIds.has(l.sourceId) && allowedIds.has(l.targetId)
        );\n```\n### Target (Chunk 3)\n```tsx\n        if (currentVisibleLevel < 3) {
          currentVisibleLevel++;
          setTimeout(updateVisibleGraph, 800); // Inyectar siguiente nivel en 800ms
        }
      };

      // Iniciar cascada de renderizado asíncrono
      setTimeout(updateVisibleGraph, 100);
    };

    loadTopology();
  }, []);\n```\n### Replacement (Chunk 3)\n```tsx\n        if (currentVisibleLevel < 3) {
          currentVisibleLevel++;
          setTimeout(updateVisibleGraph, 800); // Inyectar siguiente nivel en 800ms
        }
      };

      // Iniciar cascada de renderizado asíncrono
      setTimeout(updateVisibleGraph, 100);

      return () => {
        isActive = false; // Matar bucle si cambian dependencias
      };
    };

    loadTopology();
  }, [fullTopology, nodeLimit]);\n```\n### Target (Chunk 4)\n```tsx\n  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>\n```\n### Replacement (Chunk 4)\n```tsx\n  const debugPan = Gesture.Pan()
    .onUpdate((e) => {
      // Mapeo simple: 0px a 200px = 0 a 300 nodos
      let newVal = Math.floor((e.x / 200) * 300);
      newVal = Math.max(1, Math.min(300, newVal));
      runOnJS(setNodeLimit)(newVal);
    });

  return (
    <View style={styles.container}>
      {/* DEBUGER UI (Temporal) */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 10 }}>
        <Text style={{ color: 'white', marginBottom: 5 }}>Nodos: {nodeLimit}</Text>
        <GestureDetector gesture={debugPan}>
          <View style={{ width: 200, height: 40, backgroundColor: '#333', justifyContent: 'center' }}>
            <View style={{ width: (nodeLimit / 300) * 200, height: 40, backgroundColor: '#06b6d4', opacity: 0.5 }} />
          </View>
        </GestureDetector>
        <Text style={{ color: '#aaa', fontSize: 10, marginTop: 5 }}>Desliza para ajustar</Text>
      </View>

      <GestureDetector gesture={composed}>\n```\n\n---\n\n## Step 1800 - multi_replace_file_content\nInstruction: Fix syntax errors and missing types in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n  const [nodeLimit, setNodeLimit] = useState(10);
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n### Replacement (Chunk 1)\n```tsx\n  const [nodeLimit, setNodeLimit] = useState(10);
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n### Target (Chunk 2)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));\n```\n### Replacement (Chunk 2)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));\n```\n### Target (Chunk 3)\n```tsx\n      // Iniciar cascada de renderizado asíncrono
      setTimeout(updateVisibleGraph, 100);

      return () => {
        isActive = false; // Matar bucle si cambian dependencias
      };
    };

    loadTopology();
  }, [fullTopology, nodeLimit]);\n```\n### Replacement (Chunk 3)\n```tsx\n      // Iniciar cascada de renderizado asíncrono
      setTimeout(updateVisibleGraph, 100);

      return () => {
        isActive = false; // Matar bucle si cambian dependencias
      };
  }, [fullTopology, nodeLimit]);\n```\n\n---\n\n## Step 1815 - multi_replace_file_content\nInstruction: Implement inherited spawns and organic physics tuning\n### Target (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 30000, // Fuerza extrema para evitar cualquier tipo de colisión
  REPULSION_SOFTENING: 300, 
  SPRING_K: 0.05,
  RADIAL_SPRING_K: 0.08, 
  DAMPING: 0.6,
  MAX_VELOCITY: 50
};\n```\n### Replacement (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 20000, 
  REPULSION_SOFTENING: 300, 
  SPRING_K: 0.1, 
  RADIAL_SPRING_K: 0.001, 
  DAMPING: 0.6,
  MAX_VELOCITY: 50
};\n```\n### Target (Chunk 2)\n```tsx\n      // Iniciar a todos en el centro
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });

      nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };\n```\n### Replacement (Chunk 2)\n```tsx\n      // Iniciar al maestro en el centro
      nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };

      // Spawns Heredados: Los hijos nacen en las coordenadas de sus padres
      // Esto evita explosiones atómicas desde el centro.
      for (let lvl = 1; lvl <= 3; lvl++) {
        allSimLinks.filter(l => l.level === lvl).forEach(link => {
          const child = nodeMap.get(link.targetId);
          const parent = nodeMap.get(link.sourceId);
          if (child && parent) {
            child.pos.x = parent.pos.x + (Math.random() - 0.5) * 40;
            child.pos.y = parent.pos.y + (Math.random() - 0.5) * 40;
          }
        });
      }\n```\n### Target (Chunk 3)\n```tsx\n        // Ejecutar 50 iteraciones de físicas para estabilizar el nuevo nivel antes de mostrarlo
        for (let iter = 0; iter < 50; iter++) {
          // Repulsión
          for (let i = 0; i < visibleNodes.length; i++) {
            for (let j = i + 1; j < visibleNodes.length; j++) {
              const n1 = visibleNodes[i];
              const n2 = visibleNodes[j];
              const dx = n2.pos.x - n1.pos.x;
              const dy = n2.pos.y - n1.pos.y;
              const distSq = dx * dx + dy * dy;
              
              if (distSq > 0 && distSq < 100000) { 
                const dist = Math.sqrt(distSq);
                const force = PHYSICS_CONFIG.REPULSION / (distSq + PHYSICS_CONFIG.REPULSION_SOFTENING);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                if (n1.level !== 0) { n1.vx -= fx; n1.vy -= fy; }
                if (n2.level !== 0) { n2.vx += fx; n2.vy += fy; }
              }
            }
          }
          
          // Resortes de Links
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const targetDist = link.level === 1 ? 250 : 100;
            const force = (dist - targetDist) * PHYSICS_CONFIG.SPRING_K;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });\n```\n### Replacement (Chunk 3)\n```tsx\n        // Ejecutar 150 iteraciones de físicas para estabilizar el nuevo nivel antes de mostrarlo
        for (let iter = 0; iter < 150; iter++) {
          // Repulsión
          for (let i = 0; i < visibleNodes.length; i++) {
            for (let j = i + 1; j < visibleNodes.length; j++) {
              const n1 = visibleNodes[i];
              const n2 = visibleNodes[j];
              const dx = n2.pos.x - n1.pos.x;
              const dy = n2.pos.y - n1.pos.y;
              const distSq = dx * dx + dy * dy;
              
              if (distSq > 0 && distSq < 100000) { 
                const dist = Math.sqrt(distSq);
                const force = PHYSICS_CONFIG.REPULSION / (distSq + PHYSICS_CONFIG.REPULSION_SOFTENING);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                if (n1.level !== 0) { n1.vx -= fx; n1.vy -= fy; }
                if (n2.level !== 0) { n2.vx += fx; n2.vy += fy; }
              }
            }
          }
          
          // Resortes de Links (Mantienen la estructura)
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Distancias por Nivel
            let targetDist = 60;
            if (link.level === 1) targetDist = 250;
            else if (link.level === 2) targetDist = 120;
            
            const force = (dist - targetDist) * PHYSICS_CONFIG.SPRING_K;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });\n```\n\n---\n\n## Step 1838 - multi_replace_file_content\nInstruction: Use distributeStarNodes for initial positions before physics\n### Target (Chunk 1)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));

      // Iniciar al maestro en el centro
      nodeMap.get(mainNodes[0].networkData.id)!.pos = { x: CENTER.x, y: CENTER.y };\n```\n### Replacement (Chunk 1)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));

      // Iniciar al maestro en el centro
      const mainId = mainNodes[0].networkData.id;
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };

      // 1. Árbol de adyacencia
      const childrenMap = new Map<string, string[]>();
      topology.links.forEach(l => {
        if (!childrenMap.has(l.sourceId)) childrenMap.set(l.sourceId, []);
        childrenMap.get(l.sourceId)!.push(l.targetId);
      });

      // 2. Pesos
      const nodeWeight = new Map<string, number>();
      const calculateWeight = (nodeId: string): number => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) { nodeWeight.set(nodeId, 1); return 1; }
        let weight = 0;
        children.forEach(c => weight += calculateWeight(c));
        nodeWeight.set(nodeId, weight);
        return weight;
      };
      calculateWeight(mainId);

      // 3. Distribución Matemática Inicial (Spawns Perfectos)
      const branchLengths: Record<number, number> = { 1: 250, 2: 120, 3: 60 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        // Nivel 0 reparte en 360 (2PI). Los demás reparten en su sweep heredado.
        const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle; 
        let currentAngleStart = directionAngle - actualSweep / 2;
        
        children.forEach((childId) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;
          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;
          const finalAngle = currentAngleStart + sliceAngle / 2;

          const baseRadius = branchLengths[currentLevel + 1] || 60;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * baseRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * baseRadius;

          // Propagar con un sweep ligeramente menor para evitar que las ramas se crucen
          distributeStarNodes(childId, childNode.pos, finalAngle, sliceAngle * 0.8, currentLevel + 1);
          currentAngleStart += sliceAngle;
        });
      };
      
      distributeStarNodes(mainId, {x: CENTER.x, y: CENTER.y}, 0, Math.PI * 2, 0);\n```\n### Target (Chunk 2)\n```tsx\n      // Spawns Heredados: Los hijos nacen en las coordenadas de sus padres
      // Esto evita explosiones atómicas desde el centro.
      for (let lvl = 1; lvl <= 3; lvl++) {
        allSimLinks.filter(l => l.level === lvl).forEach(link => {
          const child = nodeMap.get(link.targetId);
          const parent = nodeMap.get(link.sourceId);
          if (child && parent) {
            child.pos.x = parent.pos.x + (Math.random() - 0.5) * 40;
            child.pos.y = parent.pos.y + (Math.random() - 0.5) * 40;
          }
        });
      }

      // Carga Progresiva Asíncrona (Nivel 0 y 1 primero)
      let currentVisibleLevel = 1;\n```\n### Replacement (Chunk 2)\n```tsx\n      // Carga Progresiva Asíncrona (Nivel 0 y 1 primero)
      let currentVisibleLevel = 1;\n```\n### Target (Chunk 3)\n```tsx\n              {links.map((link, i) => (
                <SkiaLink 
                  key={`link-${i}`} 
                  link={link} 
                />
              ))}\n```\n### Replacement (Chunk 3)\n```tsx\n              {links.map((link, i) => (
                <SkiaLink 
                  key={`link-${link.sourceId}-${link.targetId}`} 
                  link={link} 
                />
              ))}\n```\n\n---\n\n## Step 1847 - multi_replace_file_content\nInstruction: Fix links state type in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n  const [links, setLinks] = useState<{ p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string }[]>([]);\n```\n### Replacement (Chunk 1)\n```tsx\n  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string }[]>([]);\n```\n\n---\n\n## Step 1868 - multi_replace_file_content\nInstruction: Fix object reference bug for the center node's position\n### Target (Chunk 1)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));\n```\n### Replacement (Chunk 1)\n```tsx\n      // Iniciar al maestro en el centro ANTES de crear los links para no perder la referencia de memoria
      const mainId = mainNodes[0].networkData.id;
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));\n```\n### Target (Chunk 2)\n```tsx\n      // Iniciar al maestro en el centro
      const mainId = mainNodes[0].networkData.id;
      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };\n```\n### Replacement (Chunk 2)\n```tsx\n\n```\n\n---\n\n## Step 1880 - multi_replace_file_content\nInstruction: Implement True 360 Constellations with staggered rings\n### Target (Chunk 1)\n```tsx\n      // 3. Distribución Matemática Inicial (Spawns Perfectos)
      const branchLengths: Record<number, number> = { 1: 250, 2: 120, 3: 60 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        // Nivel 0 reparte en 360 (2PI). Los demás reparten en su sweep heredado.
        const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle; 
        let currentAngleStart = directionAngle - actualSweep / 2;
        
        children.forEach((childId) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;
          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;
          const finalAngle = currentAngleStart + sliceAngle / 2;

          const baseRadius = branchLengths[currentLevel + 1] || 60;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * baseRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * baseRadius;

          // Propagar con un sweep ligeramente menor para evitar que las ramas se crucen
          distributeStarNodes(childId, childNode.pos, finalAngle, sliceAngle * 0.8, currentLevel + 1);
          currentAngleStart += sliceAngle;
        });
      };
      
      distributeStarNodes(mainId, {x: CENTER.x, y: CENTER.y}, 0, Math.PI * 2, 0);\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Distribución Matemática de Constelaciones (Estrellas 360°)
      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        // CADA NODO recibe sus 360 grados enteros para sus hijos (Math.PI * 2)
        const sliceAngle = (Math.PI * 2) / children.length;
        let currentAngle = Math.random() * Math.PI * 2; // Empezar en un ángulo aleatorio para que no se alineen
        
        children.forEach((childId) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          // Escalonar aleatoriamente las distancias para romper el "anillo perfecto"
          // Nivel 0 (Azules): entre 200 y 600 px
          // Nivel 1 (Dorados): entre 100 y 250 px
          // Nivel 2 (Fucsias): entre 50 y 100 px
          let baseRadius = 60;
          if (currentLevel === 0) baseRadius = 200 + Math.random() * 400;
          else if (currentLevel === 1) baseRadius = 100 + Math.random() * 150;
          else if (currentLevel === 2) baseRadius = 50 + Math.random() * 50;
          
          childNode.pos.x = parentPos.x + Math.cos(currentAngle) * baseRadius;
          childNode.pos.y = parentPos.y + Math.sin(currentAngle) * baseRadius;

          distributeStarNodes(childId, childNode.pos, currentLevel + 1);
          currentAngle += sliceAngle;
        });
      };
      
      distributeStarNodes(mainId, {x: CENTER.x, y: CENTER.y}, 0);\n```\n### Target (Chunk 2)\n```tsx\n          // Resortes de Links (Mantienen la estructura)
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Distancias por Nivel
            let targetDist = 60;
            if (link.level === 1) targetDist = 250;
            else if (link.level === 2) targetDist = 120;
            
            const force = (dist - targetDist) * PHYSICS_CONFIG.SPRING_K;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });\n```\n### Replacement (Chunk 2)\n```tsx\n          // Resortes de Links (Bandas elásticas)
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Permitimos que la distancia ideal sea dinámica según el nivel
            let targetDist = 60;
            if (link.level === 1) targetDist = 350;
            else if (link.level === 2) targetDist = 150;
            
            // Usamos un resorte muy suave (0.01) para que la repulsión domine y organice orgánicamente
            const force = (dist - targetDist) * 0.01;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });\n```\n\n---\n\n## Step 1901 - multi_replace_file_content\nInstruction: Restore Dandelion topology and physics\n### Target (Chunk 1)\n```tsx\n      // 3. Distribución Matemática de Constelaciones (Estrellas 360°)
      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        // CADA NODO recibe sus 360 grados enteros para sus hijos (Math.PI * 2)
        const sliceAngle = (Math.PI * 2) / children.length;
        let currentAngle = Math.random() * Math.PI * 2; // Empezar en un ángulo aleatorio para que no se alineen
        
        children.forEach((childId) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          // Escalonar aleatoriamente las distancias para romper el "anillo perfecto"
          // Nivel 0 (Azules): entre 200 y 600 px
          // Nivel 1 (Dorados): entre 100 y 250 px
          // Nivel 2 (Fucsias): entre 50 y 100 px
          let baseRadius = 60;
          if (currentLevel === 0) baseRadius = 200 + Math.random() * 400;
          else if (currentLevel === 1) baseRadius = 100 + Math.random() * 150;
          else if (currentLevel === 2) baseRadius = 50 + Math.random() * 50;
          
          childNode.pos.x = parentPos.x + Math.cos(currentAngle) * baseRadius;
          childNode.pos.y = parentPos.y + Math.sin(currentAngle) * baseRadius;

          distributeStarNodes(childId, childNode.pos, currentLevel + 1);
          currentAngle += sliceAngle;
        });
      };
      
      distributeStarNodes(mainId, {x: CENTER.x, y: CENTER.y}, 0);\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Distribución Matemática 'Diente de León' (La favorita del usuario)
      const branchLengths: Record<number, number> = { 1: 300, 2: 80, 3: 45 }; // Tallo largo, hojas cortas

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        // Nivel 0 reparte en 360 (2PI). Los demás reparten en su cono heredado.
        const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle; 
        let currentAngleStart = directionAngle - actualSweep / 2;
        
        children.forEach((childId) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;
          const finalAngle = currentAngleStart + sliceAngle / 2;

          const baseRadius = branchLengths[currentLevel + 1] || 45;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * baseRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * baseRadius;

          // Propagar con un cono ajustado para crear los racimos cerrados
          distributeStarNodes(childId, childNode.pos, finalAngle, sliceAngle * 0.85, currentLevel + 1);
          currentAngleStart += sliceAngle;
        });
      };
      
      distributeStarNodes(mainId, {x: CENTER.x, y: CENTER.y}, 0, Math.PI * 2, 0);\n```\n### Target (Chunk 2)\n```tsx\n          // Resortes de Links (Bandas elásticas)
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Permitimos que la distancia ideal sea dinámica según el nivel
            let targetDist = 60;
            if (link.level === 1) targetDist = 350;
            else if (link.level === 2) targetDist = 150;
            
            // Usamos un resorte muy suave (0.01) para que la repulsión domine y organice orgánicamente
            const force = (dist - targetDist) * 0.01;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });\n```\n### Replacement (Chunk 2)\n```tsx\n          // Resortes de Links ajustados para el diseño "Diente de León"
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            let targetDist = 45;
            if (link.level === 1) targetDist = 300;
            else if (link.level === 2) targetDist = 80;
            
            // Retornamos a un resorte más firme (0.1) para mantener la geometría
            const force = (dist - targetDist) * 0.1;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });\n```\n\n---\n\n## Step 1908 - multi_replace_file_content\nInstruction: Adjust Dandelion proportions and restore soft springs\n### Target (Chunk 1)\n```tsx\n      // 3. Distribución Matemática 'Diente de León' (La favorita del usuario)
      const branchLengths: Record<number, number> = { 1: 300, 2: 80, 3: 45 }; // Tallo largo, hojas cortas\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Distribución Matemática 'Diente de León' (La favorita del usuario)
      const branchLengths: Record<number, number> = { 1: 280, 2: 50, 3: 25 }; // Tallo largo, racimos MUY cerrados\n```\n### Target (Chunk 2)\n```tsx\n            let targetDist = 45;
            if (link.level === 1) targetDist = 300;
            else if (link.level === 2) targetDist = 80;
            
            // Retornamos a un resorte más firme (0.1) para mantener la geometría
            const force = (dist - targetDist) * 0.1;\n```\n### Replacement (Chunk 2)\n```tsx\n            let targetDist = 25;
            if (link.level === 1) targetDist = 280;
            else if (link.level === 2) targetDist = 50;
            
            // Resorte MUY suave (0.01) para permitir que la repulsión estire las ramas de forma asimétrica y orgánica
            const force = (dist - targetDist) * 0.01;\n```\n\n---\n\n## Step 1914 - multi_replace_file_content\nInstruction: Restore organic Big Bang force-directed graph\n### Target (Chunk 1)\n```tsx\n      // 3. Distribución Matemática 'Diente de León' (La favorita del usuario)
      const branchLengths: Record<number, number> = { 1: 280, 2: 50, 3: 25 }; // Tallo largo, racimos MUY cerrados

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        // Nivel 0 reparte en 360 (2PI). Los demás reparten en su cono heredado.
        const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle; 
        let currentAngleStart = directionAngle - actualSweep / 2;
        
        children.forEach((childId) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;
          const finalAngle = currentAngleStart + sliceAngle / 2;

          const baseRadius = branchLengths[currentLevel + 1] || 45;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * baseRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * baseRadius;

          // Propagar con un cono ajustado para crear los racimos cerrados
          distributeStarNodes(childId, childNode.pos, finalAngle, sliceAngle * 0.85, currentLevel + 1);
          currentAngleStart += sliceAngle;
        });
      };
      
      distributeStarNodes(mainId, {x: CENTER.x, y: CENTER.y}, 0, Math.PI * 2, 0);\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Spawns Heredados (Big Bang Orgánico)
      // En lugar de calcular ángulos matemáticos perfectos, hacemos que los nodos nazcan
      // en las coordenadas exactas de su nodo padre (con un mini offset aleatorio).
      // Esto fuerza al motor de físicas a "explotar" y acomodarlos orgánicamente.
      
      const placeNodesNearParents = (currentLevel: number) => {
        const nodesInLevel = allSimNodes.filter(n => n.level === currentLevel);
        nodesInLevel.forEach(n => {
          const link = allSimLinks.find(l => l.targetId === n.networkData.id);
          if (link) {
            const parent = allSimNodes.find(p => p.networkData.id === link.sourceId);
            if (parent) {
              n.pos.x = parent.pos.x + (Math.random() - 0.5) * 10;
              n.pos.y = parent.pos.y + (Math.random() - 0.5) * 10;
            }
          }
        });
      };

      placeNodesNearParents(1);
      placeNodesNearParents(2);
      placeNodesNearParents(3);\n```\n### Target (Chunk 2)\n```tsx\n        for (let iter = 0; iter < 150; iter++) {\n```\n### Replacement (Chunk 2)\n```tsx\n        for (let iter = 0; iter < 200; iter++) {\n```\n\n---\n\n## Step 1920 - multi_replace_file_content\nInstruction: Fix TypeScript error MapNode.id\n### Target (Chunk 1)\n```tsx\n        nodesInLevel.forEach(n => {
          const link = allSimLinks.find(l => l.targetId === n.networkData.id);
          if (link) {
            const parent = allSimNodes.find(p => p.networkData.id === link.sourceId);\n```\n### Replacement (Chunk 1)\n```tsx\n        nodesInLevel.forEach(n => {
          const link = allSimLinks.find(l => l.targetId === n.id);
          if (link) {
            const parent = allSimNodes.find(p => p.id === link.sourceId);\n```\n\n---\n\n## Step 1933 - multi_replace_file_content\nInstruction: Restore synchronous Big Bang physics from Phase 16\n### Target (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 150,
  REPULSION: 20000, 
  REPULSION_SOFTENING: 300, 
  SPRING_K: 0.1, 
  RADIAL_SPRING_K: 0.001, 
  DAMPING: 0.6,
  MAX_VELOCITY: 50
};\n```\n### Replacement (Chunk 1)\n```tsx\nconst PHYSICS_CONFIG = {
  ITERATIONS: 250, // Más iteraciones ya que es síncrono y hay menos nodos
  REPULSION: 30000, 
  REPULSION_SOFTENING: 300, 
  SPRING_K: 0.05, 
  RADIAL_SPRING_K: 0.08, 
  DAMPING: 0.6,
  MAX_VELOCITY: 50
};\n```\n### Target (Chunk 2)\n```tsx\n      };
      calculateWeight(mainId);

      // 3. Spawns Heredados (Big Bang Orgánico)
      // En lugar de calcular ángulos matemáticos perfectos, hacemos que los nodos nazcan
      // en las coordenadas exactas de su nodo padre (con un mini offset aleatorio).
      // Esto fuerza al motor de físicas a "explotar" y acomodarlos orgánicamente.
      
      const placeNodesNearParents = (currentLevel: number) => {
        const nodesInLevel = allSimNodes.filter(n => n.level === currentLevel);
        nodesInLevel.forEach(n => {
          const link = allSimLinks.find(l => l.targetId === n.id);
          if (link) {
            const parent = allSimNodes.find(p => p.id === link.sourceId);
            if (parent) {
              n.pos.x = parent.pos.x + (Math.random() - 0.5) * 10;
              n.pos.y = parent.pos.y + (Math.random() - 0.5) * 10;
            }
          }
        });
      };

      placeNodesNearParents(1);
      placeNodesNearParents(2);
      placeNodesNearParents(3);

      // Carga Progresiva Asíncrona (Nivel 0 y 1 primero)
      let currentVisibleLevel = 1;
      let isActive = true;

      const updateVisibleGraph = () => {
        if (!isActive) return;

        const allowedIds = new Set<string>();
        const visibleNodes = allSimNodes.filter(n => {
          if (n.level <= currentVisibleLevel) {
            allowedIds.add(n.networkData.id);
            return true;
          }
          return false;
        });

        const visibleLinks = allSimLinks.filter(l => 
          l.level <= currentVisibleLevel && allowedIds.has(l.sourceId) && allowedIds.has(l.targetId)
        );
        
        // Ejecutar 150 iteraciones de físicas para estabilizar el nuevo nivel antes de mostrarlo
        for (let iter = 0; iter < 200; iter++) {
          // Repulsión
          for (let i = 0; i < visibleNodes.length; i++) {
            for (let j = i + 1; j < visibleNodes.length; j++) {
              const n1 = visibleNodes[i];
              const n2 = visibleNodes[j];
              const dx = n2.pos.x - n1.pos.x;
              const dy = n2.pos.y - n1.pos.y;
              const distSq = dx * dx + dy * dy;
              
              if (distSq > 0 && distSq < 100000) { 
                const dist = Math.sqrt(distSq);
                const force = PHYSICS_CONFIG.REPULSION / (distSq + PHYSICS_CONFIG.REPULSION_SOFTENING);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                if (n1.level !== 0) { n1.vx -= fx; n1.vy -= fy; }
                if (n2.level !== 0) { n2.vx += fx; n2.vy += fy; }
              }
            }
          }
          
          // Resortes de Links ajustados para el diseño "Diente de León"
          visibleLinks.forEach(link => {
            const dx = link.p2.x - link.p1.x;
            const dy = link.p2.y - link.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            let targetDist = 25;
            if (link.level === 1) targetDist = 280;
            else if (link.level === 2) targetDist = 50;
            
            // Resorte MUY suave (0.01) para permitir que la repulsión estire las ramas de forma asimétrica y orgánica
            const force = (dist - targetDist) * 0.01;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const n1 = visibleNodes.find(n => n.pos === link.p1);
            const n2 = visibleNodes.find(n => n.pos === link.p2);
            
            if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
            if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
          });
          
          // Gravedad radial hacia el centro
          visibleNodes.forEach(n => {
            if (n.level === 0) return;
            
            const dx = CENTER.x - n.pos.x;
            const dy = CENTER.y - n.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const radialForce = dist * PHYSICS_CONFIG.RADIAL_SPRING_K;
            n.vx += (dx / dist) * radialForce;
            n.vy += (dy / dist) * radialForce;
            
            n.vx *= PHYSICS_CONFIG.DAMPING;
            n.vy *= PHYSICS_CONFIG.DAMPING;
            
            const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (speed > PHYSICS_CONFIG.MAX_VELOCITY) {
              n.vx = (n.vx / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
              n.vy = (n.vy / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
            }
            
            n.pos.x += n.vx;
            n.pos.y += n.vy;
          });
        }

        setNodes([...visibleNodes]);
        setLinks([...visibleLinks]);
        setIsLoading(false);

        if (currentVisibleLevel < 3) {
          currentVisibleLevel++;
          setTimeout(updateVisibleGraph, 800);
        }
      };

      // Iniciar cascada de renderizado asíncrono
      setTimeout(updateVisibleGraph, 100);

      return () => {
        isActive = false; // Matar bucle si cambian dependencias
      };
    };

    loadTopology();
  }, [fullTopology, nodeLimit]);\n```\n### Replacement (Chunk 2)\n```tsx\n      // 3. Spawns Iniciales (Big Bang desde el Centro)
      // Iniciamos a todos en el centro con un pequeño offset.
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });
      // Aseguramos que el maestro esté exactamente en el centro
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      // 4. Cálculo Físico Síncrono Previo
      // Calculamos toda la topología de golpe antes de renderizar (como en la iteración favorita)
      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
        // Repulsión
        for (let i = 0; i < allSimNodes.length; i++) {
          for (let j = i + 1; j < allSimNodes.length; j++) {
            const n1 = allSimNodes[i];
            const n2 = allSimNodes[j];
            const dx = n2.pos.x - n1.pos.x;
            const dy = n2.pos.y - n1.pos.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > 0 && distSq < 150000) { 
              const dist = Math.sqrt(distSq);
              const force = PHYSICS_CONFIG.REPULSION / (distSq + PHYSICS_CONFIG.REPULSION_SOFTENING);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              if (n1.level !== 0) { n1.vx -= fx; n1.vy -= fy; }
              if (n2.level !== 0) { n2.vx += fx; n2.vy += fy; }
            }
          }
        }
        
        // Resortes
        allSimLinks.forEach(link => {
          const dx = link.p2.x - link.p1.x;
          const dy = link.p2.y - link.p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let targetDist = 60;
          if (link.level === 1) targetDist = 250;
          else if (link.level === 2) targetDist = 120;
          
          const force = (dist - targetDist) * PHYSICS_CONFIG.SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          const n1 = allSimNodes.find(n => n.id === link.sourceId);
          const n2 = allSimNodes.find(n => n.id === link.targetId);
          
          if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
          if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
        });
        
        // Gravedad Radial y Movimiento
        allSimNodes.forEach(n => {
          if (n.level === 0) return;
          
          const dx = CENTER.x - n.pos.x;
          const dy = CENTER.y - n.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0) {
            const radialForce = dist * PHYSICS_CONFIG.RADIAL_SPRING_K;
            n.vx += (dx / dist) * radialForce;
            n.vy += (dy / dist) * radialForce;
          }
          
          n.vx *= PHYSICS_CONFIG.DAMPING;
          n.vy *= PHYSICS_CONFIG.DAMPING;
          
          const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
          if (speed > PHYSICS_CONFIG.MAX_VELOCITY) {
            n.vx = (n.vx / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
            n.vy = (n.vy / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
          }
          
          n.pos.x += n.vx;
          n.pos.y += n.vy;
        });
      }

      // 5. Aplicar al Estado Visual
      setNodes([...allSimNodes]);
      setLinks([...allSimLinks]);
      setIsLoading(false);

    };

    loadTopology();
  }, [fullTopology, nodeLimit]);\n```\n\n---\n\n## Step 1947 - multi_replace_file_content\nInstruction: Clean up syntax errors and obsolete code in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n      // 1. Árbol de adyacencia
      const childrenMap = new Map<string, string[]>();
      topology.links.forEach(l => {
        if (!childrenMap.has(l.sourceId)) childrenMap.set(l.sourceId, []);
        childrenMap.get(l.sourceId)!.push(l.targetId);
      });

      // 2. Pesos
      const nodeWeight = new Map<string, number>();
      const calculateWeight = (nodeId: string): number => {\n```\n### Replacement (Chunk 1)\n```tsx\n\n```\n### Target (Chunk 2)\n```tsx\n      // 5. Aplicar al Estado Visual
      setNodes([...allSimNodes]);
      setLinks([...allSimLinks]);
      setIsLoading(false);
    };

    loadTopology();
  }, [fullTopology, nodeLimit]);\n```\n### Replacement (Chunk 2)\n```tsx\n      // 5. Aplicar al Estado Visual
      setNodes([...allSimNodes]);
      setLinks([...allSimLinks]);
      setIsLoading(false);
  }, [fullTopology, nodeLimit]);\n```\n\n---\n\n## Step 1968 - multi_replace_file_content\nInstruction: Implement nodeLimit filtering and onSlidingComplete in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [nodeLimit, setNodeLimit] = useState(10);
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n### Replacement (Chunk 1)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [nodeLimit, setNodeLimit] = useState(100); // Empezamos en 100 como pidió el usuario
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n### Target (Chunk 2)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values());
      const allSimLinks = topology.links.map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color
      }));\n```\n### Replacement (Chunk 2)\n```tsx\n      const allSimNodes = Array.from(nodeMap.values()).slice(0, nodeLimit);
      const allowedIds = new Set(allSimNodes.map(n => n.id));
      
      const allSimLinks = topology.links
        .filter(l => allowedIds.has(l.sourceId) && allowedIds.has(l.targetId))
        .map(l => ({
          sourceId: l.sourceId,
          targetId: l.targetId,
          p1: nodeMap.get(l.sourceId)!.pos,
          p2: nodeMap.get(l.targetId)!.pos,
          level: l.level,
          color: nodeMap.get(l.targetId)!.color
        }));\n```\n### Target (Chunk 3)\n```tsx\n          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={300}
            step={1}
            value={nodeLimit}
            onValueChange={(val) => runOnJS(setNodeLimit)(val)}
            minimumTrackTintColor="#1e293b"
            maximumTrackTintColor="#1e293b"
            thumbTintColor="#2dd4bf"
          />\n```\n### Replacement (Chunk 3)\n```tsx\n          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={300} // Hasta 300
            step={1}
            value={nodeLimit}
            onSlidingComplete={(val) => runOnJS(setNodeLimit)(val)} // Solo calcula cuando sueltas el dedo para no trabar la app
            minimumTrackTintColor="#1e293b"
            maximumTrackTintColor="#1e293b"
            thumbTintColor="#2dd4bf"
          />\n```\n\n---\n\n## Step 1974 - multi_replace_file_content\nInstruction: Optimize custom debugPan slider\n### Target (Chunk 1)\n```tsx\n  const [nodeLimit, setNodeLimit] = useState(100); // Empezamos en 100 como pidió el usuario
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n### Replacement (Chunk 1)\n```tsx\n  const [nodeLimit, setNodeLimit] = useState(100);
  const [sliderVal, setSliderVal] = useState(100);
  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n### Target (Chunk 2)\n```tsx\n  const debugPan = Gesture.Pan()
    .onUpdate((e) => {
      // Mapeo simple: 0px a 200px = 0 a 300 nodos
      let newVal = Math.floor((e.x / 200) * 300);
      newVal = Math.max(1, Math.min(300, newVal));
      runOnJS(setNodeLimit)(newVal);
    });

  return (
    <View style={styles.container}>
      {/* DEBUGER UI (Temporal) */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 10 }}>
        <Text style={{ color: 'white', marginBottom: 5 }}>Nodos: {nodeLimit}</Text>
        <GestureDetector gesture={debugPan}>
          <View style={{ width: 200, height: 40, backgroundColor: '#333', justifyContent: 'center' }}>
            <View style={{ width: (nodeLimit / 300) * 200, height: 40, backgroundColor: '#06b6d4', opacity: 0.5 }} />\n```\n### Replacement (Chunk 2)\n```tsx\n  const debugPan = Gesture.Pan()
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
            <View style={{ width: (sliderVal / 300) * 200, height: 40, backgroundColor: '#06b6d4', opacity: 0.5 }} />\n```\n\n---\n\n## Step 1985 - replace_file_content\nInstruction: Add Big Bang random offsets before physics loop\n### Target (Chunk 1)\n```tsx\n      // 4. Cálculo Físico Síncrono Previo
      // Calculamos toda la topología de golpe antes de renderizar (como en la iteración favorita)
      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Spawns Iniciales (Big Bang desde el Centro)
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });
      // Asegurar que el maestro esté exactamente en el centro
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      // 4. Cálculo Físico Síncrono Previo
      // Calculamos toda la topología de golpe antes de renderizar (como en la iteración favorita)
      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {\n```\n\n---\n\n## Step 2044 - replace_file_content\nInstruction: Restore Fractal Star Topology\n### Target (Chunk 1)\n```tsx\n      // 3. Spawns Iniciales (Big Bang desde el Centro)
      allSimNodes.forEach(n => {
        n.pos.x = CENTER.x + (Math.random() - 0.5) * 50;
        n.pos.y = CENTER.y + (Math.random() - 0.5) * 50;
      });
      // Asegurar que el maestro esté exactamente en el centro
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      // 4. Cálculo Físico Síncrono Previo
      // Calculamos toda la topología de golpe antes de renderizar (como en la iteración favorita)
      for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
        // Repulsión
        for (let i = 0; i < allSimNodes.length; i++) {
          for (let j = i + 1; j < allSimNodes.length; j++) {
            const n1 = allSimNodes[i];
            const n2 = allSimNodes[j];
            const dx = n2.pos.x - n1.pos.x;
            const dy = n2.pos.y - n1.pos.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > 0 && distSq < 150000) { 
              const dist = Math.sqrt(distSq);
              const force = PHYSICS_CONFIG.REPULSION / (distSq + PHYSICS_CONFIG.REPULSION_SOFTENING);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              if (n1.level !== 0) { n1.vx -= fx; n1.vy -= fy; }
              if (n2.level !== 0) { n2.vx += fx; n2.vy += fy; }
            }
          }
        }
        
        // Resortes
        allSimLinks.forEach(link => {
          const dx = link.p2.x - link.p1.x;
          const dy = link.p2.y - link.p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let targetDist = 60;
          if (link.level === 1) targetDist = 250;
          else if (link.level === 2) targetDist = 120;
          
          const force = (dist - targetDist) * PHYSICS_CONFIG.SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          const n1 = allSimNodes.find(n => n.id === link.sourceId);
          const n2 = allSimNodes.find(n => n.id === link.targetId);
          
          if (n1 && n1.level !== 0) { n1.vx += fx; n1.vy += fy; }
          if (n2 && n2.level !== 0) { n2.vx -= fx; n2.vy -= fy; }
        });
        
        // Gravedad Radial y Movimiento
        allSimNodes.forEach(n => {
          if (n.level === 0) return;
          
          const dx = CENTER.x - n.pos.x;
          const dy = CENTER.y - n.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0) {
            const radialForce = dist * PHYSICS_CONFIG.RADIAL_SPRING_K;
            n.vx += (dx / dist) * radialForce;
            n.vy += (dy / dist) * radialForce;
          }
          
          n.vx *= PHYSICS_CONFIG.DAMPING;
          n.vy *= PHYSICS_CONFIG.DAMPING;
          
          const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
          if (speed > PHYSICS_CONFIG.MAX_VELOCITY) {
            n.vx = (n.vx / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
            n.vy = (n.vy / speed) * PHYSICS_CONFIG.MAX_VELOCITY;
          }
          
          n.pos.x += n.vx;
          n.pos.y += n.vy;
        });
      }\n```\n### Replacement (Chunk 1)\n```tsx\n      // 3. Generar Mapa de Hijos para Algoritmo Matemático
      const childrenMap = new Map<string, string[]>();
      allSimNodes.forEach(n => childrenMap.set(n.id, []));
      allSimLinks.forEach(l => {
        childrenMap.get(l.sourceId)?.push(l.targetId);
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
        
        const actualSweep = Math.PI * 2;
        let currentAngleStart = directionAngle;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            baseRadius = 250 + (index % 5) * 200; 
          } else if (currentLevel === 1) {
            baseRadius = 100;
          } else if (currentLevel === 2) {
            baseRadius = 40;
          }
          
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          distributeStarNodes(childId, childNode.pos, finalAngle, actualSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };

      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);\n```\n\n---\n\n## Step 2051 - replace_file_content\nInstruction: Improve distributeStarNodes math to use outward cones and dynamic spacing\n### Target (Chunk 1)\n```tsx\n      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        const actualSweep = Math.PI * 2;
        let currentAngleStart = directionAngle;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            baseRadius = 250 + (index % 5) * 200; 
          } else if (currentLevel === 1) {
            baseRadius = 100;
          } else if (currentLevel === 2) {
            baseRadius = 40;
          }
          
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          distributeStarNodes(childId, childNode.pos, finalAngle, actualSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n### Replacement (Chunk 1)\n```tsx\n      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        // Centramos el abanico en la dirección de donde venimos (hacia afuera)
        let currentAngleStart = directionAngle - sweepAngle / 2;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * sweepAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            // Lógica "Galaxia": esparcimos los Nivel 1 agresivamente para dar lugar a las constelaciones
            baseRadius = 250 + (index % 5) * 150; 
          } else {
            // Lógica de "No Choque": si hay muchos nodos, estiramos la órbita matemáticamente (Arco S = r * theta)
            // Asignamos 35px de "espacio vital" por nodo.
            const requiredArc = children.length * 35; 
            const dynamicRadius = requiredArc / sweepAngle;
            baseRadius = Math.max(baseRadius, dynamicRadius);
          }
          
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 20 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Propagación Cónica (Fractal Tree): 
          // Nivel 0 (Tú) recibe 360°.
          // Nivel 1 propaga en un abanico de 270°.
          // Niveles posteriores propagan en 180° (siempre hacia afuera del centro).
          let nextSweep = sweepAngle;
          if (currentLevel === 0) nextSweep = Math.PI * 1.5; // 270°
          else if (currentLevel === 1) nextSweep = Math.PI * 1.2; // 216°
          else nextSweep = Math.PI; // 180°

          distributeStarNodes(childId, childNode.pos, finalAngle, nextSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n\n---\n\n## Step 2067 - replace_file_content\nInstruction: Change visual sizes of nodes based on their level\n### Target (Chunk 1)\n```tsx\n  const rBlur = node.level === 0 ? 45 : 24;
  const rMain = node.level === 0 ? 28 : 16;
  const rSel = node.level === 0 ? 34 : 22;\n```\n### Replacement (Chunk 1)\n```tsx\n  const getRadius = (level: number) => {
    switch (level) {
      case 0: return { rBlur: 45, rMain: 28, rSel: 34 };
      case 1: return { rBlur: 30, rMain: 16, rSel: 22 }; // Azules (Grandes)
      case 2: return { rBlur: 20, rMain: 11, rSel: 16 }; // Dorados (Medianos)
      case 3: default: return { rBlur: 14, rMain: 7, rSel: 11 }; // Fucsias (Pequeños)
    }
  };
  const { rBlur, rMain, rSel } = getRadius(node.level);\n```\n\n---\n\n## Step 2074 - replace_file_content\nInstruction: Adjust branch lengths and stagger to guarantee safety margins\n### Target (Chunk 1)\n```tsx\n      const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        // Centramos el abanico en la dirección de donde venimos (hacia afuera)
        let currentAngleStart = directionAngle - sweepAngle / 2;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * sweepAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            // Lógica "Galaxia": esparcimos los Nivel 1 agresivamente para dar lugar a las constelaciones
            baseRadius = 250 + (index % 5) * 150; 
          } else {
            // Lógica de "No Choque": si hay muchos nodos, estiramos la órbita matemáticamente (Arco S = r * theta)
            // Asignamos 35px de "espacio vital" por nodo.
            const requiredArc = children.length * 35; 
            const dynamicRadius = requiredArc / sweepAngle;
            baseRadius = Math.max(baseRadius, dynamicRadius);
          }
          
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 20 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Propagación Cónica (Fractal Tree): 
          // Nivel 0 (Tú) recibe 360°.
          // Nivel 1 propaga en un abanico de 270°.
          // Niveles posteriores propagan en 180° (siempre hacia afuera del centro).
          let nextSweep = sweepAngle;
          if (currentLevel === 0) nextSweep = Math.PI * 1.5; // 270°
          else if (currentLevel === 1) nextSweep = Math.PI * 1.2; // 216°
          else nextSweep = Math.PI; // 180°

          distributeStarNodes(childId, childNode.pos, finalAngle, nextSweep, currentLevel + 1);\n```\n### Replacement (Chunk 1)\n```tsx\n      const branchLengths: Record<number, number> = { 1: 300, 2: 120, 3: 70, 4: 50, 5: 50 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        // Centramos el abanico en la dirección de donde venimos (hacia afuera)
        let currentAngleStart = directionAngle - sweepAngle / 2;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * sweepAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.15) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 50;
          
          if (currentLevel === 0) {
            // Lógica "Galaxia": esparcimos los Nivel 1 agresivamente para dar lugar a las constelaciones
            baseRadius = 250 + (index % 5) * 150; 
          } else {
            // Lógica de "No Choque": estiramos la órbita asegurando 45px de arco por nodo
            const requiredArc = children.length * 45; 
            const dynamicRadius = requiredArc / sweepAngle;
            baseRadius = Math.max(baseRadius, dynamicRadius);
          }
          
          // Jitter de Radio porcentual (±20%) para que nunca reste más distancia que el margen de seguridad
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * (baseRadius * 0.20) : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Propagación Cónica (Fractal Tree): 
          // Nivel 0 (Tú) recibe 360°.
          // Nivel 1 propaga en un abanico de 270°.
          // Niveles posteriores propagan en 180° (siempre hacia afuera del centro).
          let nextSweep = sweepAngle;
          if (currentLevel === 0) nextSweep = Math.PI * 1.5; // 270°
          else if (currentLevel === 1) nextSweep = Math.PI * 1.2; // 216°
          else nextSweep = Math.PI; // 180°

          distributeStarNodes(childId, childNode.pos, finalAngle, nextSweep, currentLevel + 1);\n```\n\n---\n\n## Step 2081 - replace_file_content\nInstruction: Revert distributeStarNodes to original 360 logic\n### Target (Chunk 1)\n```tsx\n      const branchLengths: Record<number, number> = { 1: 300, 2: 120, 3: 70, 4: 50, 5: 50 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        // Centramos el abanico en la dirección de donde venimos (hacia afuera)
        let currentAngleStart = directionAngle - sweepAngle / 2;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * sweepAngle;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.15) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 50;
          
          if (currentLevel === 0) {
            // Lógica "Galaxia": esparcimos los Nivel 1 agresivamente para dar lugar a las constelaciones
            baseRadius = 250 + (index % 5) * 150; 
          } else {
            // Lógica de "No Choque": estiramos la órbita asegurando 45px de arco por nodo
            const requiredArc = children.length * 45; 
            const dynamicRadius = requiredArc / sweepAngle;
            baseRadius = Math.max(baseRadius, dynamicRadius);
          }
          
          // Jitter de Radio porcentual (±20%) para que nunca reste más distancia que el margen de seguridad
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * (baseRadius * 0.20) : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          // Propagación Cónica (Fractal Tree): 
          // Nivel 0 (Tú) recibe 360°.
          // Nivel 1 propaga en un abanico de 270°.
          // Niveles posteriores propagan en 180° (siempre hacia afuera del centro).
          let nextSweep = sweepAngle;
          if (currentLevel === 0) nextSweep = Math.PI * 1.5; // 270°
          else if (currentLevel === 1) nextSweep = Math.PI * 1.2; // 216°
          else nextSweep = Math.PI; // 180°

          distributeStarNodes(childId, childNode.pos, finalAngle, nextSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n### Replacement (Chunk 1)\n```tsx\n      const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        const actualSweep = Math.PI * 2;
        let currentAngleStart = directionAngle;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            baseRadius = 250 + (index % 5) * 200; 
          } else if (currentLevel === 1) {
            baseRadius = 100;
          } else if (currentLevel === 2) {
            baseRadius = 40;
          }
          
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          distributeStarNodes(childId, childNode.pos, finalAngle, actualSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n\n---\n\n## Step 2109 - multi_replace_file_content\nInstruction: Apply Jiggle and Semantic Hitbox from plan\n### Target (Chunk 1)\n```tsx\n      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);\n```\n### Replacement (Chunk 1)\n```tsx\n      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
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
      }\n```\n### Target (Chunk 2)\n```tsx\n      let foundNode = null;
      for (const node of nodes) {
        const dx = node.pos.x - touchX;
        const dy = node.pos.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 40) { 
          foundNode = node;
          break;
        }
      }\n```\n### Replacement (Chunk 2)\n```tsx\n      let foundNode = null;
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
      }\n```\n\n---\n\n## Step 2136 - multi_replace_file_content\nInstruction: Add focal zoom math to pinch gesture\n### Target (Chunk 1)\n```tsx\n  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);\n```\n### Replacement (Chunk 1)\n```tsx\n  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  const originFocalX = useSharedValue(0);
  const originFocalY = useSharedValue(0);\n```\n### Target (Chunk 2)\n```tsx\n  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
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
    })\n```\n### Replacement (Chunk 2)\n```tsx\n  const pinchGesture = Gesture.Pinch()
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

      translateX.value = savedTranslateX.value + adjustedFocalX * (1 - scaleRatio);
      translateY.value = savedTranslateY.value + adjustedFocalY * (1 - scaleRatio);
    })\n```\n\n---\n\n## Step 2148 - replace_file_content\nInstruction: Fix focal zoom math bug\n### Target (Chunk 1)\n```tsx\n      // Magia de Focal Zoom: Compensar el paneo basándonos en cuánto creció la escala
      const adjustedFocalX = originFocalX.value - width / 2;
      const adjustedFocalY = originFocalY.value - height / 2;
      const scaleRatio = nextScale / savedScale.value;

      translateX.value = savedTranslateX.value + adjustedFocalX * (1 - scaleRatio);
      translateY.value = savedTranslateY.value + adjustedFocalY * (1 - scaleRatio);
    })\n```\n### Replacement (Chunk 1)\n```tsx\n      // Magia de Focal Zoom: Compensar el paneo basándonos en cuánto creció la escala
      const adjustedFocalX = originFocalX.value - width / 2;
      const adjustedFocalY = originFocalY.value - height / 2;
      const scaleRatio = nextScale / savedScale.value;

      translateX.value = savedTranslateX.value * scaleRatio + adjustedFocalX * (1 - scaleRatio);
      translateY.value = savedTranslateY.value * scaleRatio + adjustedFocalY * (1 - scaleRatio);
    })\n```\n\n---\n\n## Step 2157 - multi_replace_file_content\nInstruction: Dynamically calculate bounds and expand zoom/pan limits\n### Target (Chunk 1)\n```tsx\n      // 5. Aplicar al Estado Visual
      setNodes([...allSimNodes]);
      setLinks([...allSimLinks]);\n```\n### Replacement (Chunk 1)\n```tsx\n      let maxR = 0;
      allSimNodes.forEach(n => {
        const dx = n.pos.x - CENTER.x;
        const dy = n.pos.y - CENTER.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) maxR = dist;
      });
      // Añadimos 200px de margen extra alrededor de los nodos más lejanos
      setBounds({ R: maxR + 200 });

      // 5. Aplicar al Estado Visual
      setNodes([...allSimNodes]);
      setLinks([...allSimLinks]);\n```\n### Target (Chunk 2)\n```tsx\n  const MIN_SCALE = Math.max(0.1, Math.min(width, height) / (bounds.R * 2 + 200));
  const MAX_SCALE = 1.5; // Reducido para que no ocupe toda la pantalla un solo nodo\n```\n### Replacement (Chunk 2)\n```tsx\n  const MIN_SCALE = Math.max(0.05, Math.min(width, height) / (bounds.R * 2.5)); // Zoom out generoso
  const MAX_SCALE = 4.0; // Zoom in profundo para interactuar cómodamente con las hojas fucsias\n```\n### Target (Chunk 3)\n```tsx\n      const PAN_LIMIT = bounds.R * scale.value;\n```\n### Replacement (Chunk 3)\n```tsx\n      const PAN_LIMIT = bounds.R * scale.value + width / 2;\n```\n\n---\n\n## Step 2163 - replace_file_content\nInstruction: Update PAN_LIMIT in pinchGesture onEnd\n### Target (Chunk 1)\n```tsx\n      const PAN_LIMIT = bounds.R * finalScale;\n```\n### Replacement (Chunk 1)\n```tsx\n      const PAN_LIMIT = bounds.R * finalScale + width / 2;\n```\n\n---\n\n## Step 2172 - multi_replace_file_content\nInstruction: Reduce margin and fix label distance\n### Target (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const nodeRadius = node.level === 0 ? 28 : 16;\n```\n### Replacement (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {
  const getRadius = (level: number) => {
    switch (level) {
      case 0: return 28;
      case 1: return 16;
      case 2: return 11;
      default: return 7;
    }
  };
  const nodeRadius = getRadius(node.level);\n```\n### Target (Chunk 2)\n```tsx\n    const y = CENTER.y + (posY.value - CENTER.y) * s + translateY.value + (nodeRadius * s) + 12;\n```\n### Replacement (Chunk 2)\n```tsx\n    const y = CENTER.y + (posY.value - CENTER.y) * s + translateY.value + (nodeRadius * s) + 8;\n```\n### Target (Chunk 3)\n```tsx\n      // Añadimos 200px de margen extra alrededor de los nodos más lejanos
      setBounds({ R: maxR + 200 });\n```\n### Replacement (Chunk 3)\n```tsx\n      // Añadimos 50px de margen extra alrededor de los nodos más lejanos
      setBounds({ R: maxR + 50 });\n```\n\n---\n\n## Step 2178 - replace_file_content\nInstruction: Fix pan limits in panGesture\n### Target (Chunk 1)\n```tsx\n    .onUpdate((e) => {
      const PAN_LIMIT = bounds.R * scale.value + width / 2;
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica dura (15%) si se pasa del límite
      if (nextX > PAN_LIMIT) nextX = PAN_LIMIT + (nextX - PAN_LIMIT) * 0.15;
      if (nextX < -PAN_LIMIT) nextX = -PAN_LIMIT + (nextX + PAN_LIMIT) * 0.15;
      if (nextY > PAN_LIMIT) nextY = PAN_LIMIT + (nextY - PAN_LIMIT) * 0.15;
      if (nextY < -PAN_LIMIT) nextY = -PAN_LIMIT + (nextY + PAN_LIMIT) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      const PAN_LIMIT = bounds.R * scale.value + width / 2;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });\n```\n### Replacement (Chunk 1)\n```tsx\n    .onUpdate((e) => {
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
    });\n```\n\n---\n\n## Step 2182 - replace_file_content\nInstruction: Fix pan limits in pinchGesture onEnd\n### Target (Chunk 1)\n```tsx\n      // Si al terminar de hacer zoom, la cámara quedó "fuera de los límites" (porque el grafo encogió), 
      // forzamos a la cámara a regresar al límite del nuevo tamaño del grafo con un resorte.
      const PAN_LIMIT = bounds.R * finalScale + width / 2;
      if (translateX.value > PAN_LIMIT) translateX.value = withSpring(PAN_LIMIT);
      if (translateX.value < -PAN_LIMIT) translateX.value = withSpring(-PAN_LIMIT);
      if (translateY.value > PAN_LIMIT) translateY.value = withSpring(PAN_LIMIT);
      if (translateY.value < -PAN_LIMIT) translateY.value = withSpring(-PAN_LIMIT);
    });\n```\n### Replacement (Chunk 1)\n```tsx\n      // Si al terminar de hacer zoom, la cámara quedó "fuera de los límites" (porque el grafo encogió), 
      // forzamos a la cámara a regresar al límite del nuevo tamaño del grafo con un resorte.
      const panLimitX = Math.max(0, bounds.R * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, bounds.R * finalScale - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n\n---\n\n## Step 2196 - replace_file_content\nInstruction: Soften link lines\n### Target (Chunk 1)\n```tsx\n    <Line 
      p1={p1} 
      p2={p2} 
      // Añadimos transparencia en HEX al color (66 = 40%, 33 = 20%)
      color={link.level === 1 ? `${link.color}66` : `${link.color}33`} 
      strokeWidth={link.level === 1 ? 2.5 : 1.5} 
    />\n```\n### Replacement (Chunk 1)\n```tsx\n    <Line 
      p1={p1} 
      p2={p2} 
      color={`${link.color}${link.level === 1 ? '33' : (link.level === 2 ? '22' : '11')}`} // 20%, 13%, 7% opacidad
      strokeWidth={link.level === 1 ? 1.2 : (link.level === 2 ? 0.8 : 0.4)} 
    />\n```\n\n---\n\n## Step 2202 - replace_file_content\nInstruction: Update link opacity and stroke width\n### Target (Chunk 1)\n```tsx\n    <Line 
      p1={p1} 
      p2={p2} 
      color={`${link.color}${link.level === 1 ? '33' : (link.level === 2 ? '22' : '11')}`} // 20%, 13%, 7% opacidad
      strokeWidth={link.level === 1 ? 1.2 : (link.level === 2 ? 0.8 : 0.4)} 
    />\n```\n### Replacement (Chunk 1)\n```tsx\n    <Line 
      p1={p1} 
      p2={p2} 
      color={`${link.color}33`} // 20% opacidad para todas las líneas
      strokeWidth={link.level === 1 ? 1.2 : 1} // 1.2 para el tallo, 1 para el resto
    />\n```\n\n---\n\n## Step 2226 - multi_replace_file_content\nInstruction: Implement primary/secondary links logic and dashed styling\n### Target (Chunk 1)\n```tsx\nimport { Canvas, Circle, Group, Line, vec, BlurMask } from '@shopify/react-native-skia';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { Canvas, Circle, Group, Line, vec, BlurMask, DashPathEffect } from '@shopify/react-native-skia';\n```\n### Target (Chunk 2)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string };
}\n```\n### Replacement (Chunk 2)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
}\n```\n### Target (Chunk 3)\n```tsx\n  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={`${link.color}33`} // 20% opacidad para todas las líneas
      strokeWidth={link.level === 1 ? 1.2 : 1} // 1.2 para el tallo, 1 para el resto
    />
  );
};

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string }[]>([]);\n```\n### Replacement (Chunk 3)\n```tsx\n  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={link.isPrimary !== false ? `${link.color}33` : '#ffffff22'} // Blanco muy tenue para secundarios
      strokeWidth={link.isPrimary !== false ? (link.level === 1 ? 1.2 : 1) : 0.5} 
    >
      {link.isPrimary === false && <DashPathEffect intervals={[4, 6]} />}
    </Line>
  );
};

export const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean }[]>([]);\n```\n### Target (Chunk 4)\n```tsx\n      const allSimLinks = topology.links
        .filter(l => allowedIds.has(l.sourceId) && allowedIds.has(l.targetId))
        .map(l => ({
          sourceId: l.sourceId,
          targetId: l.targetId,
          p1: nodeMap.get(l.sourceId)!.pos,
          p2: nodeMap.get(l.targetId)!.pos,
          level: l.level,
          color: nodeMap.get(l.targetId)!.color
        }));




      // 3. Generar Mapa de Hijos para Algoritmo Matemático
      const childrenMap = new Map<string, string[]>();
      allSimNodes.forEach(n => childrenMap.set(n.id, []));
      allSimLinks.forEach(l => {
        childrenMap.get(l.sourceId)?.push(l.targetId);
      });\n```\n### Replacement (Chunk 4)\n```tsx\n      const allSimLinks = topology.links
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
      });\n```\n\n---\n\n## Step 2247 - replace_file_content\nInstruction: Set stroke width of all links to 2px\n### Target (Chunk 1)\n```tsx\n      color={link.isPrimary !== false ? `${link.color}33` : '#ffffff22'} // Blanco muy tenue para secundarios
      strokeWidth={link.isPrimary !== false ? (link.level === 1 ? 1.2 : 1) : 0.5} 
    >\n```\n### Replacement (Chunk 1)\n```tsx\n      color={link.isPrimary !== false ? `${link.color}33` : '#ffffff22'} // Blanco muy tenue para secundarios
      strokeWidth={2} // Todas a 2px
    >\n```\n\n---\n\n## Step 2265 - multi_replace_file_content\nInstruction: Add focus mode animations to nodes and links\n### Target (Chunk 1)\n```tsx\ninterface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const NodeLabel = ({ node, scale, translateX, translateY }: NodeLabelProps) => {\n```\n### Replacement (Chunk 1)\n```tsx\ninterface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isDimmed: boolean;
}

const NodeLabel = ({ node, scale, translateX, translateY, isDimmed }: NodeLabelProps) => {\n```\n### Target (Chunk 2)\n```tsx\n  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (posX.value - CENTER.x) * s + translateX.value;
    const y = CENTER.y + (posY.value - CENTER.y) * s + translateY.value + (nodeRadius * s) + 8;
    
    let opacity = 1;
    if (s < 0.6) opacity = 0; // Todos los niveles desaparecen uniformemente al alejar

    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      opacity = 0;
    }

    return {
      opacity,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });\n```\n### Replacement (Chunk 2)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.15 : 1, { duration: 300 });
  }, [isDimmed]);

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (posX.value - CENTER.x) * s + translateX.value;
    const y = CENTER.y + (posY.value - CENTER.y) * s + translateY.value + (nodeRadius * s) + 8;
    
    let baseOpacity = 1;
    if (s < 0.6) baseOpacity = 0; // Todos los niveles desaparecen uniformemente al alejar

    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      baseOpacity = 0;
    }

    return {
      opacity: baseOpacity * focusOpacity.value,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });\n```\n### Target (Chunk 3)\n```tsx\ninterface SkiaNodeProps {
  node: MapNode;
  isSelected: boolean;
}

const SkiaNode = ({ node, isSelected }: SkiaNodeProps) => {\n```\n### Replacement (Chunk 3)\n```tsx\ninterface SkiaNodeProps {
  node: MapNode;
  isSelected: boolean;
  isDimmed: boolean;
}

const SkiaNode = ({ node, isSelected, isDimmed }: SkiaNodeProps) => {\n```\n### Target (Chunk 4)\n```tsx\n  // En lugar de calcular cx/cy constantemente, aplicamos un transform matricial
  const transform = useDerivedValue(() => [{ translateX: posX.value }, { translateY: posY.value }]);

  return (
    <Group transform={transform}>\n```\n### Replacement (Chunk 4)\n```tsx\n  // En lugar de calcular cx/cy constantemente, aplicamos un transform matricial
  const transform = useDerivedValue(() => [{ translateX: posX.value }, { translateY: posY.value }]);
  
  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.15 : 1, { duration: 300 });
  }, [isDimmed]);

  return (
    <Group transform={transform} opacity={focusOpacity}>\n```\n### Target (Chunk 5)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
}

const SkiaLink = ({ link }: SkiaLinkProps) => {\n```\n### Replacement (Chunk 5)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  isDimmed: boolean;
}

const SkiaLink = ({ link, isDimmed }: SkiaLinkProps) => {\n```\n### Target (Chunk 6)\n```tsx\n  const p1 = useDerivedValue(() => vec(p1X.value, p1Y.value));
  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
  return (
    <Line 
      p1={p1} 
      p2={p2} 
      color={link.isPrimary !== false ? `${link.color}33` : '#ffffff22'} // Blanco muy tenue para secundarios
      strokeWidth={2} // Todas a 2px
    >
      {link.isPrimary === false && <DashPathEffect intervals={[4, 6]} />}
    </Line>
  );\n```\n### Replacement (Chunk 6)\n```tsx\n  const p1 = useDerivedValue(() => vec(p1X.value, p1Y.value));
  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.05 : 1, { duration: 300 });
  }, [isDimmed]);

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
  );\n```\n### Target (Chunk 7)\n```tsx\n  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [nodeLimit, setNodeLimit] = useState(100);\n```\n### Replacement (Chunk 7)\n```tsx\n  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [nodeLimit, setNodeLimit] = useState(100);\n```\n### Target (Chunk 8)\n```tsx\n  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      Vibration.vibrate(50);
    }
    setSelectedNode(node);
  };\n```\n### Replacement (Chunk 8)\n```tsx\n  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      Vibration.vibrate(50);
      const connected = new Set<string>();
      connected.add(node.id);
      links.forEach(l => {
        if (l.sourceId === node.id) connected.add(l.targetId);
        if (l.targetId === node.id) connected.add(l.sourceId);
      });
      setConnectedIds(connected);
    } else {
      setConnectedIds(new Set());
    }
    setSelectedNode(node);
  };\n```\n### Target (Chunk 9)\n```tsx\n      <Canvas style={styles.canvas}>
        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => (
          <SkiaLink key={`link-${index}`} link={link} />
        ))}
        {nodes.map(node => (
          <SkiaNode 
            key={`node-${node.id}`} 
            node={node} 
            isSelected={selectedNode?.id === node.id} 
          />
        ))}
      </Canvas>
      
      {/* Etiquetas Nativas superpuestas para evitar pixeleo de fuentes en Skia */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {nodes.map(node => (
          <NodeLabel 
            key={`label-${node.id}`} 
            node={node} 
            scale={scale} 
            translateX={translateX} 
            translateY={translateY} 
          />
        ))}
      </View>\n```\n### Replacement (Chunk 9)\n```tsx\n      <Canvas style={styles.canvas}>
        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => {
          const isDimmed = selectedNode !== null && !(connectedIds.has(link.sourceId) && connectedIds.has(link.targetId));
          return <SkiaLink key={`link-${index}`} link={link} isDimmed={isDimmed} />;
        })}
        {nodes.map(node => {
          const isSelected = selectedNode?.id === node.id;
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              isSelected={isSelected} 
              isDimmed={isDimmed}
            />
          );
        })}
      </Canvas>
      
      {/* Etiquetas Nativas superpuestas para evitar pixeleo de fuentes en Skia */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {nodes.map(node => {
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={scale} 
              translateX={translateX} 
              translateY={translateY}
              isDimmed={isDimmed}
            />
          );
        })}
      </View>\n```\n\n---\n\n## Step 2278 - replace_file_content\nInstruction: Import withTiming\n### Target (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, SharedValue } from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue } from 'react-native-reanimated';\n```\n\n---\n\n## Step 2301 - replace_file_content\nInstruction: Implement Sunflower Math and Conical Sweeps\n### Target (Chunk 1)\n```tsx\n      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
        
        const actualSweep = Math.PI * 2;
        let currentAngleStart = directionAngle;
        
        children.forEach((childId, index) => {
          const childNode = nodeMap.get(childId);
          if (!childNode) return;

          const weight = nodeWeight.get(childId) || 1;
          const sliceAngle = (weight / totalWeight) * actualSweep;

          const myAngleStart = currentAngleStart;
          const myAngleEnd = currentAngleStart + sliceAngle;
          
          const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
          const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
          const finalAngle = baseCenterAngle + angleJitter;

          let baseRadius = branchLengths[currentLevel + 1] || 40;
          
          if (currentLevel === 0) {
            baseRadius = 250 + (index % 5) * 200; 
          } else if (currentLevel === 1) {
            baseRadius = 100;
          } else if (currentLevel === 2) {
            baseRadius = 40;
          }
          
          const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
          const finalRadius = baseRadius + radiusStagger;
          
          childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
          childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

          distributeStarNodes(childId, childNode.pos, finalAngle, actualSweep, currentLevel + 1);
          
          currentAngleStart += sliceAngle;
        });
      };\n```\n### Replacement (Chunk 1)\n```tsx\n      const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
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
      };\n```\n\n---\n\n## Step 2325 - multi_replace_file_content\nInstruction: Optimize render performance\n### Target (Chunk 1)\n```tsx\nconst NodeLabel = ({ node, scale, translateX, translateY, isDimmed }: NodeLabelProps) => {\n```\n### Replacement (Chunk 1)\n```tsx\nconst NodeLabel = React.memo(({ node, scale, translateX, translateY, isDimmed }: NodeLabelProps) => {\n```\n### Target (Chunk 2)\n```tsx\n    let baseOpacity = 1;
    if (s < 0.6) baseOpacity = 0; // Todos los niveles desaparecen uniformemente al alejar

    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      baseOpacity = 0;
    }

    return {
      opacity: baseOpacity * focusOpacity.value,\n```\n### Replacement (Chunk 2)\n```tsx\n    let baseOpacity = 1;
    let display: 'flex' | 'none' = 'flex';
    
    if (s < 0.6) {
      baseOpacity = 0;
      display = 'none';
    }

    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      baseOpacity = 0;
      display = 'none';
    }

    return {
      display,
      opacity: baseOpacity * focusOpacity.value,\n```\n### Target (Chunk 3)\n```tsx\n    </Animated.View>
  );
};\n```\n### Replacement (Chunk 3)\n```tsx\n    </Animated.View>
  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.node.id === next.node.id);\n```\n### Target (Chunk 4)\n```tsx\nconst SkiaNode = ({ node, isSelected, isDimmed }: SkiaNodeProps) => {\n```\n### Replacement (Chunk 4)\n```tsx\nconst SkiaNode = React.memo(({ node, isSelected, isDimmed }: SkiaNodeProps) => {\n```\n### Target (Chunk 5)\n```tsx\n  const getRadius = (level: number) => {
    switch (level) {
      case 0: return { rBlur: 45, rMain: 28, rSel: 34 };
      case 1: return { rBlur: 30, rMain: 16, rSel: 22 }; // Azules (Grandes)
      case 2: return { rBlur: 20, rMain: 11, rSel: 16 }; // Dorados (Medianos)
      case 3: default: return { rBlur: 14, rMain: 7, rSel: 11 }; // Fucsias (Pequeños)
    }
  };
  const { rBlur, rMain, rSel } = getRadius(node.level);\n```\n### Replacement (Chunk 5)\n```tsx\n  const getRadius = (level: number) => {
    switch (level) {
      case 0: return { rMain: 28, rSel: 34 };
      case 1: return { rMain: 16, rSel: 22 }; 
      case 2: return { rMain: 11, rSel: 16 }; 
      case 3: default: return { rMain: 7, rSel: 11 }; 
    }
  };
  const { rMain, rSel } = getRadius(node.level);\n```\n### Target (Chunk 6)\n```tsx\n  return (
    <Group transform={transform} opacity={focusOpacity}>
      <Circle cx={0} cy={0} r={rBlur} color={node.color} opacity={0.3}>
        <BlurMask blur={15} style="normal" />
      </Circle>
      <Circle cx={0} cy={0} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
};\n```\n### Replacement (Chunk 6)\n```tsx\n  return (
    <Group transform={transform} opacity={focusOpacity}>
      <Circle cx={0} cy={0} r={rMain * 1.8} color={node.color} opacity={0.15} />
      <Circle cx={0} cy={0} r={rMain * 1.4} color={node.color} opacity={0.3} />
      <Circle cx={0} cy={0} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.isSelected === next.isSelected && prev.node.id === next.node.id);\n```\n### Target (Chunk 7)\n```tsx\nconst SkiaLink = ({ link, isDimmed }: SkiaLinkProps) => {\n```\n### Replacement (Chunk 7)\n```tsx\nconst SkiaLink = React.memo(({ link, isDimmed }: SkiaLinkProps) => {\n```\n### Target (Chunk 8)\n```tsx\n  );
};\n```\n### Replacement (Chunk 8)\n```tsx\n  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);\n```\n\n---\n\n## Step 2331 - replace_file_content\nInstruction: Close React.memo for SkiaLink\n### Target (Chunk 1)\n```tsx\n    </Group>
  );
};

export const CanvasMap = () => {\n```\n### Replacement (Chunk 1)\n```tsx\n    </Group>
  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);

export const CanvasMap = () => {\n```\n\n---\n\n## Step 2343 - replace_file_content\nInstruction: Fix SkiaLinkProps type error\n### Target (Chunk 1)\n```tsx\ninterface SkiaLinkProps {
  link: { p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  isDimmed: boolean;
}\n```\n### Replacement (Chunk 1)\n```tsx\ninterface SkiaLinkProps {
  link: { sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  isDimmed: boolean;
}\n```\n\n---\n\n## Step 2364 - multi_replace_file_content\nInstruction: Migrate Text rendering to Skia\n### Target (Chunk 1)\n```tsx\nimport { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask, DashPathEffect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask, DashPathEffect, Text as SkiaText, matchFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Target (Chunk 2)\n```tsx\ninterface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  isDimmed: boolean;
}

const NodeLabel = React.memo(({ node, scale, translateX, translateY, isDimmed }: NodeLabelProps) => {
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

  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.15 : 1, { duration: 300 });
  }, [isDimmed]);

  const style = useAnimatedStyle(() => {
    const s = scale.value;
    const x = CENTER.x + (posX.value - CENTER.x) * s + translateX.value;
    const y = CENTER.y + (posY.value - CENTER.y) * s + translateY.value + (nodeRadius * s) + 8;
    
    let baseOpacity = 1;
    let display: 'flex' | 'none' = 'flex';
    
    if (s < 0.6) {
      baseOpacity = 0;
      display = 'none';
    }

    if (x < -100 || x > width + 100 || y < -50 || y > height + 50) {
      baseOpacity = 0;
      display = 'none';
    }

    return {
      display,
      opacity: baseOpacity * focusOpacity.value,
      transform: [
        { translateX: x - 100 },
        { translateY: y }
      ]
    };
  });

  return (
    <Animated.View 
      style={[{
        position: 'absolute',
        left: 0, 
        top: 0,
        width: 200,
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: node.level === 0 ? 14 : 11,
        fontWeight: node.level === 0 ? 'bold' : 'normal',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {displayName}
      </Text>
    </Animated.View>
  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.node.id === next.node.id);\n```\n### Replacement (Chunk 2)\n```tsx\ninterface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  isDimmed: boolean;
  font: any;
}

const NodeLabel = React.memo(({ node, scale, isDimmed, font }: NodeLabelProps) => {
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

  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.15 : 1, { duration: 300 });
  }, [isDimmed]);

  const finalOpacity = useDerivedValue(() => {
    const s = scale.value;
    const base = s < 0.6 ? 0 : 1;
    return base * focusOpacity.value;
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
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.node.id === next.node.id);\n```\n### Target (Chunk 3)\n```tsx\nexport const CanvasMap = () => {
  const [nodes, setNodes] = useState<MapNode[]>([]);\n```\n### Replacement (Chunk 3)\n```tsx\nexport const CanvasMap = () => {
  // Inicialización de la fuente nativa para renderizado rápido
  const fontFamily = Platform.select({ ios: "Helvetica", default: "Roboto" });
  const fontNormal = matchFont({ fontFamily, fontSize: 11 });
  const fontBold = matchFont({ fontFamily, fontSize: 14, fontWeight: "bold" });

  const [nodes, setNodes] = useState<MapNode[]>([]);\n```\n### Target (Chunk 4)\n```tsx\n        {nodes.map(node => {
          const isSelected = selectedNode?.id === node.id;
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              isSelected={isSelected} 
              isDimmed={isDimmed}
            />
          );
        })}
            </Group>
          </Canvas>
      
      {/* Etiquetas Nativas superpuestas para evitar pixeleo de fuentes en Skia */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {nodes.map(node => {
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={scale} 
              translateX={translateX} 
              translateY={translateY}
              isDimmed={isDimmed}
            />
          );
        })}
      </View>
        </View>
      </GestureDetector>\n```\n### Replacement (Chunk 4)\n```tsx\n        {/* Nodos por encima */}
        {nodes.map(node => {
          const isSelected = selectedNode?.id === node.id;
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              isSelected={isSelected} 
              isDimmed={isDimmed}
            />
          );
        })}
        {/* Textos por encima de los nodos */}
        {nodes.map(node => {
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          const font = node.level === 0 ? fontBold : fontNormal;
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={scale} 
              isDimmed={isDimmed}
              font={font}
            />
          );
        })}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>\n```\n\n---\n\n## Step 2403 - multi_replace_file_content\nInstruction: Migrate to UI-Thread Selection\n### Target (Chunk 1)\n```tsx\nimport { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform } from 'react-native';
import { Canvas, Circle, Group, Line, vec, BlurMask, DashPathEffect, Text as SkiaText, matchFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform } from 'react-native';
import { Canvas, Circle, Group, Line, vec, DashPathEffect, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Target (Chunk 2)\n```tsx\n  scale: SharedValue<number>;
  isDimmed: boolean;
  font: any;
}

const NodeLabel = React.memo(({ node, scale, isDimmed, font }: NodeLabelProps) => {\n```\n### Replacement (Chunk 2)\n```tsx\n  scale: SharedValue<number>;
  font: any;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition }: NodeLabelProps) => {\n```\n### Target (Chunk 3)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.15 : 1, { duration: 300 });
  }, [isDimmed]);

  const finalOpacity = useDerivedValue(() => {
    const s = scale.value;
    const base = s < 0.6 ? 0 : 1;
    return base * focusOpacity.value;
  });\n```\n### Replacement (Chunk 3)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    const s = scale.value;
    if (s < 0.6) return 0;
    
    const state = activeFocusState.value;
    if (!state.selected) return 1;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    return isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
  });\n```\n### Target (Chunk 4)\n```tsx\n  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.node.id === next.node.id);

interface SkiaNodeProps {
  node: MapNode;
  isSelected: boolean;
  isDimmed: boolean;
}

const SkiaNode = React.memo(({ node, isSelected, isDimmed }: SkiaNodeProps) => {\n```\n### Replacement (Chunk 4)\n```tsx\n  );
}, (prev, next) => prev.node.id === next.node.id);

interface SkiaNodeProps {
  node: MapNode;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaNode = React.memo(({ node, activeFocusState, focusTransition }: SkiaNodeProps) => {\n```\n### Target (Chunk 5)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.15 : 1, { duration: 300 });
  }, [isDimmed]);

  return (
    <Group transform={transform} opacity={focusOpacity}>
      <Circle cx={0} cy={0} r={rMain * 1.8} color={node.color} opacity={0.15} />
      <Circle cx={0} cy={0} r={rMain * 1.4} color={node.color} opacity={0.3} />
      <Circle cx={0} cy={0} r={rMain} color={node.color} />
      {isSelected && (
        <Circle cx={0} cy={0} r={rSel} color="#ffffff" style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
}, (prev, next) => prev.isDimmed === next.isDimmed && prev.isSelected === next.isSelected && prev.node.id === next.node.id);

interface SkiaLinkProps {
  link: { sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  isDimmed: boolean;
}

const SkiaLink = React.memo(({ link, isDimmed }: SkiaLinkProps) => {\n```\n### Replacement (Chunk 5)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
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

const SkiaLink = React.memo(({ link, activeFocusState, focusTransition }: SkiaLinkProps) => {\n```\n### Target (Chunk 6)\n```tsx\n  const p1 = useDerivedValue(() => vec(p1X.value, p1Y.value));
  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
  const focusOpacity = useDerivedValue(() => {
    return withTiming(isDimmed ? 0.05 : 1, { duration: 300 });
  }, [isDimmed]);

  return (
    <Group opacity={focusOpacity}>\n```\n### Replacement (Chunk 6)\n```tsx\n  const p1 = useDerivedValue(() => vec(p1X.value, p1Y.value));
  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
  const focusOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    if (!state.selected) return 1;
    const isDimmed = !(state.connected[link.sourceId] && state.connected[link.targetId]);
    return isDimmed ? 1 - (0.95 * focusTransition.value) : 1;
  });

  return (
    <Group opacity={focusOpacity}>\n```\n### Target (Chunk 7)\n```tsx\nexport const CanvasMap = () => {
  // Inicialización de la fuente nativa para renderizado rápido
  const fontFamily = Platform.select({ ios: "Helvetica", default: "Roboto" });
  const fontNormal = matchFont({ fontFamily, fontSize: 11 });
  const fontBold = matchFont({ fontFamily, fontSize: 14, fontWeight: "bold" });

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullTopology, setFullTopology] = useState<MapTopology | null>(null);
  
  const [nodeLimit, setNodeLimit] = useState(300);
  const [sliderVal, setSliderVal] = useState(300);

  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());\n```\n### Replacement (Chunk 7)\n```tsx\nexport const CanvasMap = () => {
  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../assets/Roboto-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Roboto-Bold.ttf'), 14);

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<{ sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullTopology, setFullTopology] = useState<MapTopology | null>(null);
  
  const [nodeLimit, setNodeLimit] = useState(300);
  const [sliderVal, setSliderVal] = useState(300);

  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  // ESTADO 100% NATIVO PARA EL FOCUS MODE (CERO REACT RENDER)
  const activeFocusState = useSharedValue<{ selected: string | null, connected: Record<string, boolean> }>({ selected: null, connected: {} });
  const focusTransition = useSharedValue(0);\n```\n### Target (Chunk 8)\n```tsx\n  const handleNodeSelection = (node: MapNode | null) => {
    if (node) {
      Vibration.vibrate(50);
      const connected = new Set<string>();
      connected.add(node.id);
      links.forEach(l => {
        if (l.sourceId === node.id) connected.add(l.targetId);
        if (l.targetId === node.id) connected.add(l.sourceId);
      });
      setConnectedIds(connected);
    } else {
      setConnectedIds(new Set());
    }
    setSelectedNode(node);
  };\n```\n### Replacement (Chunk 8)\n```tsx\n  const handleNodeSelection = (node: MapNode | null) => {
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
  };\n```\n### Target (Chunk 9)\n```tsx\n        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => {
          const isDimmed = selectedNode !== null && !(connectedIds.has(link.sourceId) && connectedIds.has(link.targetId));
          return <SkiaLink key={`link-${index}`} link={link} isDimmed={isDimmed} />;
        })}
        {/* Nodos por encima */}
        {nodes.map(node => {
          const isSelected = selectedNode?.id === node.id;
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              isSelected={isSelected} 
              isDimmed={isDimmed}
            />
          );
        })}
        {/* Textos por encima de los nodos */}
        {nodes.map(node => {
          const isDimmed = selectedNode !== null && !connectedIds.has(node.id);
          const font = node.level === 0 ? fontBold : fontNormal;
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={scale} 
              isDimmed={isDimmed}
              font={font}
            />
          );
        })}\n```\n### Replacement (Chunk 9)\n```tsx\n        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
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
        })}\n```\n\n---\n\n## Step 2409 - replace_file_content\nInstruction: Fix SkiaLink memo\n### Target (Chunk 1)\n```tsx\n}, (prev, next) => prev.isDimmed === next.isDimmed && prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);\n```\n### Replacement (Chunk 1)\n```tsx\n}, (prev, next) => prev.link.sourceId === next.link.sourceId && prev.link.targetId === next.link.targetId);\n```\n\n---\n\n## Step 2421 - replace_file_content\nInstruction: Fix MapTopology type\n### Target (Chunk 1)\n```tsx\n  const [fullTopology, setFullTopology] = useState<MapTopology | null>(null);\n```\n### Replacement (Chunk 1)\n```tsx\n  const [fullTopology, setFullTopology] = useState<{ nodes: any[], links: any[] } | null>(null);\n```\n\n---\n\n## Step 2427 - replace_file_content\nInstruction: Wait for fonts to load before rendering\n### Target (Chunk 1)\n```tsx\n  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }\n```\n### Replacement (Chunk 1)\n```tsx\n  if (isLoading || !fontNormal || !fontBold) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }\n```\n\n---\n\n## Step 2433 - replace_file_content\nInstruction: Fix font require paths\n### Target (Chunk 1)\n```tsx\n  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../assets/Roboto-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Roboto-Bold.ttf'), 14);\n```\n### Replacement (Chunk 1)\n```tsx\n  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../../assets/Roboto-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../../assets/Roboto-Bold.ttf'), 14);\n```\n\n---\n\n## Step 2467 - replace_file_content\nInstruction: Fix font paths back to 3 levels\n### Target (Chunk 1)\n```tsx\n  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../../assets/Roboto-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../../assets/Roboto-Bold.ttf'), 14);\n```\n### Replacement (Chunk 1)\n```tsx\n  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../assets/Roboto-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Roboto-Bold.ttf'), 14);\n```\n\n---\n\n## Step 2476 - replace_file_content\nInstruction: Change fonts to Modelica\n### Target (Chunk 1)\n```tsx\n  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../assets/Roboto-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Roboto-Bold.ttf'), 14);\n```\n### Replacement (Chunk 1)\n```tsx\n  // Inicialización de la fuente nativa
  const fontNormal = useFont(require('../../../assets/Modelica-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Modelica-Bold.ttf'), 14);\n```\n\n---\n\n## Step 2483 - replace_file_content\nInstruction: Import interpolate\n### Target (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue } from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation } from 'react-native-reanimated';\n```\n\n---\n\n## Step 2486 - replace_file_content\nInstruction: Use interpolation for scale fading\n### Target (Chunk 1)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    const s = scale.value;
    if (s < 0.6) return 0;
    
    const state = activeFocusState.value;
    if (!state.selected) return 1;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    return isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
  });\n```\n### Replacement (Chunk 1)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    const baseZoomOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);
    if (baseZoomOpacity === 0) return 0;
    
    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
    
    return baseZoomOpacity * focusMultiplier;
  });\n```\n\n---\n\n## Step 2594 - multi_replace_file_content\nInstruction: Replace console.log with Logger\n### Target (Chunk 1)\n```tsx\nimport Animated from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { NodeInfoOverlay } from './NodeInfoOverlay';\n```\n### Replacement (Chunk 1)\n```tsx\nimport Animated from 'react-native-reanimated';
import { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';\n```\n### Target (Chunk 2)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => console.log('Ver perfil de', selectedNode.id)}
          onUpdateLocalName={(newName) => {\n```\n### Replacement (Chunk 2)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => Logger.log('Ver perfil de', selectedNode.id)}
          onUpdateLocalName={(newName) => {\n```\n\n---\n\n## Step 2771 - multi_replace_file_content\nInstruction: Update CanvasMap.tsx for Semantic Zoom and Province Layout\n### Target (Chunk 1)\n```tsx\n  level: number;
  vx: number;
  vy: number;
}\n```\n### Replacement (Chunk 1)\n```tsx\n  level: number;
  nodeType: 'CITIZEN' | 'PROVINCE';
  vx: number;
  vy: number;
}\n```\n### Target (Chunk 2)\n```tsx\n  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition }: NodeLabelProps) => {\n```\n### Replacement (Chunk 2)\n```tsx\n  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SEMANTIC_ZOOM_THRESHOLD = 0.5;

const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition }: NodeLabelProps) => {\n```\n### Target (Chunk 3)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    const baseZoomOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);
    if (baseZoomOpacity === 0) return 0;\n```\n### Replacement (Chunk 3)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.2, SEMANTIC_ZOOM_THRESHOLD + 0.1], [1, 0], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.1, SEMANTIC_ZOOM_THRESHOLD + 0.2], [0, 1], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;\n```\n### Target (Chunk 4)\n```tsx\n  const getRadius = (level: number) => {
    switch (level) {
      case 0: return { rMain: 28, rSel: 34 };
      case 1: return { rMain: 16, rSel: 22 }; 
      case 2: return { rMain: 11, rSel: 16 }; 
      case 3: default: return { rMain: 7, rSel: 11 }; 
    }
  };
  const { rMain, rSel } = getRadius(node.level);\n```\n### Replacement (Chunk 4)\n```tsx\n  const getRadius = (level: number, nodeType: string) => {
    if (nodeType === 'PROVINCE') return { rMain: 60, rSel: 70 };
    switch (level) {
      case 0: return { rMain: 28, rSel: 34 };
      case 1: return { rMain: 16, rSel: 22 }; 
      case 2: return { rMain: 11, rSel: 16 }; 
      case 3: default: return { rMain: 7, rSel: 11 }; 
    }
  };
  const { rMain, rSel } = getRadius(node.level, node.nodeType);\n```\n### Target (Chunk 5)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    if (!state.selected) return 1;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    return isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
  });\n```\n### Replacement (Chunk 5)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.2, SEMANTIC_ZOOM_THRESHOLD + 0.1], [1, 0], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.1, SEMANTIC_ZOOM_THRESHOLD + 0.2], [0, 1], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;

    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    return baseZoomOpacity * (isDimmed ? 1 - (0.85 * focusTransition.value) : 1);
  });\n```\n### Target (Chunk 6)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    const state = activeFocusState.value;
    if (!state.selected) return 1;
    const isDimmed = !(state.connected[link.sourceId] && state.connected[link.targetId]);
    return isDimmed ? 1 - (0.95 * focusTransition.value) : 1;
  });\n```\n### Replacement (Chunk 6)\n```tsx\n  const focusOpacity = useDerivedValue(() => {
    // Opacidad base para los enlaces. Los enlaces a provincias solo se ven al hacer zoom out
    let baseZoomOpacity = 1;
    if (link.level === -1) { // -1 es Provincia a Ciudadano
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.2, SEMANTIC_ZOOM_THRESHOLD + 0.1], [1, 0], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.1, SEMANTIC_ZOOM_THRESHOLD + 0.2], [0, 1], Extrapolation.CLAMP);
    }
    
    if (baseZoomOpacity === 0) return 0;

    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity;
    const isDimmed = !(state.connected[link.sourceId] && state.connected[link.targetId]);
    return baseZoomOpacity * (isDimmed ? 1 - (0.95 * focusTransition.value) : 1);
  });\n```\n### Target (Chunk 7)\n```tsx\n        nodeMap.set(cit.networkData.id, {
          id: cit.networkData.id,
          alias: cit.networkData.alias,
          localName: cit.localData.localName,
          merit: cit.networkData.merit,
          pos: { x: 0, y: 0 },
          color: colorByLevel[cit.level] || '#94a3b8',
          level: cit.level,
          vx: 0,
          vy: 0
        });\n```\n### Replacement (Chunk 7)\n```tsx\n        nodeMap.set(cit.networkData.id, {
          id: cit.networkData.id,
          alias: cit.networkData.alias,
          localName: cit.localData.localName,
          merit: cit.networkData.merit,
          pos: { x: 0, y: 0 },
          color: cit.nodeType === 'PROVINCE' ? '#8b5cf6' : (colorByLevel[cit.level] || '#94a3b8'),
          level: cit.level,
          nodeType: cit.nodeType || 'CITIZEN',
          vx: 0,
          vy: 0
        });\n```\n### Target (Chunk 8)\n```tsx\n      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);

      // 4.5 Jiggle de Relajación\n```\n### Replacement (Chunk 8)\n```tsx\n      nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
      distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);

      // Posicionar Provincias
      const provinces = allSimNodes.filter(n => n.nodeType === 'PROVINCE');
      const PROVINCE_RADIUS = 1600; // Radio muy lejano para el macro-mapa
      provinces.forEach((prov, i) => {
        const angle = (Math.PI * 2 / provinces.length) * i;
        prov.pos.x = CENTER.x + Math.cos(angle) * PROVINCE_RADIUS;
        prov.pos.y = CENTER.y + Math.sin(angle) * PROVINCE_RADIUS;
      });

      // 4.5 Jiggle de Relajación\n```\n\n---\n\n## Step 2780 - multi_replace_file_content\nInstruction: Pass scale as prop to SkiaNode and SkiaLink\n### Target (Chunk 1)\n```tsx\ninterface SkiaNodeProps {
  node: MapNode;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaNode = React.memo(({ node, activeFocusState, focusTransition }: SkiaNodeProps) => {\n```\n### Replacement (Chunk 1)\n```tsx\ninterface SkiaNodeProps {
  node: MapNode;
  scale: SharedValue<number>;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaNode = React.memo(({ node, scale, activeFocusState, focusTransition }: SkiaNodeProps) => {\n```\n### Target (Chunk 2)\n```tsx\ninterface SkiaLinkProps {
  link: { sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaLink = React.memo(({ link, activeFocusState, focusTransition }: SkiaLinkProps) => {\n```\n### Replacement (Chunk 2)\n```tsx\ninterface SkiaLinkProps {
  link: { sourceId: string, targetId: string, p1: {x:number, y:number}, p2: {x:number, y:number}, level: number, color: string, isPrimary?: boolean };
  scale: SharedValue<number>;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const SkiaLink = React.memo(({ link, scale, activeFocusState, focusTransition }: SkiaLinkProps) => {\n```\n### Target (Chunk 3)\n```tsx\n        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
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
        })}\n```\n### Replacement (Chunk 3)\n```tsx\n        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => {
          return <SkiaLink key={`link-${index}`} link={link} scale={scale} activeFocusState={activeFocusState} focusTransition={focusTransition} />;
        })}
        {/* Nodos por encima */}
        {nodes.map(node => {
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              scale={scale}
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}\n```\n\n---\n\n## Step 2786 - multi_replace_file_content\nInstruction: Fix province slicing and add Semantic Zoom controls\n### Target (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation, useAnimatedReaction } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { TouchableOpacity, Pressable } from 'react-native';\n```\n### Target (Chunk 2)\n```tsx\n      const mainId = mainNodes[0].networkData.id;
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      const allSimNodes = Array.from(nodeMap.values()).slice(0, nodeLimit);
      const allowedIds = new Set(allSimNodes.map(n => n.id));\n```\n### Replacement (Chunk 2)\n```tsx\n      const mainId = mainNodes[0].networkData.id;
      nodeMap.get(mainId)!.pos.x = CENTER.x;
      nodeMap.get(mainId)!.pos.y = CENTER.y;

      // Filtramos para asegurar que las Provincias y Causas NUNCA sean recortadas por el Slider (nodeLimit)
      const citizenNodes = Array.from(nodeMap.values()).filter(n => n.nodeType === 'CITIZEN').slice(0, nodeLimit);
      const macroNodes = Array.from(nodeMap.values()).filter(n => n.nodeType !== 'CITIZEN');
      
      const allSimNodes = [...macroNodes, ...citizenNodes];
      const allowedIds = new Set(allSimNodes.map(n => n.id));\n```\n### Target (Chunk 3)\n```tsx\n  const MIN_SCALE = Math.max(0.05, Math.min(width, height) / (bounds.R * 2.5)); // Zoom out generoso
  const MAX_SCALE = 4.0; // Zoom in profundo para interactuar cómodamente con las hojas fucsias

  const panGesture = Gesture.Pan()\n```\n### Replacement (Chunk 3)\n```tsx\n  const MIN_SCALE = Math.max(0.05, Math.min(width, height) / (bounds.R * 2.5)); // Zoom out generoso
  const MAX_SCALE = 4.0; // Zoom in profundo para interactuar cómodamente con las hojas fucsias

  // Estado Reactivo para los botones
  const [currentLOD, setCurrentLOD] = useState(1);

  useAnimatedReaction(
    () => scale.value,
    (currentScale) => {
      if (currentScale >= SEMANTIC_ZOOM_THRESHOLD) {
        if (currentLOD !== 1) runOnJS(setCurrentLOD)(1);
      } else if (currentScale >= 0.1) {
        if (currentLOD !== 2) runOnJS(setCurrentLOD)(2);
      } else {
        if (currentLOD !== 3) runOnJS(setCurrentLOD)(3);
      }
    }
  );

  const goToLOD = (level: number) => {
    let targetScale = 1;
    if (level === 1) targetScale = 1.0;
    if (level === 2) targetScale = 0.4;
    if (level === 3) targetScale = 0.08;
    
    scale.value = withSpring(targetScale);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const panGesture = Gesture.Pan()\n```\n### Target (Chunk 4)\n```tsx\n        </View>
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
});\n```\n### Replacement (Chunk 4)\n```tsx\n        </View>
      </GestureDetector>

      {/* Navegación Semántica (Controles LOD) */}
      <View style={styles.lodControlsContainer}>
        {[
          { level: 3, label: 'Causas' },
          { level: 2, label: 'Provincias' },
          { level: 1, label: 'Ciudadanos' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <View key={item.level} style={styles.lodItem}>
              {isActive && (
                <Text style={styles.lodLabel}>{item.label}</Text>
              )}
              <Pressable 
                onPress={() => goToLOD(item.level)}
                style={[
                  styles.lodButton,
                  isActive && styles.lodButtonActive
                ]}
              />
            </View>
          );
        })}
      </View>

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
  },
  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 120, // Suficientemente arriba para no chocar con el bottom sheet
    alignItems: 'flex-end',
    gap: 15,
  },
  lodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lodLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lodButton: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  lodButtonActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#06b6d4',
    borderColor: '#ffffff',
  }
});\n```\n\n---\n\n## Step 2795 - multi_replace_file_content\nInstruction: Add animated background and move LOD controls\n### Target (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation, useAnimatedReaction } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation, useAnimatedReaction, interpolateColor } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';\n```\n### Target (Chunk 2)\n```tsx\n  return (
    <View style={styles.container}>
      {/* DEBUGER UI (Temporal) */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 10 }}>\n```\n### Replacement (Chunk 2)\n```tsx\n  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      scale.value,
      [0.08, 0.4, 1.0],
      ['#1e293b', '#0f172a', '#020617']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withSpring(selectedNode ? 280 : 40, { damping: 20, stiffness: 200 })
    };
  });

  return (
    <Animated.View style={[styles.container, animatedBackground]}>
      {/* DEBUGER UI (Temporal) */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 10 }}>\n```\n### Target (Chunk 3)\n```tsx\n        </View>
      </GestureDetector>

      {/* Navegación Semántica (Controles LOD) */}
      <View style={styles.lodControlsContainer}>
        {[
          { level: 3, label: 'Causas' },
          { level: 2, label: 'Provincias' },
          { level: 1, label: 'Ciudadanos' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <View key={item.level} style={styles.lodItem}>
              {isActive && (
                <Text style={styles.lodLabel}>{item.label}</Text>
              )}
              <Pressable 
                onPress={() => goToLOD(item.level)}
                style={[
                  styles.lodButton,
                  isActive && styles.lodButtonActive
                ]}
              />
            </View>
          );
        })}
      </View>

      {selectedNode && (\n```\n### Replacement (Chunk 3)\n```tsx\n        </View>
      </GestureDetector>

      {/* Navegación Semántica (Controles LOD) */}
      <Animated.View style={[styles.lodControlsContainer, lodControlsStyle]}>
        {[
          { level: 3, label: 'Causas' },
          { level: 2, label: 'Provincias' },
          { level: 1, label: 'Ciudadanos' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <View key={item.level} style={styles.lodItem}>
              {isActive && (
                <Text style={styles.lodLabel}>{item.label}</Text>
              )}
              <Pressable 
                onPress={() => goToLOD(item.level)}
                style={[
                  styles.lodButton,
                  isActive && styles.lodButtonActive
                ]}
              />
            </View>
          );
        })}
      </Animated.View>

      {selectedNode && (\n```\n### Target (Chunk 4)\n```tsx\n          }}
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
  },
  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 120, // Suficientemente arriba para no chocar con el bottom sheet
    alignItems: 'flex-end',
    gap: 15,
  },\n```\n### Replacement (Chunk 4)\n```tsx\n          }}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  },
  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 15,
  },\n```\n\n---\n\n## Step 2801 - multi_replace_file_content\nInstruction: Move useAnimatedStyle hooks before early return in CanvasMap\n### Target (Chunk 1)\n```tsx\n  const globalTransform = useDerivedValue(() => {
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
  }\n```\n### Replacement (Chunk 1)\n```tsx\n  const globalTransform = useDerivedValue(() => {
    return [
      { translateX: CENTER.x + translateX.value },
      { translateY: CENTER.y + translateY.value },
      { scale: scale.value },
      { translateX: -CENTER.x },
      { translateY: -CENTER.y },
    ];
  });

  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      scale.value,
      [0.08, 0.4, 1.0],
      ['#1e293b', '#0f172a', '#020617']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withSpring(selectedNode ? 280 : 40, { damping: 20, stiffness: 200 })
    };
  });

  if (isLoading || !fontNormal || !fontBold) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }\n```\n### Target (Chunk 2)\n```tsx\n  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      scale.value,
      [0.08, 0.4, 1.0],
      ['#1e293b', '#0f172a', '#020617']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withSpring(selectedNode ? 280 : 40, { damping: 20, stiffness: 200 })
    };
  });

  return (
    <Animated.View style={[styles.container, animatedBackground]}>
      {/* DEBUGER UI (Temporal) */}\n```\n### Replacement (Chunk 2)\n```tsx\n  return (
    <Animated.View style={[styles.container, animatedBackground]}>
      {/* DEBUGER UI (Temporal) */}\n```\n\n---\n\n## Step 2813 - multi_replace_file_content\nInstruction: Refactor CanvasMap to use explicit view modes, fix physics agglomeration, and update LOD controls styling.\n### Target (Chunk 1)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.2, SEMANTIC_ZOOM_THRESHOLD + 0.1], [1, 0], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.1, SEMANTIC_ZOOM_THRESHOLD + 0.2], [0, 1], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;
    
    const state = activeFocusState.value;\n```\n### Replacement (Chunk 1)\n```tsx\n  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const finalOpacity = useDerivedValue(() => {
    // Escala de opacidad basada en el Modo de Vista (animMode) en lugar del zoom crudo
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [0, 1], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [1, 0.15], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;
    
    const state = activeFocusState.value;\n```\n### Target (Chunk 2)\n```tsx\n  // En lugar de calcular cx/cy constantemente, aplicamos un transform matricial
  const transform = useDerivedValue(() => [{ translateX: posX.value }, { translateY: posY.value }]);
  
  const focusOpacity = useDerivedValue(() => {
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.2, SEMANTIC_ZOOM_THRESHOLD + 0.1], [1, 0], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.1, SEMANTIC_ZOOM_THRESHOLD + 0.2], [0, 1], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;

    const state = activeFocusState.value;\n```\n### Replacement (Chunk 2)\n```tsx\n  // En lugar de calcular cx/cy constantemente, aplicamos un transform matricial
  const transform = useDerivedValue(() => [{ translateX: posX.value }, { translateY: posY.value }]);
  
  const focusOpacity = useDerivedValue(() => {
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [0, 1], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [1, 0.15], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;

    const state = activeFocusState.value;\n```\n### Target (Chunk 3)\n```tsx\n  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
  const focusOpacity = useDerivedValue(() => {
    // Opacidad base para los enlaces. Los enlaces a provincias solo se ven al hacer zoom out
    let baseZoomOpacity = 1;
    if (link.level === -1) { // -1 es Provincia a Ciudadano
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.2, SEMANTIC_ZOOM_THRESHOLD + 0.1], [1, 0], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [SEMANTIC_ZOOM_THRESHOLD - 0.1, SEMANTIC_ZOOM_THRESHOLD + 0.2], [0, 1], Extrapolation.CLAMP);
    }
    
    if (baseZoomOpacity === 0) return 0;

    const state = activeFocusState.value;\n```\n### Replacement (Chunk 3)\n```tsx\n  const p2 = useDerivedValue(() => vec(p2X.value, p2Y.value));
  
  const focusOpacity = useDerivedValue(() => {
    // Opacidad base para los enlaces.
    let baseZoomOpacity = 1;
    if (link.level === -1) { // -1 es Provincia a Ciudadano
      baseZoomOpacity = interpolate(scale.value, [1, 2], [0, 1], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [1, 0.15], Extrapolation.CLAMP);
    }
    
    if (baseZoomOpacity === 0) return 0;

    const state = activeFocusState.value;\n```\n### Target (Chunk 4)\n```tsx\n      const childrenMap = new Map<string, string[]>();
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
      });\n```\n### Replacement (Chunk 4)\n```tsx\n      const childrenMap = new Map<string, string[]>();
      allSimNodes.forEach(n => childrenMap.set(n.id, []));
      
      const seenTargets = new Set<string>();
      // Ordenamos para priorizar los enlaces de nivel más bajo (más cercanos al centro) como primarios
      allSimLinks.sort((a, b) => a.level - b.level).forEach(l => {
        if (l.level === -1) {
          // IGNORAR LOS ENLACES A PROVINCIAS EN EL ÁRBOL DE FÍSICAS DE CIUDADANOS
          // Esto evita que todos los ciudadanos se aglomeren en el centro!
          l.isPrimary = false;
          return;
        }
        if (!seenTargets.has(l.targetId)) {
          l.isPrimary = true;
          seenTargets.add(l.targetId);
          childrenMap.get(l.sourceId)?.push(l.targetId);
        } else {
          l.isPrimary = false;
        }
      });\n```\n### Target (Chunk 5)\n```tsx\n  const [bounds, setBounds] = useState({ R: 1000 });

  const MIN_SCALE = Math.max(0.05, Math.min(width, height) / (bounds.R * 2.5)); // Zoom out generoso
  const MAX_SCALE = 4.0; // Zoom in profundo para interactuar cómodamente con las hojas fucsias

  // Estado Reactivo para los botones
  const [currentLOD, setCurrentLOD] = useState(1);

  useAnimatedReaction(
    () => scale.value,
    (currentScale) => {
      if (currentScale >= SEMANTIC_ZOOM_THRESHOLD) {
        if (currentLOD !== 1) runOnJS(setCurrentLOD)(1);
      } else if (currentScale >= 0.1) {
        if (currentLOD !== 2) runOnJS(setCurrentLOD)(2);
      } else {
        if (currentLOD !== 3) runOnJS(setCurrentLOD)(3);
      }
    }
  );

  const goToLOD = (level: number) => {
    let targetScale = 1;
    if (level === 1) targetScale = 1.0;
    if (level === 2) targetScale = 0.4;
    if (level === 3) targetScale = 0.08;
    
    scale.value = withSpring(targetScale);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const panGesture = Gesture.Pan()\n```\n### Replacement (Chunk 5)\n```tsx\n  const [bounds, setBounds] = useState({ R: 2000 });

  // Máquina de estados para los modos de vista
  const [currentLOD, setCurrentLOD] = useState(1);
  const animMode = useSharedValue(1); // 1 = Ciudadanos, 2 = Provincias, 3 = Causas
  
  // Como ya no dependemos del scale crudo para la opacidad, reutilizamos 'scale' como passthrough para 'animMode'
  // Pero lo nombraremos correctamente en los componentes. Por compatibilidad temporal:
  const visualScale = animMode; // Usamos esto en vez de scale.value para la opacidad visual

  const goToLOD = (level: number) => {
    setCurrentLOD(level);
    animMode.value = withTiming(level, { duration: 500 });
    
    // Animar la cámara a una posición cómoda para el nivel
    if (level === 1) {
      scale.value = withSpring(1.0);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    } else if (level === 2) {
      scale.value = withSpring(0.15); // Zoom out para ver las provincias
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  const panGesture = Gesture.Pan()\n```\n### Target (Chunk 6)\n```tsx\n  const pinchGesture = Gesture.Pinch()
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
      scale.value = nextScale;\n```\n### Replacement (Chunk 6)\n```tsx\n  const pinchGesture = Gesture.Pinch()
    .onBegin((e) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      originFocalX.value = e.focalX;
      originFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      // Límites dinámicos basados en el estado actual
      const dynMin = animMode.value > 1.5 ? 0.02 : 0.1;
      const dynMax = animMode.value > 1.5 ? 2.0 : 4.0;
      
      let nextScale = savedScale.value * e.scale;
      
      if (nextScale > dynMax) {
        nextScale = dynMax + (nextScale - dynMax) * 0.15;
      } else if (nextScale < dynMin) {
        nextScale = dynMin - (dynMin - nextScale) * 0.15;
      }
      scale.value = nextScale;\n```\n### Target (Chunk 7)\n```tsx\n    .onEnd(() => {
      let finalScale = scale.value;
      if (scale.value < MIN_SCALE) {
        finalScale = MIN_SCALE;
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        finalScale = MAX_SCALE;
        scale.value = withSpring(MAX_SCALE);
      }\n```\n### Replacement (Chunk 7)\n```tsx\n    .onEnd(() => {
      const dynMin = animMode.value > 1.5 ? 0.02 : 0.1;
      const dynMax = animMode.value > 1.5 ? 2.0 : 4.0;
      
      let finalScale = scale.value;
      if (scale.value < dynMin) {
        finalScale = dynMin;
        scale.value = withSpring(dynMin);
      } else if (scale.value > dynMax) {
        finalScale = dynMax;
        scale.value = withSpring(dynMax);
      }\n```\n### Target (Chunk 8)\n```tsx\n  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      scale.value,
      [0.08, 0.4, 1.0],
      ['#1e293b', '#0f172a', '#020617']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withSpring(selectedNode ? 280 : 40, { damping: 20, stiffness: 200 })
    };
  });\n```\n### Replacement (Chunk 8)\n```tsx\n  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 280 : 40, { duration: 300 })
    };
  });\n```\n### Target (Chunk 9)\n```tsx\n        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => {
          return <SkiaLink key={`link-${index}`} link={link} scale={scale} activeFocusState={activeFocusState} focusTransition={focusTransition} />;
        })}
        {/* Nodos por encima */}
        {nodes.map(node => {
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              scale={scale}
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
        })}\n```\n### Replacement (Chunk 9)\n```tsx\n        {/* Renderizado en orden de Z-Index (Líneas debajo, Nodos encima) */}
        {links.map((link, index) => {
          return <SkiaLink key={`link-${index}`} link={link} scale={visualScale} activeFocusState={activeFocusState} focusTransition={focusTransition} />;
        })}
        {/* Nodos por encima */}
        {nodes.map(node => {
          return (
            <SkiaNode 
              key={`node-${node.id}`} 
              node={node} 
              scale={visualScale}
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
              scale={visualScale} 
              font={font}
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}\n```\n### Target (Chunk 10)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 15,
  },\n```\n### Replacement (Chunk 10)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 15,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },\n```\n\n---\n\n## Step 2822 - replace_file_content\nInstruction: Remove duplicated posX and posY declarations\n### Target (Chunk 1)\n```tsx\n  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);\n```\n### Replacement (Chunk 1)\n```tsx\n\n```\n\n---\n\n## Step 2828 - replace_file_content\nInstruction: Remove the duplicate declarations of posX and posY in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

\n```\n### Replacement (Chunk 1)\n```tsx\n\n```\n\n---\n\n## Step 2831 - multi_replace_file_content\nInstruction: Remove duplicated declarations in CanvasMap\n### Target (Chunk 1)\n```tsx\n  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const posX = useSharedValue(node.pos.x);
  const posY = useSharedValue(node.pos.y);

  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const finalOpacity = useDerivedValue(() => {\n```\n### Replacement (Chunk 1)\n```tsx\n  useEffect(() => {
    posX.value = withSpring(node.pos.x);
    posY.value = withSpring(node.pos.y);
  }, [node.pos.x, node.pos.y]);

  const finalOpacity = useDerivedValue(() => {\n```\n\n---\n\n## Step 2837 - multi_replace_file_content\nInstruction: Adjust LOD bottom and fix zoom bounce by using dynamic pan bounds\n### Target (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
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
    });\n```\n### Replacement (Chunk 1)\n```tsx\n  const panGesture = Gesture.Pan()
    .maxPointers(1) // EXCLUSIVIDAD: Solo un dedo permite el paneo.
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const dynBoundsR = animMode.value > 1.5 ? 8000 : 2000;
      const panLimitX = Math.max(0, dynBoundsR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, dynBoundsR * scale.value - height / 2 + 100);
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
      const dynBoundsR = animMode.value > 1.5 ? 8000 : 2000;
      const panLimitX = Math.max(0, dynBoundsR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, dynBoundsR * scale.value - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Target (Chunk 2)\n```tsx\n      // Si al terminar de hacer zoom, la cámara quedó "fuera de los límites" (porque el grafo encogió), 
      // forzamos a la cámara a regresar al límite del nuevo tamaño del grafo con un resorte.
      const panLimitX = Math.max(0, bounds.R * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, bounds.R * finalScale - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);\n```\n### Replacement (Chunk 2)\n```tsx\n      // Si al terminar de hacer zoom, la cámara quedó "fuera de los límites" (porque el grafo encogió), 
      // forzamos a la cámara a regresar al límite del nuevo tamaño del grafo con un resorte.
      const dynBoundsR = animMode.value > 1.5 ? 8000 : 2000;
      const panLimitX = Math.max(0, dynBoundsR * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, dynBoundsR * finalScale - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);\n```\n### Target (Chunk 3)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 280 : 40, { duration: 300 })
    };
  });\n```\n### Replacement (Chunk 3)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 220 : 40, { duration: 300 })
    };
  });\n```\n\n---\n\n## Step 2843 - multi_replace_file_content\nInstruction: Fix pan bounds, zoom bounce focal recalculation, and LOD margin in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n      let maxR = 0;
      allSimNodes.forEach(n => {
        const dx = n.pos.x - CENTER.x;
        const dy = n.pos.y - CENTER.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) maxR = dist;
      });
      // Añadimos 50px de margen extra alrededor de los nodos más lejanos
      setBounds({ R: maxR + 50 });

      // 5. Aplicar al Estado Visual\n```\n### Replacement (Chunk 1)\n```tsx\n      let maxCitizenR = 0;
      citizenNodes.forEach(n => {
        const dx = n.pos.x - CENTER.x;
        const dy = n.pos.y - CENTER.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxCitizenR) maxCitizenR = dist;
      });

      let maxR = maxCitizenR;
      allSimNodes.forEach(n => {
        const dx = n.pos.x - CENTER.x;
        const dy = n.pos.y - CENTER.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) maxR = dist;
      });
      // Añadimos 50px de margen extra alrededor de los nodos más lejanos
      setBounds({ R: maxR + 50, CitizenR: maxCitizenR + 50 });

      // 5. Aplicar al Estado Visual\n```\n### Target (Chunk 2)\n```tsx\n  const [bounds, setBounds] = useState({ R: 2000 });

  // Máquina de estados para los modos de vista\n```\n### Replacement (Chunk 2)\n```tsx\n  const [bounds, setBounds] = useState({ R: 2000, CitizenR: 1000 });

  // Máquina de estados para los modos de vista\n```\n### Target (Chunk 3)\n```tsx\n    .onUpdate((e) => {
      const dynBoundsR = animMode.value > 1.5 ? 8000 : 2000;
      const panLimitX = Math.max(0, dynBoundsR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, dynBoundsR * scale.value - height / 2 + 100);
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;\n```\n### Replacement (Chunk 3)\n```tsx\n    .onUpdate((e) => {
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const panLimitX = Math.max(0, activeR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, activeR * scale.value - height / 2 + 100);
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;\n```\n### Target (Chunk 4)\n```tsx\n    .onEnd(() => {
      const dynBoundsR = animMode.value > 1.5 ? 8000 : 2000;
      const panLimitX = Math.max(0, dynBoundsR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, dynBoundsR * scale.value - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Replacement (Chunk 4)\n```tsx\n    .onEnd(() => {
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const panLimitX = Math.max(0, activeR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, activeR * scale.value - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Target (Chunk 5)\n```tsx\n    .onEnd(() => {
      const dynMin = animMode.value > 1.5 ? 0.02 : 0.1;
      const dynMax = animMode.value > 1.5 ? 2.0 : 4.0;
      
      let finalScale = scale.value;
      if (scale.value < dynMin) {
        finalScale = dynMin;
        scale.value = withSpring(dynMin);
      } else if (scale.value > dynMax) {
        finalScale = dynMax;
        scale.value = withSpring(dynMax);
      }

      // Si al terminar de hacer zoom, la cámara quedó "fuera de los límites" (porque el grafo encogió), 
      // forzamos a la cámara a regresar al límite del nuevo tamaño del grafo con un resorte.
      const dynBoundsR = animMode.value > 1.5 ? 8000 : 2000;
      const panLimitX = Math.max(0, dynBoundsR * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, dynBoundsR * finalScale - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Replacement (Chunk 5)\n```tsx\n    .onEnd(() => {
      const dynMin = animMode.value > 1.5 ? 0.02 : 0.1;
      const dynMax = animMode.value > 1.5 ? 2.0 : 4.0;
      
      let finalScale = scale.value;
      let needsScaleSpring = false;
      
      if (scale.value < dynMin) {
        finalScale = dynMin;
        needsScaleSpring = true;
      } else if (scale.value > dynMax) {
        finalScale = dynMax;
        needsScaleSpring = true;
      }

      let finalTranslateX = translateX.value;
      let finalTranslateY = translateY.value;

      if (needsScaleSpring) {
        scale.value = withSpring(finalScale);
        
        // Magia de Recálculo Focal: Si el zoom rebotó, debemos recalcular la traslación EXACTA 
        // para ese zoom final, o la cámara saldrá disparada hacia otra dirección
        const adjustedFocalX = originFocalX.value - width / 2;
        const adjustedFocalY = originFocalY.value - height / 2;
        const scaleRatio = finalScale / savedScale.value;
        
        finalTranslateX = savedTranslateX.value * scaleRatio + adjustedFocalX * (1 - scaleRatio);
        finalTranslateY = savedTranslateY.value * scaleRatio + adjustedFocalY * (1 - scaleRatio);
        
        translateX.value = withSpring(finalTranslateX);
        translateY.value = withSpring(finalTranslateY);
      }

      // 2. Limites de paneo basados en la traslación corregida
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const panLimitX = Math.max(0, activeR * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, activeR * finalScale - height / 2 + 100);
      
      if (finalTranslateX > panLimitX) translateX.value = withSpring(panLimitX);
      if (finalTranslateX < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (finalTranslateY > panLimitY) translateY.value = withSpring(panLimitY);
      if (finalTranslateY < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Target (Chunk 6)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 220 : 40, { duration: 300 })
    };
  });\n```\n### Replacement (Chunk 6)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 160 : 40, { duration: 300 })
    };
  });\n```\n\n---\n\n## Step 2852 - multi_replace_file_content\nInstruction: Trigger goToLOD on pinch gesture bounds limits in CanvasMap\n### Target (Chunk 1)\n```tsx\n    .onEnd(() => {
      const dynMin = animMode.value > 1.5 ? 0.02 : 0.1;
      const dynMax = animMode.value > 1.5 ? 2.0 : 4.0;
      
      let finalScale = scale.value;
      let needsScaleSpring = false;
      
      if (scale.value < dynMin) {
        finalScale = dynMin;
        needsScaleSpring = true;
      } else if (scale.value > dynMax) {
        finalScale = dynMax;
        needsScaleSpring = true;
      }

      let finalTranslateX = translateX.value;\n```\n### Replacement (Chunk 1)\n```tsx\n    .onEnd(() => {
      const dynMin = animMode.value > 1.5 ? 0.02 : 0.1;
      const dynMax = animMode.value > 1.5 ? 2.0 : 4.0;
      
      let finalScale = scale.value;
      let needsScaleSpring = false;
      let targetLOD = Math.round(animMode.value);
      
      if (scale.value < dynMin) {
        // Hizo Pinch OUT más allá del límite -> Subir nivel (ej. Ciudadanos -> Provincias)
        if (targetLOD < 3) {
          targetLOD++;
        } else {
          finalScale = dynMin;
          needsScaleSpring = true;
        }
      } else if (scale.value > dynMax) {
        // Hizo Pinch IN más allá del límite -> Bajar nivel (ej. Provincias -> Ciudadanos)
        if (targetLOD > 1) {
          targetLOD--;
        } else {
          finalScale = dynMax;
          needsScaleSpring = true;
        }
      }

      // Si cruzamos el umbral semántico, disparamos el salto de nivel 
      // y cancelamos el resto de físicas locales
      if (targetLOD !== Math.round(animMode.value)) {
        runOnJS(goToLOD)(targetLOD);
        return;
      }

      let finalTranslateX = translateX.value;\n```\n### Target (Chunk 2)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 160 : 40, { duration: 300 })
    };
  });\n```\n### Replacement (Chunk 2)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 190 : 40, { duration: 300 })
    };
  });\n```\n\n---\n\n## Step 2858 - multi_replace_file_content\nInstruction: Fix pan limits uniformity and remove camera reset in goToLOD\n### Target (Chunk 1)\n```tsx\n  const goToLOD = (level: number) => {
    setCurrentLOD(level);
    animMode.value = withTiming(level, { duration: 500 });
    
    // Animar la cámara a una posición cómoda para el nivel
    if (level === 1) {
      scale.value = withSpring(1.0);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    } else if (level === 2) {
      scale.value = withSpring(0.15); // Zoom out para ver las provincias
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };\n```\n### Replacement (Chunk 1)\n```tsx\n  const goToLOD = (level: number) => {
    setCurrentLOD(level);
    animMode.value = withTiming(level, { duration: 500 });
    
    // Solo cambiamos la escala, PERO mantenemos la traslación actual (X,Y) 
    // para que el usuario no sienta que lo teletransportan de regreso al centro.
    if (level === 1) {
      scale.value = withSpring(1.0);
    } else if (level === 2) {
      scale.value = withSpring(0.15);
    }
  };\n```\n### Target (Chunk 2)\n```tsx\n    .onUpdate((e) => {
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const panLimitX = Math.max(0, activeR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, activeR * scale.value - height / 2 + 100);
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
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const panLimitX = Math.max(0, activeR * scale.value - width / 2 + 100);
      const panLimitY = Math.max(0, activeR * scale.value - height / 2 + 100);
      if (translateX.value > panLimitX) translateX.value = withSpring(panLimitX);
      if (translateX.value < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (translateY.value > panLimitY) translateY.value = withSpring(panLimitY);
      if (translateY.value < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Replacement (Chunk 2)\n```tsx\n    .onUpdate((e) => {
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      // Usamos el tamaño más pequeño de la pantalla para igualar los límites X e Y (haciendo el área de exploración un cuadrado perfecto)
      const uniformMargin = Math.min(width, height) / 2; 
      const panLimit = Math.max(0, activeR * scale.value - uniformMargin + 100);
      
      let nextX = savedTranslateX.value + e.translationX;
      let nextY = savedTranslateY.value + e.translationY;

      // Resistencia elástica dura (15%) si se pasa del límite
      if (nextX > panLimit) nextX = panLimit + (nextX - panLimit) * 0.15;
      if (nextX < -panLimit) nextX = -panLimit + (nextX + panLimit) * 0.15;
      if (nextY > panLimit) nextY = panLimit + (nextY - panLimit) * 0.15;
      if (nextY < -panLimit) nextY = -panLimit + (nextY + panLimit) * 0.15;

      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const uniformMargin = Math.min(width, height) / 2;
      const panLimit = Math.max(0, activeR * scale.value - uniformMargin + 100);
      
      if (translateX.value > panLimit) translateX.value = withSpring(panLimit);
      if (translateX.value < -panLimit) translateX.value = withSpring(-panLimit);
      if (translateY.value > panLimit) translateY.value = withSpring(panLimit);
      if (translateY.value < -panLimit) translateY.value = withSpring(-panLimit);
    });\n```\n### Target (Chunk 3)\n```tsx\n      // 2. Limites de paneo basados en la traslación corregida
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const panLimitX = Math.max(0, activeR * finalScale - width / 2 + 100);
      const panLimitY = Math.max(0, activeR * finalScale - height / 2 + 100);
      
      if (finalTranslateX > panLimitX) translateX.value = withSpring(panLimitX);
      if (finalTranslateX < -panLimitX) translateX.value = withSpring(-panLimitX);
      if (finalTranslateY > panLimitY) translateY.value = withSpring(panLimitY);
      if (finalTranslateY < -panLimitY) translateY.value = withSpring(-panLimitY);
    });\n```\n### Replacement (Chunk 3)\n```tsx\n      // 2. Limites de paneo basados en la traslación corregida
      const activeR = animMode.value > 1.5 ? bounds.R : bounds.CitizenR;
      const uniformMargin = Math.min(width, height) / 2;
      const panLimit = Math.max(0, activeR * finalScale - uniformMargin + 100);
      
      if (finalTranslateX > panLimit) translateX.value = withSpring(panLimit);
      if (finalTranslateX < -panLimit) translateX.value = withSpring(-panLimit);
      if (finalTranslateY > panLimit) translateY.value = withSpring(panLimit);
      if (finalTranslateY < -panLimit) translateY.value = withSpring(-panLimit);
    });\n```\n\n---\n\n## Step 2864 - multi_replace_file_content\nInstruction: Fix coordinate displacement on goToLOD scale change\n### Target (Chunk 1)\n```tsx\n  const goToLOD = (level: number) => {
    setCurrentLOD(level);
    animMode.value = withTiming(level, { duration: 500 });
    
    // Solo cambiamos la escala, PERO mantenemos la traslación actual (X,Y) 
    // para que el usuario no sienta que lo teletransportan de regreso al centro.
    if (level === 1) {
      scale.value = withSpring(1.0);
    } else if (level === 2) {
      scale.value = withSpring(0.15);
    }
  };\n```\n### Replacement (Chunk 1)\n```tsx\n  const goToLOD = (level: number) => {
    setCurrentLOD(level);
    animMode.value = withTiming(level, { duration: 500 });
    
    // Al cambiar la escala drásticamente, debemos escalar también la traslación (X,Y)
    // multiplicándola por la diferencia de escala. Si no lo hacemos, la cámara 
    // seguirá mirando el mismo pixel de pantalla pero en una coordenada de grafo totalmente desplazada.
    const currentScale = scale.value;
    let targetScale = currentScale;

    if (level === 1) {
      targetScale = 1.0;
    } else if (level === 2) {
      targetScale = 0.15;
    }

    if (targetScale !== currentScale) {
      const scaleRatio = targetScale / currentScale;
      scale.value = withSpring(targetScale);
      translateX.value = withSpring(translateX.value * scaleRatio);
      translateY.value = withSpring(translateY.value * scaleRatio);
    }
  };\n```\n### Target (Chunk 2)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onViewProfile={() => {
            // Lógica para ver perfil, abrir modal, etc.
          }}
        />
      )}\n```\n### Replacement (Chunk 2)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          node={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {
            // Lógica para ver perfil, abrir modal, etc.
          }}
        />
      )}\n```\n\n---\n\n## Step 2876 - replace_file_content\nInstruction: Fix NodeInfoOverlay prop name\n### Target (Chunk 1)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          node={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {
            // Lógica para ver perfil, abrir modal, etc.
          }}\n```\n### Replacement (Chunk 1)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {
            // Lógica para ver perfil, abrir modal, etc.
          }}\n```\n\n---\n\n## Step 2888 - multi_replace_file_content\nInstruction: Restore text fading based on raw zoom scale in CanvasMap\n### Target (Chunk 1)\n```tsx\ninterface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>;
  font: SkFont;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const NodeLabel = React.memo(({ node, scale, font, activeFocusState, focusTransition }: NodeLabelProps) => {
  const getRadius = (level: number) => {\n```\n### Replacement (Chunk 1)\n```tsx\ninterface NodeLabelProps {
  node: MapNode;
  scale: SharedValue<number>; // This is the animMode
  rawScale: SharedValue<number>; // The actual physical zoom scale
  font: SkFont;
  activeFocusState: SharedValue<{ selected: string | null, connected: Record<string, boolean> }>;
  focusTransition: SharedValue<number>;
}

const NodeLabel = React.memo(({ node, scale, rawScale, font, activeFocusState, focusTransition }: NodeLabelProps) => {
  const getRadius = (level: number) => {\n```\n### Target (Chunk 2)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    // Escala de opacidad basada en el Modo de Vista (animMode) en lugar del zoom crudo
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [0, 1], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [1, 0.15], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;
    
    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
    
    return baseZoomOpacity * focusMultiplier;
  });\n```\n### Replacement (Chunk 2)\n```tsx\n  const finalOpacity = useDerivedValue(() => {
    // 1. Opacidad base por modo de vista (semántico)
    let baseZoomOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [0, 1], Extrapolation.CLAMP);
    } else {
      baseZoomOpacity = interpolate(scale.value, [1, 2], [1, 0.15], Extrapolation.CLAMP);
    }

    if (baseZoomOpacity === 0) return 0;
    
    // 2. Desvanecimiento por zoom out físico (ilegibilidad del texto)
    let textReadabilityOpacity = 1;
    if (node.nodeType === 'PROVINCE') {
      textReadabilityOpacity = interpolate(rawScale.value, [0.03, 0.08], [0, 1], Extrapolation.CLAMP);
    } else {
      textReadabilityOpacity = interpolate(rawScale.value, [0.2, 0.5], [0, 1], Extrapolation.CLAMP);
    }
    
    const state = activeFocusState.value;
    if (!state.selected) return baseZoomOpacity * textReadabilityOpacity;
    
    const isDimmed = state.selected !== node.id && !state.connected[node.id];
    const focusMultiplier = isDimmed ? 1 - (0.85 * focusTransition.value) : 1;
    
    return baseZoomOpacity * textReadabilityOpacity * focusMultiplier;
  });\n```\n### Target (Chunk 3)\n```tsx\n        {/* Textos por encima de los nodos */}
        {nodes.map(node => {
          const font = node.level === 0 ? fontBold : fontNormal;
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={visualScale} 
              font={font}
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}\n```\n### Replacement (Chunk 3)\n```tsx\n        {/* Textos por encima de los nodos */}
        {nodes.map(node => {
          const font = node.level === 0 ? fontBold : fontNormal;
          return (
            <NodeLabel 
              key={`label-${node.id}`} 
              node={node} 
              scale={visualScale} 
              rawScale={scale}
              font={font}
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}\n```\n\n---\n\n## Step 2897 - replace_file_content\nInstruction: Add SkFont to the react-native-skia import\n### Target (Chunk 1)\n```tsx\nimport { Canvas, Circle, Group, Line, vec, DashPathEffect, Text as SkiaText, useFont } from '@shopify/react-native-skia';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { Canvas, Circle, Group, Line, vec, DashPathEffect, Text as SkiaText, useFont, SkFont } from '@shopify/react-native-skia';\n```\n\n---\n\n## Step 3001 - multi_replace_file_content\nInstruction: Add a temporary floating button to test Nostr Relay pool subscription in CanvasMap\n### Target (Chunk 1)\n```tsx\nimport { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';

// Instancia temporal para probar la red
const testAdapter = new NostrAdapter();\n```\n### Target (Chunk 2)\n```tsx\n  const handleNodeSelection = (node: MapNode | null) => {\n```\n### Replacement (Chunk 2)\n```tsx\n  // ======= TEMPORAL: TEST DE RED NOSTR =======
  const handleTestRelays = () => {
    Logger.log('Iniciando prueba de red (Phase 3)...');
    
    // Suscribirse a notas de texto globales (kind: 1)
    const unsub = testAdapter.subscribe([{ kinds: [1], limit: 3 }], (event) => {
      Logger.log(`🔥 [EVENTO NOSTR RECIBIDO] De: ${event.pubkey.substring(0, 8)}... - Contenido: ${event.content.substring(0, 30)}...`);
    });

    // Desconectarse después de 5 segundos
    setTimeout(() => {
      unsub();
      Logger.log('Prueba de red finalizada. Suscripción cerrada.');
    }, 5000);
  };
  // ===========================================

  const handleNodeSelection = (node: MapNode | null) => {\n```\n### Target (Chunk 3)\n```tsx\n    </View>
  );\n```\n### Replacement (Chunk 3)\n```tsx\n      {/* ======= BOTON DE TEST TEMPORAL ======= */}
      <TouchableOpacity 
        style={{ position: 'absolute', top: 50, right: 20, backgroundColor: '#3b82f6', padding: 10, borderRadius: 8 }}
        onPress={handleTestRelays}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Test Relays</Text>
      </TouchableOpacity>
    </View>
  );\n```\n\n---\n\n## Step 3004 - replace_file_content\nInstruction: Remove duplicate Logger import\n### Target (Chunk 1)\n```tsx\nimport { Logger } from '../../infrastructure/telemetry/Logger';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';\n```\n\n---\n\n## Step 3016 - replace_file_content\nInstruction: Add test button inside the main view\n### Target (Chunk 1)\n```tsx\n      )}
    </Animated.View>
  );\n```\n### Replacement (Chunk 1)\n```tsx\n      )}
      {/* ======= BOTON DE TEST TEMPORAL ======= */}
      <TouchableOpacity 
        style={{ position: 'absolute', top: 50, right: 20, backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, zIndex: 100 }}
        onPress={handleTestRelays}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Test Relays</Text>
      </TouchableOpacity>
    </Animated.View>
  );\n```\n\n---\n\n## Step 3022 - multi_replace_file_content\nInstruction: Remove the temporary Test Relays button and its logic from CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\nimport { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';

// Instancia temporal para probar la red
const testAdapter = new NostrAdapter();\n```\n### Replacement (Chunk 1)\n```tsx\nimport { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';\n```\n### Target (Chunk 2)\n```tsx\n  // ======= TEMPORAL: TEST DE RED NOSTR =======
  const handleTestRelays = () => {
    Logger.log('Iniciando prueba de red (Phase 3)...');
    
    // Suscribirse a notas de texto globales (kind: 1)
    const unsub = testAdapter.subscribe([{ kinds: [1], limit: 3 }], (event) => {
      Logger.log(`🔥 [EVENTO NOSTR RECIBIDO] De: ${event.pubkey.substring(0, 8)}... - Contenido: ${event.content.substring(0, 30)}...`);
    });

    // Desconectarse después de 5 segundos
    setTimeout(() => {
      unsub();
      Logger.log('Prueba de red finalizada. Suscripción cerrada.');
    }, 5000);
  };
  // ===========================================

  const handleNodeSelection = (node: MapNode | null) => {\n```\n### Replacement (Chunk 2)\n```tsx\n  const handleNodeSelection = (node: MapNode | null) => {\n```\n### Target (Chunk 3)\n```tsx\n      )}
      {/* ======= BOTON DE TEST TEMPORAL ======= */}
      <TouchableOpacity 
        style={{ position: 'absolute', top: 50, right: 20, backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, zIndex: 100 }}
        onPress={handleTestRelays}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Test Relays</Text>
      </TouchableOpacity>
    </Animated.View>
  );\n```\n### Replacement (Chunk 3)\n```tsx\n      )}
    </Animated.View>
  );\n```\n\n---\n\n## Step 3096 - multi_replace_file_content\nInstruction: Disconnect dummyData and use useAuth in CanvasMap\n### Target (Chunk 1)\n```tsx\nimport { database } from '../../infrastructure/database';
import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { database } from '../../infrastructure/database';
// import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { useAuth } from '../../application/context/AuthContext';\n```\n### Target (Chunk 2)\n```tsx\n  const nodeRadius = getRadius(node.level);
  const displayName = node.localName || node.alias;

  const posX = useSharedValue(node.pos.x);\n```\n### Replacement (Chunk 2)\n```tsx\n  const nodeRadius = getRadius(node.level);
  
  // Strip "Amarata-" prefix for display in canvas
  let displayName = node.localName || node.alias;
  if (displayName?.startsWith('Amarata-')) {
    displayName = displayName.substring(8);
  }

  const posX = useSharedValue(node.pos.x);\n```\n### Target (Chunk 3)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);\n```\n### Replacement (Chunk 3)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const { identity } = useAuth();\n```\n### Target (Chunk 4)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      await injectDummyTopology();
      const topology = await CitizenRepository.getHydratedCitizens();
      setFullTopology(topology);
    };
    fetchTopology();
  }, []);\n```\n### Replacement (Chunk 4)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      // await injectDummyTopology(); // DESCONECTADO (Fase 4)
      const topology = await CitizenRepository.getHydratedCitizens();
      
      // Si la topología está vacía, al menos inyectamos al usuario activo como nodo central
      if (topology.nodes.length === 0 && identity) {
        topology.nodes.push({
          networkData: {
            id: identity.npub,
            alias: identity.alias || 'Yo',
            merit: 0,
            role: 'CITIZEN'
          },
          localData: {
            isFavorite: false,
            localName: identity.alias || 'Yo'
          },
          level: 0,
          nodeType: 'CITIZEN'
        });
      }
      
      setFullTopology(topology);
    };
    fetchTopology();
  }, [identity]);\n```\n\n---\n\n## Step 3120 - replace_file_content\nInstruction: Remove isFavorite\n### Target (Chunk 1)\n```tsx\n          localData: {
            isFavorite: false,
            localName: identity.alias || 'Yo'
          },\n```\n### Replacement (Chunk 1)\n```tsx\n          localData: {
            localName: identity.alias || 'Yo'
          },\n```\n\n---\n\n## Step 3144 - multi_replace_file_content\nInstruction: Add purge logic in CanvasMap.tsx to delete old dummy data from WatermelonDB\n### Target (Chunk 1)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      // await injectDummyTopology(); // DESCONECTADO (Fase 4)
      const topology = await CitizenRepository.getHydratedCitizens();\n```\n### Replacement (Chunk 1)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      // Purgar dummy data residual de la base de datos (Fase 4)
      try {
        await database.write(async () => {
          const citizens = await database.collections.get('citizens').query().fetch();
          const links = await database.collections.get('links').query().fetch();
          
          // Borrar todo lo que no sea el usuario activo
          const toDelete = [
            ...links.map(l => l.prepareDestroyPermanently()),
            ...citizens.filter((c: any) => c.npub !== identity?.npub).map(c => c.prepareDestroyPermanently())
          ];
          
          if (toDelete.length > 0) {
            Logger.log(`Purgando ${toDelete.length} registros de Dummy Data antiguos...`);
            await database.batch(...toDelete);
          }
        });
      } catch (e) {
        console.error("Error purgando dummy data", e);
      }

      // await injectDummyTopology(); // DESCONECTADO (Fase 4)
      const topology = await CitizenRepository.getHydratedCitizens();\n```\n\n---\n\n## Step 3150 - multi_replace_file_content\nInstruction: Remove the purge script from CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      // Purgar dummy data residual de la base de datos (Fase 4)
      try {
        await database.write(async () => {
          const citizens = await database.collections.get('citizens').query().fetch();
          const links = await database.collections.get('links').query().fetch();
          
          // Borrar todo lo que no sea el usuario activo
          const toDelete = [
            ...links.map(l => l.prepareDestroyPermanently()),
            ...citizens.filter((c: any) => c.npub !== identity?.npub).map(c => c.prepareDestroyPermanently())
          ];
          
          if (toDelete.length > 0) {
            Logger.log(`Purgando ${toDelete.length} registros de Dummy Data antiguos...`);
            await database.batch(...toDelete);
          }
        });
      } catch (e) {
        console.error("Error purgando dummy data", e);
      }

      // await injectDummyTopology(); // DESCONECTADO (Fase 4)
      const topology = await CitizenRepository.getHydratedCitizens();\n```\n### Replacement (Chunk 1)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {
    const fetchTopology = async () => {
      // await injectDummyTopology(); // DESCONECTADO (Fase 4)
      const topology = await CitizenRepository.getHydratedCitizens();\n```\n\n---\n\n## Step 3157 - multi_replace_file_content\nInstruction: Remove node limit slider from CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\n  // Límite de nodos a inyectar en las físicas (TESTING)
  const [nodeLimit, setNodeLimit] = useState(300);
  const [sliderVal, setSliderVal] = useState(300);

  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);\n```\n### Replacement (Chunk 1)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);\n```\n### Target (Chunk 2)\n```tsx\n      // Filtramos para asegurar que las Provincias y Causas NUNCA sean recortadas por el Slider (nodeLimit)
      const citizenNodes = Array.from(nodeMap.values()).filter(n => n.nodeType === 'CITIZEN').slice(0, nodeLimit);\n```\n### Replacement (Chunk 2)\n```tsx\n      // Ahora incluimos todos los nodos ciudadanos (que en producción vendrán poco a poco desde el indexador)
      const citizenNodes = Array.from(nodeMap.values()).filter(n => n.nodeType === 'CITIZEN');\n```\n### Target (Chunk 3)\n```tsx\n      {/* Controles de Testing Físicas (Slider) */}
      <View style={{
        position: 'absolute',
        bottom: 50,
        left: 20,
        width: 250,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
      }}>
        <Text style={{ color: 'white', marginBottom: 10, fontSize: 12, fontWeight: '600' }}>
          Ciudadanos (Físicas Activas): {sliderVal}
        </Text>
        {/* Slider nativo temporal simulado con botones */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[50, 150, 300, 500].map(val => (
            <TouchableOpacity 
              key={val}
              onPress={() => { setSliderVal(val); setNodeLimit(val); }}
              style={{ flex: 1, backgroundColor: nodeLimit === val ? '#3b82f6' : '#334155', padding: 5, borderRadius: 5, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontSize: 10 }}>{val}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>\n```\n### Replacement (Chunk 3)\n```tsx\n\n```\n\n---\n\n## Step 3165 - replace_file_content\nInstruction: Remove stray UI elements\n### Target (Chunk 1)\n```tsx\n        <Text style={{ color: '#aaa', fontSize: 10, marginTop: 5 }}>Desliza para ajustar</Text>
      </View>\n```\n### Replacement (Chunk 1)\n```tsx\n\n```\n\n---\n\n## Step 3177 - multi_replace_file_content\nInstruction: Log NPUB so user can copy it\n### Target (Chunk 1)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const { identity } = useAuth();\n```\n### Replacement (Chunk 1)\n```tsx\n  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const { identity } = useAuth();

  useEffect(() => {
    if (identity) {
      console.log('\n\n=== 👑 TU IDENTIDAD SOBERANA ===\nCopia esto para buscar en Primal.net:\n\n' + identity.npub + '\n\n================================\n');
    }
  }, [identity]);\n```\n\n---\n\n## Step 3235 - multi_replace_file_content\nInstruction: Add navigation props and route to CanvasMap\n### Target (Chunk 1)\n```tsx\nimport React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, Circle, Group, Line, useFont, Text as SkiaText, DashPathEffect } from '@shopify/react-native-skia';
import { Dimensions, View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useAnimatedReaction, runOnJS, withTiming, Easing, interpolate, Extrapolation, useDerivedValue } from 'react-native-reanimated';
import { TouchableOpacity, Pressable } from 'react-native';
import { database } from '../../infrastructure/database';
// import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { useAuth } from '../../application/context/AuthContext';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { Dimensions, View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useAnimatedReaction, runOnJS, withTiming, Easing, interpolate, Extrapolation, useDerivedValue } from 'react-native-reanimated';
import { TouchableOpacity, Pressable, Alert } from 'react-native';
import { database } from '../../infrastructure/database';
// import { injectDummyTopology } from '../../infrastructure/database/dummyData';
import { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { QRGenerator } from './QRGenerator';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { useAuth } from '../../application/context/AuthContext';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';\n```\n### Target (Chunk 2)\n```tsx\n
export const CanvasMap = () => {
  // Inicialización de la fuente nativa\n```\n### Replacement (Chunk 2)\n```tsx\ntype Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainApp'>;
  route: RouteProp<RootStackParamList, 'MainApp'>;
};

export const CanvasMap = ({ navigation, route }: Props) => {
  // Inicialización de la fuente nativa\n```\n### Target (Chunk 3)\n```tsx\n  const { identity } = useAuth();

  useEffect(() => {
    if (identity) {\n```\n### Replacement (Chunk 3)\n```tsx\n  const { identity } = useAuth();
  
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (identity) {\n```\n### Target (Chunk 4)\n```tsx\n  // 1. Cargar datos una sola vez
  useEffect(() => {\n```\n### Replacement (Chunk 4)\n```tsx\n  // Procesar nuevo ciudadano escaneado
  useEffect(() => {
    if (route.params?.addCitizen && identity) {
      const newNpub = route.params.addCitizen;
      const addContact = async () => {
        try {
          await database.write(async () => {
            const citizens = database.collections.get('citizens');
            const links = database.collections.get('links');
            
            // Check if exists
            const existing = await citizens.query().fetch();
            const exists = existing.find((c: any) => c.npub === newNpub);
            
            let citId = newNpub;
            if (!exists) {
              await citizens.create((citizen: any) => {
                citizen.npub = newNpub;
                citizen.role = 'CITIZEN';
                citizen.merit = 0;
                citizen.alias = `Amarata-${newNpub.substring(5, 9).toUpperCase()}`;
              });
            }
            
            // Add link
            await links.create((link: any) => {
              link.sourceId = identity.npub;
              link.targetId = citId;
              link.level = 1; // Nivel 1 (Direct Trust)
            });
          });
          
          Alert.alert("Ciudadano Agregado", "Se ha añadido exitosamente a tu red de confianza (Nivel 1).");
          
          // Recargar la topología
          const topology = await CitizenRepository.getHydratedCitizens();
          if (topology.nodes.length === 0 && identity) {
            topology.nodes.push({
              networkData: { id: identity.npub, alias: identity.alias || 'Yo', merit: 0, role: 'CITIZEN' },
              localData: { isFavorite: false, localName: identity.alias || 'Yo' },
              level: 0, nodeType: 'CITIZEN'
            });
          }
          setFullTopology(topology);
          
        } catch (e) {
          console.error("Error agregando ciudadano", e);
        }
      };
      addContact();
    }
  }, [route.params?.addCitizen]);

  // 1. Cargar datos una sola vez
  useEffect(() => {\n```\n### Target (Chunk 5)\n```tsx\n    </Animated.View>
  );
};\n```\n### Replacement (Chunk 5)\n```tsx\n      {/* Controles Flotantes para QR */}
      <View style={{ position: 'absolute', top: 60, right: 20, gap: 10, zIndex: 999 }}>
        <TouchableOpacity 
          style={{ backgroundColor: '#0ea5e9', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 }}
          onPress={() => setShowQR(true)}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>🎫 Mi QR</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ backgroundColor: '#f43f5e', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 }}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>📷 Escanear</Text>
        </TouchableOpacity>
      </View>

      {showQR && identity && (
        <QRGenerator 
          value={identity.npub} 
          alias={identity.alias || ''} 
          onClose={() => setShowQR(false)} 
        />
      )}

    </Animated.View>
  );
};\n```\n\n---\n\n## Step 3241 - replace_file_content\nInstruction: Remove CanvasMapProps\n### Target (Chunk 1)\n```tsx\ninterface CanvasMapProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CanvasMap'>;
  route: RouteProp<RootStackParamList, 'CanvasMap'>;
}
\n```\n### Replacement (Chunk 1)\n```tsx\n\n```\n\n---\n\n## Step 3253 - multi_replace_file_content\nInstruction: Remove isFavorite property\n### Target (Chunk 1)\n```tsx\n              localData: { isFavorite: false, localName: identity.alias || 'Yo' },\n```\n### Replacement (Chunk 1)\n```tsx\n              localData: { localName: identity.alias || 'Yo' },\n```\n\n---\n\n## Step 3359 - multi_replace_file_content\nInstruction: Fix relation setting for trust_links\n### Target (Chunk 1)\n```tsx\n            const citizens = database.collections.get('citizens');
            const links = database.collections.get('links');
            
            // Check if exists
            const existing = await citizens.query().fetch();
            const exists = existing.find((c: any) => c.npub === newNpub);
            
            let citId = newNpub;
            if (!exists) {
              await citizens.create((citizen: any) => {
                citizen.npub = newNpub;
                citizen.role = 'CITIZEN';
                citizen.merit = 0;
                citizen.alias = `Amarata-${newNpub.substring(5, 9).toUpperCase()}`;
              });
            }
            
            // Add link
            await links.create((link: any) => {
              link.sourceId = identity.npub;
              link.targetId = citId;
              link.level = 1; // Nivel 1 (Direct Trust)
            });\n```\n### Replacement (Chunk 1)\n```tsx\n            const citizens = database.collections.get('citizens');
            const links = database.collections.get('trust_links');
            
            // Check if exists
            const existing = await citizens.query().fetch();
            let scannedCitizen = existing.find((c: any) => c.npub === newNpub);
            
            if (!scannedCitizen) {
              scannedCitizen = await citizens.create((citizen: any) => {
                citizen.npub = newNpub;
                citizen.role = 'CITIZEN';
                citizen.merit = 0;
                citizen.alias = `Amarata-${newNpub.substring(5, 9).toUpperCase()}`;
              });
            }
            
            const me = existing.find((c: any) => c.npub === identity.npub);
            if (!me) throw new Error("Mi usuario no existe en la base de datos");

            // Add link
            await links.create((link: any) => {
              link.fromCitizen.set(me);
              link.toCitizen.set(scannedCitizen);
              link.level = 1; // Nivel 1 (Direct Trust)
            });\n```\n\n---\n\n## Step 3395 - replace_file_content\nInstruction: Update QRGenerator props in CanvasMap\n### Target (Chunk 1)\n```tsx\n      {showQR && identity && (
        <QRGenerator 
          value={identity.npub} 
          alias={identity.alias || ''} 
          onClose={() => setShowQR(false)} 
        />
      )}\n```\n### Replacement (Chunk 1)\n```tsx\n      {showQR && identity && (
        <QRGenerator 
          identity={identity} 
          onClose={() => setShowQR(false)} 
        />
      )}\n```\n\n---\n\n## Step 3546 - multi_replace_file_content\nInstruction: Replace Floating QR controls with FloatingDock in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\nimport { NodeInfoOverlay } from './NodeInfoOverlay';
import { QRGenerator } from './QRGenerator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { NodeInfoOverlay } from './NodeInfoOverlay';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Target (Chunk 2)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {
            // Lógica para ver perfil, abrir modal, etc.
          }}
          onUpdateLocalName={(newName) => {
            // Actualizar el estado local para reflejar el cambio instantáneamente en el mapa
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
        />
      )}
      {/* Controles Flotantes para QR */}
      <View style={{ position: 'absolute', top: 60, right: 20, gap: 10, zIndex: 999 }}>
        <TouchableOpacity 
          style={{ backgroundColor: '#0ea5e9', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 }}
          onPress={() => setShowQR(true)}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>🎫 Mi QR</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ backgroundColor: '#f43f5e', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 }}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>📷 Escanear</Text>
        </TouchableOpacity>
      </View>

      {showQR && identity && (\n```\n### Replacement (Chunk 2)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {}}
          onUpdateLocalName={(newName) => {
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
        />
      )}

      {/* Dock Inferior */}
      <FloatingDock
        onAddPress={() => {
          // TODO: Abrir BottomSheet con opciones de creación
          console.log('Abrir BottomSheet de Creación');
        }}
        onMessagePress={() => console.log('Mensajes')}
        onMarketPress={() => console.log('Mercado')}
        onVotePress={() => console.log('Votaciones')}
        onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
      />

      {showQR && identity && (\n```\n\n---\n\n## Step 3576 - multi_replace_file_content\nInstruction: Hide Dock on selectedNode and adjust LOD controls height\n### Target (Chunk 1)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 190 : 40, { duration: 300 })
    };
  });\n```\n### Replacement (Chunk 1)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 240 : 120, { duration: 300 })
    };
  });\n```\n### Target (Chunk 2)\n```tsx\n      {/* Dock Inferior */}
      <FloatingDock
        onAddPress={() => {
          // TODO: Abrir BottomSheet con opciones de creación
          console.log('Abrir BottomSheet de Creación');
        }}
        onMessagePress={() => console.log('Mensajes')}
        onMarketPress={() => console.log('Mercado')}
        onVotePress={() => console.log('Votaciones')}
        onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
      />\n```\n### Replacement (Chunk 2)\n```tsx\n      {/* Dock Inferior - Se oculta si hay un nodo seleccionado para no colisionar con el NodeInfoOverlay */}
      {!selectedNode && (
        <FloatingDock
          onAddPress={() => {
            // TODO: Abrir BottomSheet con opciones de creación
            console.log('Abrir BottomSheet de Creación');
          }}
          onMessagePress={() => console.log('Mensajes')}
          onMarketPress={() => console.log('Mercado')}
          onVotePress={() => console.log('Votaciones')}
          onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
        />
      )}\n```\n\n---\n\n## Step 3585 - multi_replace_file_content\nInstruction: Add BottomSheet and create menu in CanvasMap.tsx\n### Target (Chunk 1)\n```tsx\nimport { NodeInfoOverlay } from './NodeInfoOverlay';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { NodeInfoOverlay } from './NodeInfoOverlay';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Target (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);\n```\n### Replacement (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);

  // BottomSheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '50%'], []);\n```\n### Target (Chunk 3)\n```tsx\n    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {\n```\n### Replacement (Chunk 3)\n```tsx\n      {/* Bottom Sheet de Creación */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#1e293b' }}
        handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
        )}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>Crear</Text>
          
          <TouchableOpacity 
            style={styles.sheetButton}
            onPress={() => {
              bottomSheetRef.current?.close();
              navigation.navigate('Scanner'); // Reutilizamos Scanner para Ciudadanos
            }}
          >
            <Text style={styles.sheetButtonIcon}>👤</Text>
            <View>
              <Text style={styles.sheetButtonText}>Acreditar Ciudadano</Text>
              <Text style={styles.sheetButtonSub}>Agregar a tu Nivel 1</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sheetButton}
            onPress={() => {
              bottomSheetRef.current?.close();
              // TODO: Navegar a pantalla de Crear Provincia
              console.log('Navegar a Crear Provincia');
            }}
          >
            <Text style={styles.sheetButtonIcon}>🏛️</Text>
            <View>
              <Text style={styles.sheetButtonText}>Fundar Provincia</Text>
              <Text style={styles.sheetButtonSub}>Crear un grupo (Requiere 3 firmas)</Text>
            </View>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1e293b',
  },
  sheetTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  sheetButtonIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  sheetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sheetButtonSub: {
    color: '#94a3b8',
    fontSize: 14,
  },
  container: {\n```\n### Target (Chunk 4)\n```tsx\n      {/* Dock Inferior - Se oculta si hay un nodo seleccionado para no colisionar con el NodeInfoOverlay */}
      {!selectedNode && (
        <FloatingDock
          onAddPress={() => {
            // TODO: Abrir BottomSheet con opciones de creación
            console.log('Abrir BottomSheet de Creación');
          }}
          onMessagePress={() => console.log('Mensajes')}
          onMarketPress={() => console.log('Mercado')}
          onVotePress={() => console.log('Votaciones')}
          onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
        />
      )}\n```\n### Replacement (Chunk 4)\n```tsx\n      {/* Dock Inferior - Se oculta si hay un nodo seleccionado para no colisionar con el NodeInfoOverlay */}
      {!selectedNode && (
        <FloatingDock
          onAddPress={() => {
            bottomSheetRef.current?.expand();
          }}
          onMessagePress={() => console.log('Mensajes')}
          onMarketPress={() => console.log('Mercado')}
          onVotePress={() => console.log('Votaciones')}
          onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
        />
      )}\n```\n\n---\n\n## Step 3591 - multi_replace_file_content\nInstruction: Import useRef and useMemo from React\n### Target (Chunk 1)\n```tsx\nimport React, { useEffect, useState, useCallback } from 'react';\n```\n### Replacement (Chunk 1)\n```tsx\nimport React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';\n```\n\n---\n\n## Step 3606 - multi_replace_file_content\nInstruction: Remove gorhom/bottom-sheet from CanvasMap and use ActionMenuOverlay\n### Target (Chunk 1)\n```tsx\nimport { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { useAuth } from '../../application/context/AuthContext';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ActionMenuOverlay } from './ActionMenuOverlay';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Target (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);

  // BottomSheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '50%'], []);\n```\n### Replacement (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);\n```\n### Target (Chunk 3)\n```tsx\n      {/* Dock Inferior - Se oculta si hay un nodo seleccionado para no colisionar con el NodeInfoOverlay */}
      {!selectedNode && (
        <FloatingDock
          onAddPress={() => {
            bottomSheetRef.current?.expand();
          }}
          onMessagePress={() => console.log('Mensajes')}\n```\n### Replacement (Chunk 3)\n```tsx\n      {/* Dock Inferior - Se oculta si hay un nodo seleccionado o si el menú está abierto */}
      {!selectedNode && !showActionMenu && (
        <FloatingDock
          onAddPress={() => setShowActionMenu(true)}
          onMessagePress={() => console.log('Mensajes')}\n```\n### Target (Chunk 4)\n```tsx\n      {/* Bottom Sheet de Creación */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#1e293b' }}
        handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
        )}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>Crear</Text>
          
          <TouchableOpacity 
            style={styles.sheetButton}
            onPress={() => {
              bottomSheetRef.current?.close();
              navigation.navigate('Scanner'); // Reutilizamos Scanner para Ciudadanos
            }}
          >
            <Text style={styles.sheetButtonIcon}>👤</Text>
            <View>
              <Text style={styles.sheetButtonText}>Acreditar Ciudadano</Text>
              <Text style={styles.sheetButtonSub}>Agregar a tu Nivel 1</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sheetButton}
            onPress={() => {
              bottomSheetRef.current?.close();
              // TODO: Navegar a pantalla de Crear Provincia
              console.log('Navegar a Crear Provincia');
            }}
          >
            <Text style={styles.sheetButtonIcon}>🏛️</Text>
            <View>
              <Text style={styles.sheetButtonText}>Fundar Provincia</Text>
              <Text style={styles.sheetButtonSub}>Crear un grupo (Requiere 3 firmas)</Text>
            </View>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1e293b',
  },
  sheetTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  sheetButtonIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  sheetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sheetButtonSub: {
    color: '#94a3b8',
    fontSize: 14,
  },
  container: {\n```\n### Replacement (Chunk 4)\n```tsx\n      {showActionMenu && (
        <ActionMenuOverlay 
          onClose={() => setShowActionMenu(false)}
          onScanCitizen={() => {
            setShowActionMenu(false);
            navigation.navigate('Scanner');
          }}
          onCreateProvince={() => {
            setShowActionMenu(false);
            console.log('Navegar a Crear Provincia');
          }}
        />
      )}

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {\n```\n\n---\n\n## Step 3621 - multi_replace_file_content\nInstruction: Restore missing imports and remove duplicate NativeStackNavigationProp\n### Target (Chunk 1)\n```tsx\nimport { ActionMenuOverlay } from './ActionMenuOverlay';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { ActionMenuOverlay } from './ActionMenuOverlay';
import { NostrAdapter } from '../../infrastructure/network/NostrAdapter';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';
import { useAuth } from '../../application/context/AuthContext';\n```\n\n---\n\n## Step 3627 - multi_replace_file_content\nInstruction: Redesign LOD navigator to a top-center horizontal pill (Segmented Control) for better mobile UX and to fix bottom overlaps.\n### Target (Chunk 1)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 240 : 120, { duration: 300 })
    };
  });\n```\n### Replacement (Chunk 1)\n```tsx\n  // El LOD Navigator ahora está en la parte superior, no necesita ajustarse al Dock.\n```\n### Target (Chunk 2)\n```tsx\n      {/* Navegación Semántica (Controles LOD) */}
      <Animated.View style={[styles.lodControlsContainer, lodControlsStyle]}>
        {[
          { level: 3, label: 'Causas' },
          { level: 2, label: 'Provincias' },
          { level: 1, label: 'Ciudadanos' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <View key={item.level} style={styles.lodItem}>
              {isActive && (
                <Text style={styles.lodLabel}>{item.label}</Text>
              )}
              <Pressable 
                onPress={() => goToLOD(item.level)}
                style={[
                  styles.lodButton,
                  isActive && styles.lodButtonActive
                ]}
              />
            </View>
          );
        })}
      </Animated.View>\n```\n### Replacement (Chunk 2)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Diseño Móvil Segmentado */}
      <View style={styles.lodControlsContainer}>
        {[
          { level: 1, label: 'Ciudadanos', icon: '👤' },
          { level: 2, label: 'Provincias', icon: '🏛️' },
          { level: 3, label: 'Causas', icon: '⚖️' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <Pressable 
              key={item.level}
              onPress={() => goToLOD(item.level)}
              style={[
                styles.lodSegment,
                isActive && styles.lodSegmentActive
              ]}
            >
              <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
              {isActive && (
                <Text style={styles.lodSegmentText}>{item.label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>\n```\n### Target (Chunk 3)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 15,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lodLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lodButton: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  lodButtonActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },\n```\n### Replacement (Chunk 3)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  lodSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  lodSegmentActive: {
    backgroundColor: '#3b82f6', // Azul para el nivel activo
  },
  lodSegmentIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  lodSegmentText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },\n```\n\n---\n\n## Step 3633 - multi_replace_file_content\nInstruction: Change LOD navigator from horizontal top-center to vertical center-right.\n### Target (Chunk 1)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Diseño Móvil Segmentado */}
      <View style={styles.lodControlsContainer}>
        {[
          { level: 1, label: 'Ciudadanos', icon: '👤' },
          { level: 2, label: 'Provincias', icon: '🏛️' },
          { level: 3, label: 'Causas', icon: '⚖️' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <Pressable 
              key={item.level}
              onPress={() => goToLOD(item.level)}
              style={[
                styles.lodSegment,
                isActive && styles.lodSegmentActive
              ]}
            >
              <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
              {isActive && (
                <Text style={styles.lodSegmentText}>{item.label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>\n```\n### Replacement (Chunk 1)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Columna Lateral */}
      <View style={styles.lodControlsContainer}>
        {[
          { level: 1, label: 'Ciudadanos', icon: '👤' },
          { level: 2, label: 'Provincias', icon: '🏛️' },
          { level: 3, label: 'Causas', icon: '⚖️' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <Pressable 
              key={item.level}
              onPress={() => goToLOD(item.level)}
              style={[
                styles.lodSegment,
                isActive && styles.lodSegmentActive
              ]}
            >
              <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
            </Pressable>
          );
        })}
      </View>\n```\n### Target (Chunk 2)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  lodSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  lodSegmentActive: {
    backgroundColor: '#3b82f6', // Azul para el nivel activo
  },
  lodSegmentIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  lodSegmentText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },\n```\n### Replacement (Chunk 2)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    top: height / 2 - 100, // Centrado verticalmente a la derecha
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },
  lodSegment: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  lodSegmentActive: {
    backgroundColor: '#3b82f6', // Azul para el nivel activo
  },
  lodSegmentIcon: {
    fontSize: 24, // Iconos mucho más grandes para el pulgar
    opacity: 0.6,
  },\n```\n\n---\n\n## Step 3639 - multi_replace_file_content\nInstruction: Make the LOD navigator dynamically anchor to the bottom right above the Dock/Overlay\n### Target (Chunk 1)\n```tsx\n  // El LOD Navigator ahora está en la parte superior, no necesita ajustarse al Dock.\n```\n### Replacement (Chunk 1)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 240 : 120, { duration: 300 })
    };
  });\n```\n### Target (Chunk 2)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Columna Lateral */}
      <View style={styles.lodControlsContainer}>\n```\n### Replacement (Chunk 2)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Columna Lateral Dinámica */}
      <Animated.View style={[styles.lodControlsContainer, lodControlsStyle]}>\n```\n### Target (Chunk 3)\n```tsx\n        })}
      </View>\n```\n### Replacement (Chunk 3)\n```tsx\n        })}
      </Animated.View>\n```\n### Target (Chunk 4)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    top: height / 2 - 100, // Centrado verticalmente a la derecha
    flexDirection: 'column',\n```\n### Replacement (Chunk 4)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'column',\n```\n\n---\n\n## Step 3654 - multi_replace_file_content\nInstruction: Add dynamic bottom height calculation for LOD navigator\n### Target (Chunk 1)\n```tsx\nimport { useAuth } from '../../application/context/AuthContext';

const { width, height } = Dimensions.get('window');\n```\n### Replacement (Chunk 1)\n```tsx\nimport { useAuth } from '../../application/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');\n```\n### Target (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);\n```\n### Replacement (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(120);
  const insets = useSafeAreaInsets();\n```\n### Target (Chunk 3)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(selectedNode ? 240 : 120, { duration: 300 })
    };
  });

  if (isLoading || !fontNormal || !fontBold) {\n```\n### Replacement (Chunk 3)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(bottomHeight + 10, { duration: 300 })
    };
  });

  if (isLoading || !fontNormal || !fontBold) {\n```\n### Target (Chunk 4)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {}}
          onUpdateLocalName={(newName) => {
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
        />
      )}

      {/* Dock Inferior - Se oculta si hay un nodo seleccionado o si el menú está abierto */}
      {!selectedNode && !showActionMenu && (
        <FloatingDock
          onAddPress={() => setShowActionMenu(true)}\n```\n### Replacement (Chunk 4)\n```tsx\n      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {}}
          onUpdateLocalName={(newName) => {
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
          onLayout={(e) => {
            // El overlay tiene un paddingBottom de Math.max(insets.bottom, 40) + 20
            setBottomHeight(e.nativeEvent.layout.height + Math.max(insets.bottom, 40) + 20);
          }}
        />
      )}

      {/* Dock Inferior - Se oculta si hay un nodo seleccionado o si el menú está abierto */}
      {!selectedNode && !showActionMenu && (
        <FloatingDock
          onLayout={(e) => {
            // El dock tiene un bottom de 30
            setBottomHeight(e.nativeEvent.layout.height + 30);
          }}
          onAddPress={() => setShowActionMenu(true)}\n```\n### Target (Chunk 5)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    top: height / 2 - 100, // Centrado verticalmente a la derecha
    flexDirection: 'column',\n```\n### Replacement (Chunk 5)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'column',\n```\n\n---\n\n## Step 3669 - multi_replace_file_content\nInstruction: Refactor CanvasMap to use a unified flex Bottom HUD wrapper\n### Target (Chunk 1)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(120);
  const insets = useSafeAreaInsets();\n```\n### Replacement (Chunk 1)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const insets = useSafeAreaInsets();\n```\n### Target (Chunk 2)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(bottomHeight + 10, { duration: 300 })
    };
  });

  if (isLoading || !fontNormal || !fontBold) {\n```\n### Replacement (Chunk 2)\n```tsx\n  if (isLoading || !fontNormal || !fontBold) {\n```\n### Target (Chunk 3)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Columna Lateral Dinámica */}
      <Animated.View style={[styles.lodControlsContainer, lodControlsStyle]}>
        {[
          { level: 1, label: 'Ciudadanos', icon: '👤' },
          { level: 2, label: 'Provincias', icon: '🏛️' },
          { level: 3, label: 'Causas', icon: '⚖️' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <Pressable 
              key={item.level}
              onPress={() => goToLOD(item.level)}
              style={[
                styles.lodSegment,
                isActive && styles.lodSegmentActive
              ]}
            >
              <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={() => handleNodeSelection(null)}
          onViewProfile={() => {}}
          onUpdateLocalName={(newName) => {
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
          onLayout={(e) => {
            // El overlay tiene un paddingBottom de Math.max(insets.bottom, 40) + 20
            setBottomHeight(e.nativeEvent.layout.height + Math.max(insets.bottom, 40) + 20);
          }}
        />
      )}

      {/* Dock Inferior - Se oculta si hay un nodo seleccionado o si el menú está abierto */}
      {!selectedNode && !showActionMenu && (
        <FloatingDock
          onLayout={(e) => {
            // El dock tiene un bottom de 30
            setBottomHeight(e.nativeEvent.layout.height + 30);
          }}
          onAddPress={() => setShowActionMenu(true)}
          onMessagePress={() => console.log('Mensajes')}
          onMarketPress={() => console.log('Mercado')}
          onVotePress={() => console.log('Votaciones')}
          onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
        />
      )}

      {showActionMenu && (
        <ActionMenuOverlay 
          onClose={() => setShowActionMenu(false)}
          onScanCitizen={() => {
            setShowActionMenu(false);
            navigation.navigate('Scanner');
          }}
          onCreateProvince={() => {
            setShowActionMenu(false);
            console.log('Navegar a Crear Provincia');
          }}
        />
      )}\n```\n### Replacement (Chunk 3)\n```tsx\n      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View 
        style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}
      >
        
        {/* Navegador de Niveles (LOD) alineado a la derecha, descansando siempre sobre el panel activo */}
        <View style={{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 1, label: 'Ciudadanos', icon: '👤' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 3, label: 'Causas', icon: '⚖️' },
            ].map((item) => {
              const isActive = currentLOD === item.level;
              return (
                <Pressable 
                  key={item.level}
                  onPress={() => goToLOD(item.level)}
                  style={[
                    styles.lodSegment,
                    isActive && styles.lodSegmentActive
                  ]}
                >
                  <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          {selectedNode && (
            <NodeInfoOverlay 
              citizen={selectedNode}
              onClose={() => handleNodeSelection(null)}
              onViewProfile={() => {}}
              onUpdateLocalName={(newName) => {
                setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                setSelectedNode({ ...selectedNode, localName: newName });
              }}
            />
          )}

          {!selectedNode && !showActionMenu && (
            <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
              <FloatingDock
                onAddPress={() => setShowActionMenu(true)}
                onMessagePress={() => console.log('Mensajes')}
                onMarketPress={() => console.log('Mercado')}
                onVotePress={() => console.log('Votaciones')}
                onProfilePress={() => setShowQR(true)} 
              />
            </View>
          )}

          {showActionMenu && (
            <ActionMenuOverlay 
              onClose={() => setShowActionMenu(false)}
              onScanCitizen={() => {
                setShowActionMenu(false);
                navigation.navigate('Scanner');
              }}
              onCreateProvince={() => {
                setShowActionMenu(false);
                console.log('Navegar a Crear Provincia');
              }}
            />
          )}
        </View>
      </View>\n```\n### Target (Chunk 4)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },\n```\n### Replacement (Chunk 4)\n```tsx\n  lodControlsContainer: {
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },\n```\n\n---\n\n## Step 3681 - multi_replace_file_content\nInstruction: Invert LOD array and add absolute backdrop to close ActionMenu\n### Target (Chunk 1)\n```tsx\n      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View 
        style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}
      >
        
        {/* Navegador de Niveles (LOD) alineado a la derecha, descansando siempre sobre el panel activo */}\n```\n### Replacement (Chunk 1)\n```tsx\n      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View 
        style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}
      >
        {/* Fondo oscuro para cerrar paneles (ActionMenu o Perfil) al tocar fuera */}
        {(showActionMenu || selectedNode) && (
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
            onPress={() => {
              if (showActionMenu) setShowActionMenu(false);
              if (selectedNode) handleNodeSelection(null);
            }} 
          />
        )}
        
        {/* Navegador de Niveles (LOD) alineado a la derecha, descansando siempre sobre el panel activo */}\n```\n### Target (Chunk 2)\n```tsx\n          <View style={styles.lodControlsContainer}>
            {[
              { level: 1, label: 'Ciudadanos', icon: '👤' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 3, label: 'Causas', icon: '⚖️' },
            ].map((item) => {\n```\n### Replacement (Chunk 2)\n```tsx\n          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 1, label: 'Ciudadanos', icon: '👤' },
            ].map((item) => {\n```\n\n---\n\n## Step 3693 - multi_replace_file_content\nInstruction: Add panelTranslateY shared value, pass to components, and use for LOD navigator\n### Target (Chunk 1)\n```tsx\nimport { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation, useAnimatedReaction, interpolateColor, Easing } from 'react-native-reanimated';\n```\n### Replacement (Chunk 1)\n```tsx\nimport Animated, { useSharedValue, runOnJS, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Target (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {\n```\n### Replacement (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const insets = useSafeAreaInsets();
  
  const panelTranslateY = useSharedValue(500);

  const openActionMenu = () => {
    setShowActionMenu(true);
    panelTranslateY.value = 500;
    panelTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
  };

  const closePanels = () => {
    panelTranslateY.value = withTiming(500, { duration: 250 }, () => {
      runOnJS(setShowActionMenu)(false);
      runOnJS(handleNodeSelection)(null);
    });
  };

  const handleNodePress = useCallback((node: MapNode) => {
    if (selectedNode?.id === node.id) {
      closePanels();
    } else {
      setSelectedNode(node);
      panelTranslateY.value = 500;
      panelTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
  }, [selectedNode, panelTranslateY]);\n```\n### Target (Chunk 3)\n```tsx\n      {
        onPress: () => {
          if (selectedNode?.id === node.id) {
            handleNodeSelection(null);
          } else {
            handleNodeSelection(node);
          }
        }
      },\n```\n### Replacement (Chunk 3)\n```tsx\n      {
        onPress: () => handleNodePress(node)
      },\n```\n### Target (Chunk 4)\n```tsx\n  if (isLoading || !fontNormal || !fontBold) {\n```\n### Replacement (Chunk 4)\n```tsx\n  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: (showActionMenu || selectedNode) ? panelTranslateY.value : 0 }]
    };
  });

  if (isLoading || !fontNormal || !fontBold) {\n```\n### Target (Chunk 5)\n```tsx\n        {/* Fondo oscuro para cerrar paneles (ActionMenu o Perfil) al tocar fuera */}
        {(showActionMenu || selectedNode) && (
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
            onPress={() => {
              if (showActionMenu) setShowActionMenu(false);
              if (selectedNode) handleNodeSelection(null);
            }} 
          />
        )}
        
        {/* Navegador de Niveles (LOD) alineado a la derecha, descansando siempre sobre el panel activo */}
        <View style={{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }}>\n```\n### Replacement (Chunk 5)\n```tsx\n        {/* Fondo oscuro para cerrar paneles (ActionMenu o Perfil) al tocar fuera */}
        {(showActionMenu || selectedNode) && (
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
            onPress={closePanels} 
          />
        )}
        
        {/* Navegador de Niveles (LOD) alineado a la derecha, descansando siempre sobre el panel activo */}
        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>\n```\n### Target (Chunk 6)\n```tsx\n                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          {selectedNode && (
            <NodeInfoOverlay 
              citizen={selectedNode}
              onClose={() => handleNodeSelection(null)}
              onViewProfile={() => {}}
              onUpdateLocalName={(newName) => {
                setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                setSelectedNode({ ...selectedNode, localName: newName });
              }}
            />
          )}

          {!selectedNode && !showActionMenu && (
            <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
              <FloatingDock
                onAddPress={() => setShowActionMenu(true)}\n```\n### Replacement (Chunk 6)\n```tsx\n            </Pressable>
          );
        })}
      </View>
    </Animated.View>

    {/* Panel Activo */}
    <View style={{ width: '100%', pointerEvents: 'box-none' }}>
      {selectedNode && (
        <NodeInfoOverlay 
          citizen={selectedNode}
          onClose={closePanels}
          onViewProfile={() => {}}
          onUpdateLocalName={(newName) => {
            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
            setSelectedNode({ ...selectedNode, localName: newName });
          }}
          panelTranslateY={panelTranslateY}
        />
      )}

      {!selectedNode && !showActionMenu && (
        <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
          <FloatingDock
            onAddPress={openActionMenu}\n```\n### Target (Chunk 7)\n```tsx\n          )}

          {showActionMenu && (
            <ActionMenuOverlay 
              onClose={() => setShowActionMenu(false)}
              onScanCitizen={() => {
                setShowActionMenu(false);
                navigation.navigate('Scanner');
              }}
              onCreateProvince={() => {
                setShowActionMenu(false);
                console.log('Navegar a Crear Provincia');
              }}
            />
          )}\n```\n### Replacement (Chunk 7)\n```tsx\n          )}

          {showActionMenu && (
            <ActionMenuOverlay 
              onClose={closePanels}
              panelTranslateY={panelTranslateY}
              onScanCitizen={() => {
                closePanels();
                navigation.navigate('Scanner');
              }}
              onCreateProvince={() => {
                closePanels();
                console.log('Navegar a Crear Provincia');
              }}
            />
          )}\n```\n\n---\n\n## Step 3708 - multi_replace_file_content\nInstruction: Restore reanimated imports and useEffect statement in CanvasMap\n### Target (Chunk 1)\n```tsx\nimport Animated, { useSharedValue, runOnJS, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Replacement (Chunk 1)\n```tsx\nimport Animated, { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation, useAnimatedReaction, interpolateColor, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';\n```\n### Target (Chunk 2)\n```tsx\n  const handleNodePress = useCallback((node: MapNode) => {
    if (selectedNode?.id === node.id) {
      closePanels();
    } else {
      setSelectedNode(node);
      panelTranslateY.value = 500;
      panelTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
  }, [selectedNode, panelTranslateY]);
    if (identity) {\n```\n### Replacement (Chunk 2)\n```tsx\n  const handleNodePress = useCallback((node: MapNode) => {
    if (selectedNode?.id === node.id) {
      closePanels();
    } else {
      setSelectedNode(node);
      panelTranslateY.value = 500;
      panelTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
  }, [selectedNode, panelTranslateY]);

  useEffect(() => {
    if (identity) {\n```\n\n---\n\n## Step 3776 - multi_replace_file_content\nInstruction: Replace old overlay imports with new ones, implement panelTranslateY, and build unified flexbox HUD\n### Target (Chunk 1)\n```tsx\nimport { NodeLabel } from './NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ActionMenuOverlay } from './ActionMenuOverlay';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { NodeLabel } from './NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Target (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {\n```\n### Replacement (Chunk 2)\n```tsx\n  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const insets = useSafeAreaInsets();
  
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const panelTranslateY = useSharedValue(SCREEN_HEIGHT);

  const openActionMenu = () => {
    setShowActionMenu(true);
    panelTranslateY.value = SCREEN_HEIGHT;
    panelTranslateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
  };

  const closePanels = () => {
    panelTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
      runOnJS(setShowActionMenu)(false);
      runOnJS(handleNodeSelection)(null);
    });
  };

  const handleNodePress = useCallback((node: MapNode) => {
    if (selectedNode?.id === node.id) {
      closePanels();
    } else {
      setSelectedNode(node);
      panelTranslateY.value = SCREEN_HEIGHT;
      panelTranslateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
    }
  }, [selectedNode, panelTranslateY, SCREEN_HEIGHT]);

  useEffect(() => {\n```\n### Target (Chunk 3)\n```tsx\n        onPress: () => {
          if (selectedNode?.id === node.id) {
            handleNodeSelection(null);
          } else {
            handleNodeSelection(node);
          }
        }\n```\n### Replacement (Chunk 3)\n```tsx\n        onPress: () => handleNodePress(node)\n```\n### Target (Chunk 4)\n```tsx\n  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    );
    return { backgroundColor: bgColor };
  });

  if (isLoading || !fontNormal || !fontBold) {\n```\n### Replacement (Chunk 4)\n```tsx\n  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: (showActionMenu || selectedNode) ? panelTranslateY.value : 0 }]
    };
  });

  if (isLoading || !fontNormal || !fontBold) {\n```\n### Target (Chunk 5)\n```tsx\n      {/* Navegación Semántica (Controles LOD) - Columna Lateral Dinámica */}
      <View style={styles.lodControlsContainer}>
        {[
          { level: 1, label: 'Ciudadanos', icon: '👤' },
          { level: 2, label: 'Provincias', icon: '🏛️' },
          { level: 3, label: 'Causas', icon: '⚖️' },
        ].map((item) => {
          const isActive = currentLOD === item.level;
          return (
            <Pressable 
              key={item.level}
              onPress={() => goToLOD(item.level)}
              style={[
                styles.lodSegment,
                isActive && styles.lodSegmentActive
              ]}
            >
              <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
            </Pressable>
          );
        })}
      </View>

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

      {/* Dock Inferior - Se oculta si hay un nodo seleccionado o si el menú está abierto */}
      {!selectedNode && !showActionMenu && (
        <FloatingDock
          onAddPress={() => setShowActionMenu(true)}
          onMessagePress={() => console.log('Mensajes')}
          onMarketPress={() => console.log('Mercado')}
          onVotePress={() => console.log('Votaciones')}
          onProfilePress={() => setShowQR(true)} // Por ahora abrimos el QR de identidad aquí
        />
      )}

      {showActionMenu && (
        <ActionMenuOverlay 
          onClose={() => setShowActionMenu(false)}
          onScanCitizen={() => {
            setShowActionMenu(false);
            navigation.navigate('Scanner');
          }}
          onCreateProvince={() => {
            setShowActionMenu(false);
            console.log('Navegar a Crear Provincia');
          }}
        />
      )}\n```\n### Replacement (Chunk 5)\n```tsx\n      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View 
        style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}
      >
        {/* Fondo oscuro interactivo */}
        {(showActionMenu || selectedNode) && (
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
            onPress={closePanels} 
          />
        )}
        
        {/* Navegador de Niveles (LOD) apoyado sobre el panel */}
        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 1, label: 'Ciudadanos', icon: '👤' },
            ].map((item) => {
              const isActive = currentLOD === item.level;
              return (
                <Pressable 
                  key={item.level}
                  onPress={() => goToLOD(item.level)}
                  style={[styles.lodSegment, isActive && styles.lodSegmentActive]}
                >
                  <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          
          {(selectedNode || showActionMenu) && (
            <ContextualBottomSheet panelTranslateY={panelTranslateY} onClose={closePanels}>
              {selectedNode && (
                <CitizenProfileContent 
                  citizen={selectedNode}
                  onClose={closePanels}
                  onViewProfile={() => {}}
                  onUpdateLocalName={(newName) => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                    setSelectedNode({ ...selectedNode, localName: newName });
                  }}
                />
              )}
              {showActionMenu && (
                <ActionMenuContent 
                  onScanCitizen={() => {
                    closePanels();
                    navigation.navigate('Scanner');
                  }}
                  onCreateProvince={() => {
                    closePanels();
                    console.log('Navegar a Crear Provincia');
                  }}
                />
              )}
            </ContextualBottomSheet>
          )}

          {!selectedNode && !showActionMenu && (
            <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
              <FloatingDock
                onAddPress={openActionMenu}
                onMessagePress={() => console.log('Mensajes')}
                onMarketPress={() => console.log('Mercado')}
                onVotePress={() => console.log('Votaciones')}
                onProfilePress={() => setShowQR(true)} 
              />
            </View>
          )}

        </View>
      </View>\n```\n### Target (Chunk 6)\n```tsx\n  lodControlsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 120, // Posición fija encima del Dock
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },\n```\n### Replacement (Chunk 6)\n```tsx\n  lodControlsContainer: {
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },\n```\n\n---\n\n## Step 3788 - replace_file_content\nInstruction: Replace old overlay imports with new ones\n### Target (Chunk 1)\n```tsx\nimport { NodeLabel } from './NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ActionMenuOverlay } from './ActionMenuOverlay';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n### Replacement (Chunk 1)\n```tsx\nimport { NodeLabel } from './NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';\n```\n\n---\n\n## Step 3813 - multi_replace_file_content\nInstruction: Fix imports, useSharedValue instead of Animated.Value, fix typescript errors\n### Target (Chunk 1)\n```tsx\nimport { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';

const { width, height } = Dimensions.get('window');\n```\n### Replacement (Chunk 1)\n```tsx\nimport { Logger } from '../../infrastructure/telemetry/Logger';
import { NodeLabel } from './NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';

const { width, height } = Dimensions.get('window');\n```\n### Target (Chunk 2)\n```tsx\n  const [currentLOD, setCurrentLOD] = useState(1);
  const [animMode, setAnimMode] = useState(new Animated.Value(1));
  
  const insets = useSafeAreaInsets();\n```\n### Replacement (Chunk 2)\n```tsx\n  const [currentLOD, setCurrentLOD] = useState(1);
  const animMode = useSharedValue(1);
  
  const insets = useSafeAreaInsets();\n```\n### Target (Chunk 3)\n```tsx\nconst styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  }
});\n```\n### Replacement (Chunk 3)\n```tsx\nconst styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  },
  lodControlsContainer: {
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },
  lodSegment: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  lodSegmentActive: {
    backgroundColor: '#3b82f6', 
  },
  lodSegmentIcon: {
    fontSize: 24, 
    opacity: 0.6,
  },
});\n```\n\n---\n\n## Step 3844 - replace_file_content\nInstruction: Replace the end of the render block with the Flexbox HUD\n### Target (Chunk 1)\n```tsx\n      {selectedNode && (
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
      )}\n```\n### Replacement (Chunk 1)\n```tsx\n      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}>
        {/* Fondo oscuro interactivo */}
        {(showActionMenu || selectedNode) && (
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={closePanels} />
        )}
        
        {/* Navegador de Niveles (LOD) apoyado sobre el panel */}
        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 1, label: 'Ciudadanos', icon: '👤' },
            ].map((item) => {
              const isActive = currentLOD === item.level;
              return (
                <Pressable key={item.level} onPress={() => goToLOD(item.level)} style={[styles.lodSegment, isActive && styles.lodSegmentActive]}>
                  <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          
          {(selectedNode || showActionMenu) && (
            <ContextualBottomSheet panelTranslateY={panelTranslateY} onClose={closePanels}>
              {selectedNode && (
                <CitizenProfileContent 
                  citizen={selectedNode as any}
                  onClose={closePanels}
                  onViewProfile={() => {}}
                  onUpdateLocalName={(newName) => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                    setSelectedNode({ ...selectedNode, localName: newName } as any);
                  }}
                />
              )}
              {showActionMenu && (
                <ActionMenuContent 
                  onScanCitizen={() => {
                    closePanels();
                  }}
                  onCreateProvince={() => {
                    closePanels();
                    console.log('Navegar a Crear Provincia');
                  }}
                />
              )}
            </ContextualBottomSheet>
          )}

          {!selectedNode && !showActionMenu && (
            <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
              <FloatingDock
                onAddPress={openActionMenu}
                onMessagePress={() => console.log('Mensajes')}
                onMarketPress={() => console.log('Mercado')}
                onVotePress={() => console.log('Votaciones')}
                onProfilePress={() => setShowQR(true)} 
              />
            </View>
          )}

        </View>
      </View>\n```\n\n---\n\n## Step 3872 - replace_file_content\nInstruction: Replace the leftover NodeInfoOverlay block with the Flexbox HUD\n### Target (Chunk 1)\n```tsx\n      {selectedNode && (
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
    </View>\n```\n### Replacement (Chunk 1)\n```tsx\n      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}>
        {/* Fondo oscuro interactivo */}
        {(showActionMenu || selectedNode) && (
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={closePanels} />
        )}
        
        {/* Navegador de Niveles (LOD) apoyado sobre el panel */}
        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 1, label: 'Ciudadanos', icon: '👤' },
            ].map((item) => {
              const isActive = currentLOD === item.level;
              return (
                <Pressable key={item.level} onPress={() => goToLOD(item.level)} style={[styles.lodSegment, isActive && styles.lodSegmentActive]}>
                  <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          
          {(selectedNode || showActionMenu) && (
            <ContextualBottomSheet panelTranslateY={panelTranslateY} onClose={closePanels}>
              {selectedNode && (
                <CitizenProfileContent 
                  citizen={selectedNode as any}
                  onClose={closePanels}
                  onViewProfile={() => {}}
                  onUpdateLocalName={(newName) => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                    setSelectedNode({ ...selectedNode, localName: newName } as any);
                  }}
                />
              )}
              {showActionMenu && (
                <ActionMenuContent 
                  onScanCitizen={() => {
                    closePanels();
                  }}
                  onCreateProvince={() => {
                    closePanels();
                    console.log('Navegar a Crear Provincia');
                  }}
                />
              )}
            </ContextualBottomSheet>
          )}

          {!selectedNode && !showActionMenu && (
            <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
              <FloatingDock
                onAddPress={openActionMenu}
                onMessagePress={() => console.log('Mensajes')}
                onMarketPress={() => console.log('Mercado')}
                onVotePress={() => console.log('Votaciones')}
                onProfilePress={() => setShowQR(true)} 
              />
            </View>
          )}

        </View>
      </View>
      {showQR && (
        <QRGenerator 
          identity={{ did: 'did:amar:dummy', keys: {} } as any} 
          onClose={() => setShowQR(false)} 
        />
      )}
    </View>\n```\n\n---\n\n