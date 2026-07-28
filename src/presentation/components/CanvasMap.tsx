import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Platform, Text, Pressable } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS, withSpring, withTiming, useAnimatedStyle, interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useDependencies } from '../../application/context/DependencyContext';
import { GraphTopology } from '../../domain/models/GraphTopology';

import { MapNode } from '../../types/canvas';
import { useForceDirectedGraph } from '../hooks/useForceDirectedGraph';
import { useCanvasGestures } from '../hooks/useCanvasGestures';

import { SkiaNode } from './canvas/SkiaNode';
import { SkiaLink } from './canvas/SkiaLink';
import { NodeLabel } from './canvas/NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';

const { width, height } = Dimensions.get('window');

export const CanvasMap = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const fontNormal = useFont(require('../../../assets/Modelica-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Modelica-Bold.ttf'), 14);

  const { citizenRepository } = useDependencies();
  const [fullTopology, setFullTopology] = useState<GraphTopology | null>(null);
  
  // 1. Data Fetching
  useEffect(() => {
    const fetchTopology = async () => {
      const topology = await citizenRepository.getHydratedCitizens();
      setFullTopology(topology);
    };
    fetchTopology();
  }, [citizenRepository]);

  // 2. Physics & Graph
  const {
    nodes,
    setNodes,
    links,
    bounds,
    isLoading,
  } = useForceDirectedGraph(fullTopology);

  // 3. UI State
  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [currentLOD, setCurrentLOD] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  
  const animMode = useSharedValue(1);
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const panelTranslateY = useSharedValue(SCREEN_HEIGHT);

  const activeFocusState = useSharedValue<{ selected: string | null, connected: Record<string, boolean> }>({ selected: null, connected: {} });
  const focusTransition = useSharedValue(0);

  // 4. Panel Transitions
  useEffect(() => {
    if (selectedNode || showActionMenu) {
      panelTranslateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
    }
  }, [selectedNode, showActionMenu, panelTranslateY]);

  const openActionMenu = () => {
    if (!selectedNode && !showActionMenu) panelTranslateY.value = SCREEN_HEIGHT;
    setShowActionMenu(true);
    setSelectedNode(null);
  };

  const closePanels = useCallback(() => {
    panelTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(setShowActionMenu)(false);
        runOnJS(setSelectedNode)(null);
      }
    });
    activeFocusState.value = { selected: null, connected: {} };
    focusTransition.value = withTiming(0, { duration: 300 });
  }, [panelTranslateY, SCREEN_HEIGHT, activeFocusState, focusTransition]);

  const handleNodePress = useCallback((node: MapNode) => {
    if (selectedNode?.id === node.id) {
      closePanels();
    } else {
      Vibration.vibrate(50);
      const connected: Record<string, boolean> = {};
      connected[node.id] = true;
      links.forEach(l => {
        if (l.sourceId === node.id) connected[l.targetId] = true;
        if (l.targetId === node.id) connected[l.sourceId] = true;
      });
      activeFocusState.value = { selected: node.id, connected };
      focusTransition.value = withTiming(1, { duration: 300 });

      if (!selectedNode && !showActionMenu) {
        panelTranslateY.value = SCREEN_HEIGHT;
      }
      setSelectedNode(node);
      setShowActionMenu(false);
    }
  }, [selectedNode, showActionMenu, panelTranslateY, SCREEN_HEIGHT, links, activeFocusState, focusTransition, closePanels]);

  // 5. Gestures
  const { composed, globalTransform, scale, goToLOD } = useCanvasGestures({
    bounds,
    nodes,
    currentLOD,
    setCurrentLOD,
    animMode,
    handleNodePress,
    closePanels
  });

  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    ) as string;
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: (showActionMenu || selectedNode) ? panelTranslateY.value : 0 }]
    };
  });

  const CENTER = React.useMemo(() => ({ x: width / 2, y: height / 2 }), []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedBackground]}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            <Group origin={CENTER} transform={globalTransform}>
              {links.map((link, i) => (
                <SkiaLink 
                  key={`link-${i}`} 
                  link={link} 
                  activeFocusState={activeFocusState} 
                  focusTransition={focusTransition} 
                />
              ))}
              {nodes.map(node => (
                <SkiaNode 
                  key={node.id} 
                  node={node} 
                  activeFocusState={activeFocusState} 
                  focusTransition={focusTransition} 
                />
              ))}
              {nodes.map(node => (
                <NodeLabel 
                  key={`label-${node.id}`} 
                  node={node} 
                  scale={scale} 
                  font={fontBold} 
                  activeFocusState={activeFocusState} 
                  focusTransition={focusTransition} 
                />
              ))}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}>
        
        {/* Navegador de Niveles (LOD) apoyado sobre el panel */}
        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️', color: '#ec4899' },
              { level: 2, label: 'Provincias', icon: '🏛️', color: '#f59e0b' },
              { level: 1, label: 'Ciudadanos', icon: '👤', color: '#3b82f6' },
            ].map((item) => {
              const isActive = currentLOD === item.level;
              return (
                <Pressable key={item.level} onPress={() => goToLOD(item.level)} style={[styles.lodSegment, isActive && { backgroundColor: item.color }]}>
                  <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          
          <ContextualBottomSheet panelTranslateY={panelTranslateY} onClose={closePanels}>
            <View>
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
                    navigation.navigate('Scanner' as never);
                  }}
                  onCreateProvince={() => {}}
                />
              )}
            </View>
          </ContextualBottomSheet>

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
        <View style={StyleSheet.absoluteFill}>
          <QRGenerator 
            identity={{ nsec: '***REMOVED_SECRET***', alias: 'Aurelio (Dev)' } as any}
            onClose={() => setShowQR(false)} 
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#020617' 
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
  lodSegmentIcon: {
    fontSize: 24, 
    opacity: 0.6,
  },
  backdrop: {
    backgroundColor: '#000000',
  }
});
