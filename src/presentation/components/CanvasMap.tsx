import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Platform, Text, Pressable } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS, withSpring, withTiming, useAnimatedStyle, interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useDependencies } from '../../application/context/DependencyContext';
import { useAuth } from '../../application/context/AuthContext';
import { IdentityUseCase } from '../../application/use-cases/IdentityUseCase';
import { GraphTopology } from '../../domain/models/GraphTopology';

import { MapNode } from '../../types/canvas';
import { useForceDirectedGraph } from '../hooks/useForceDirectedGraph';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { useCanvasUIState } from '../hooks/useCanvasUIState';
import { FastCanvasRenderer, getRadius, buildOverlayCluster } from './canvas/FastCanvasRenderer';
import type { OverlayClusterPaths } from './canvas/FastCanvasRenderer';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';
import { CreateProvinceForm } from './CreateProvinceForm';
import { ProvinceChatUI } from './ProvinceChatUI';
import { CauseInfoContent } from './CauseInfoContent';

const { width, height } = Dimensions.get('window');
const SCREEN_HEIGHT = height;

const LodSegmentButton = ({ item, animMode, onPress }: any) => {
  const animStyle = useAnimatedStyle(() => {
    const diff = Math.abs(animMode.value - item.level);
    const isSelected = diff < 0.5;
    const scaleVal = interpolate(diff, [0, 0.6], [1.1, 0.95], Extrapolation.CLAMP);
    const opacityVal = interpolate(diff, [0, 0.6], [1, 0.5], Extrapolation.CLAMP);

    return {
      backgroundColor: isSelected ? item.color : 'transparent',
      transform: [{ scale: scaleVal }],
      opacity: opacityVal,
    };
  });

  return (
    <Pressable onPress={onPress} hitSlop={8}>
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
  const { identity } = useAuth();
  const [fullTopology, setFullTopology] = useState<GraphTopology | null>(null);

  const activeIdentity = React.useMemo(() => {
    if (identity) return identity;
    const identityUseCase = new IdentityUseCase();
    const mnemonic = identityUseCase.generateMnemonic();
    return { ...identityUseCase.deriveKeysFromMnemonic(mnemonic), alias: 'Ciudadano (Dev)' };
  }, [identity]);

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

  // 3. UI State Hook
  const {
    showQR,
    setShowQR,
    showActionMenu,
    setShowActionMenu,
    showProvinceForm,
    setShowProvinceForm,
    currentLOD,
    setCurrentLOD,
    selectedNode,
    setSelectedNode,
    animatedPosition,
    bottomSheetRef,
    focusTransition,
    overlayClusterData,
    openActionMenu,
    closePanels,
    handleNodePress,
  } = useCanvasUIState({ nodes, links, fontBold });

  // 5. Gestures
  const { composed, globalTransform, scale, translateX, translateY, goToLOD, scales } = useCanvasGestures({
    bounds,
    nodes,
    handleNodePress,
    closePanels
  });

  const animMode = useDerivedValue(() => {
    return interpolate(
      scale.value,
      [scales.scaleLOD3, scales.scaleLOD2, scales.scaleLOD1],
      [3, 2, 1],
      Extrapolation.CLAMP
    );
  });

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
    let sheetHeight = 0;

    if (animatedPosition.value > 0 && animatedPosition.value <= SCREEN_HEIGHT) {
      const rawSheetHeight = SCREEN_HEIGHT - animatedPosition.value;
      const PANEL_VISUAL_OFFSET = 45;
      sheetHeight = Math.max(0, rawSheetHeight - PANEL_VISUAL_OFFSET);
    }

    const maxUpload = SCREEN_HEIGHT * 0.5;
    const elementTopFromBottom = Math.min(maxUpload, Math.max(100, sheetHeight));

    const GAP = 5;
    const translateY = -(elementTopFromBottom + GAP);

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

          <Canvas style={StyleSheet.absoluteFill}>
            <Group origin={CENTER} transform={globalTransform}>
              <FastCanvasRenderer
                nodes={nodes}
                links={links}
                overlayClusterData={overlayClusterData}
                focusTransition={focusTransition}
                animMode={animMode}
                fontBold={fontBold}
                scale={scale}
              />
            </Group>
          </Canvas>

        </View>
      </GestureDetector>

      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}>

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

          {/* El Dock se renderiza ANTES que el BottomSheet para que este último lo tape al subir */}
          <View style={{ position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
            <FloatingDock
              onAddPress={openActionMenu}
              onMessagePress={() => console.log('Mensajes')}
              onMarketPress={() => console.log('Mercado')}
              onVotePress={() => console.log('Votaciones')}
              onProfilePress={() => setShowQR(true)}
            />
          </View>

          <ContextualBottomSheet
            ref={bottomSheetRef}
            animatedPosition={animatedPosition}
            onClose={closePanels}
            mode={
              showProvinceForm ? 'provinceForm' :
                showActionMenu ? 'actionMenu' :
                  (selectedNode?.level === -1 ? 'province' :
                    selectedNode?.level === -2 ? 'cause' : 'citizen')
            }
          >
            {selectedNode && selectedNode.level >= 0 && (
              <CitizenProfileContent
                citizen={selectedNode}
                onClose={closePanels}
                onViewProfile={() => { }}
                onUpdateLocalName={(newName) => {
                  setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                  setSelectedNode({ ...selectedNode, localName: newName });
                }}
              />
            )}
            {selectedNode && selectedNode.level === -1 && (
              <ProvinceChatUI provinceId={selectedNode.id} provinceName={selectedNode.alias} />
            )}
            {selectedNode && selectedNode.level === -2 && (
              <CauseInfoContent causeNode={selectedNode} />
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
        </View>
      </View>

      {showQR && activeIdentity && (
        <View style={StyleSheet.absoluteFill}>
          <QRGenerator
            identity={activeIdentity}
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
