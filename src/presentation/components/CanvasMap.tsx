import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Platform, Text, Pressable } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS, withSpring, withTiming, useAnimatedStyle, interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';
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
import { CreateProvinceForm } from './CreateProvinceForm';
import { ProvinceChatUI } from './ProvinceChatUI';

const { width, height } = Dimensions.get('window');

const LodSegmentButton = ({ item, animMode, selectedNode, onPress }: any) => {
  const animStyle = useAnimatedStyle(() => {
    let activeLevel = Math.round(animMode.value);
    if (selectedNode.value) {
      activeLevel = selectedNode.value.level === -1 ? 2 : 1;
    }
    const isActive = activeLevel === item.level;
    return {
      backgroundColor: isActive ? item.color : 'transparent',
    };
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.lodSegment, animStyle]}>
        <Text style={styles.lodSegmentIcon}>{item.icon}</Text>
      </Animated.View>
    </Pressable>
  );
};

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
  const [showProvinceForm, setShowProvinceForm] = useState(false);
  const [currentLOD, setCurrentLOD] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const animatedPosition = useSharedValue(SCREEN_HEIGHT);
  const bottomSheetRef = React.useRef<any>(null); // We will type this as BottomSheet in imports

  const activeFocusState = useSharedValue<{ selected: string | null, connected: Record<string, boolean> }>({ selected: null, connected: {} });
  const focusTransition = useSharedValue(0);
  const selectedNodeShared = useSharedValue<MapNode | null>(null);

  useEffect(() => {
    selectedNodeShared.value = selectedNode;
  }, [selectedNode]);

  // 4. Panel Transitions
  useEffect(() => {
    if (selectedNode || showActionMenu || showProvinceForm) {
      setTimeout(() => {
        bottomSheetRef.current?.snapToIndex(0);
      }, 50);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [selectedNode, showActionMenu, showProvinceForm]);

  const openActionMenu = () => {
    setShowActionMenu(true);
    setShowProvinceForm(false);
    setSelectedNode(null);
  };

  const closePanels = useCallback(() => {
    bottomSheetRef.current?.close();
    setShowActionMenu(false);
    setShowProvinceForm(false);
    setSelectedNode(null);
    activeFocusState.value = { selected: null, connected: {} };
    focusTransition.value = withTiming(0, { duration: 300 });
  }, [activeFocusState, focusTransition]);

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

      setSelectedNode(node);
      setShowActionMenu(false);
      setShowProvinceForm(false);
    }
  }, [selectedNode, links, activeFocusState, focusTransition, closePanels]);

  // 5. Gestures
  const { composed, globalTransform, scale, translateX, translateY, goToLOD, scales } = useCanvasGestures({
    bounds,
    nodes,
    handleNodePress,
    closePanels
  });

  const animMode = useDerivedValue(() => {
    // Math: scaleLOD3 -> 3, scaleLOD2 -> 2, scaleLOD1 -> 1
    // By using CLAMP, if they zoom in past scaleLOD1, animMode stays at 1.
    return interpolate(
      scale.value,
      [scales.scaleLOD3, scales.scaleLOD2, scales.scaleLOD1],
      [3, 2, 1],
      Extrapolation.CLAMP
    );
  });

  // Actualizar HUD visualmente si animMode cambia significativamente
  useAnimatedReaction(
    () => Math.round(animMode.value),
    (nextLOD, prevLOD) => {
      if (nextLOD !== prevLOD && nextLOD >= 1 && nextLOD <= 3) {
        runOnJS(setCurrentLOD)(nextLOD);
      }
    }
  );

  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    ) as string;
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    // animatedPosition.value goes from SCREEN_HEIGHT (closed) to small numbers (open)
    // We want the controls to sit exactly on top of the bottom sheet.
    // So we translate Y by animatedPosition.value - SCREEN_HEIGHT.
    // If closed (SCREEN_HEIGHT), translateY is 0.
    // If open at Y=500 and SCREEN_HEIGHT is 800, translateY is -300 (goes up 300px).
    // If animatedPosition is 0, it means the bottom sheet hasn't calculated its position yet.
    const translateY = (showActionMenu || selectedNode || showProvinceForm) 
      ? (animatedPosition.value > 0 && animatedPosition.value < SCREEN_HEIGHT ? animatedPosition.value - SCREEN_HEIGHT : 0)
      : 0;
    
    return {
      transform: [{ translateY }]
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
                  animMode={animMode}
                />
              ))}
              {nodes.map(node => (
                <SkiaNode 
                  key={node.id} 
                  node={node} 
                  activeFocusState={activeFocusState} 
                  focusTransition={focusTransition} 
                  animMode={animMode}
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
                  animMode={animMode}
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
              return (
                <LodSegmentButton
                  key={item.level}
                  item={item}
                  animMode={animMode}
                  selectedNode={selectedNodeShared}
                  onPress={() => {
                    setCurrentLOD(item.level);
                    goToLOD(item.level);
                  }}
                />
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          
          <ContextualBottomSheet 
            ref={bottomSheetRef}
            animatedPosition={animatedPosition} 
            onClose={closePanels}
            mode={selectedNode !== null && selectedNode.level === -1 ? 'province' : 'dynamic'}
          >
            {selectedNode && selectedNode.level !== -1 && (
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
            {selectedNode && selectedNode.level === -1 && (
              <ProvinceChatUI provinceId={selectedNode.id} provinceName={selectedNode.alias} />
            )}
            {showActionMenu && (
              <ActionMenuContent 
                onScanCitizen={() => {
                  closePanels();
                  navigation.navigate('Scanner' as never);
                }}
                onCreateProvince={() => {
                  setShowActionMenu(false);
                  setShowProvinceForm(true);
                }}
              />
            )}
            {showProvinceForm && (
              <CreateProvinceForm
                onClose={closePanels}
                onSuccess={async () => {
                  closePanels();
                  const topology = await citizenRepository.getHydratedCitizens();
                  setFullTopology(topology);
                }}
              />
            )}
          </ContextualBottomSheet>

          {!selectedNode && !showActionMenu && !showProvinceForm && (
            <View style={{ position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
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
