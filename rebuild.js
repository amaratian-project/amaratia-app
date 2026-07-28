const fs = require('fs');

let content = fs.readFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx', 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Imports
const importsTarget = `import { NodeInfoOverlay } from './NodeInfoOverlay';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';`;
const importsReplacement = `import { NodeLabel } from './NodeLabel';
import { QRGenerator } from './QRGenerator';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CitizenRepository } from '../../domain/repositories/CitizenRepository';`;

if (content.includes(importsTarget)) {
  content = content.replace(importsTarget, importsReplacement);
  console.log("Replaced imports");
} else {
  console.log("FAILED to replace imports");
}

// 2. States
const stateTarget = `  const [nodeLimit, setNodeLimit] = useState(100); // Empezamos en 100 como pidió el usuario`;
const stateReplacement = `  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [currentLOD, setCurrentLOD] = useState(1);
  const animMode = useSharedValue(1);`;

if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateReplacement);
  console.log("Replaced state");
} else {
  console.log("FAILED to replace state");
}

// 3. Panel Logic and goToLOD
const panelTarget = `  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);`;
const panelReplacement = `  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

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

  const goToLOD = (level: number) => {
    setCurrentLOD(level);
    if (level === 1) {
      scale.value = withSpring(1.0);
      animMode.value = withTiming(1);
    } else if (level === 2) {
      scale.value = withSpring(0.4);
      animMode.value = withTiming(2);
    } else if (level === 3) {
      scale.value = withSpring(0.15);
      animMode.value = withTiming(3);
    }
  };`;

if (content.includes(panelTarget)) {
  content = content.replace(panelTarget, panelReplacement);
  console.log("Replaced panel logic");
} else {
  console.log("FAILED to replace panel logic");
}

// 4. Pinch Gesture limits
const pinchEndTarget = `      if (scale.value < MIN_SCALE) {
        finalScale = MIN_SCALE;
        scale.value = withSpring(MIN_SCALE);
        runOnJS(handleSemanticZoomOut)();
      } else if (scale.value > MAX_SCALE) {
        finalScale = MAX_SCALE;
        scale.value = withSpring(MAX_SCALE);
      }`;
const pinchEndReplacement = `      if (scale.value < MIN_SCALE) {
        finalScale = MIN_SCALE;
        scale.value = withSpring(MIN_SCALE);
      } else if (scale.value > MAX_SCALE) {
        finalScale = MAX_SCALE;
        scale.value = withSpring(MAX_SCALE);
      }
      if (finalScale < 0.25 && currentLOD !== 3) {
        runOnJS(goToLOD)(3);
      } else if (finalScale >= 0.25 && finalScale < 0.6 && currentLOD !== 2) {
        runOnJS(goToLOD)(2);
      } else if (finalScale >= 0.6 && currentLOD !== 1) {
        runOnJS(goToLOD)(1);
      }`;

if (content.includes(pinchEndTarget)) {
  content = content.replace(pinchEndTarget, pinchEndReplacement);
  console.log("Replaced pinch limits");
} else {
  console.log("FAILED to replace pinch limits");
}

// 5. Replace NodeLabel text fading using interpolate
const nodeLabelTarget = `    const baseZoomOpacity = scale.value < 0.4 ? 0 : scale.value > 0.7 ? 1 : (scale.value - 0.4) / 0.3;`;
const nodeLabelReplacement = `    const baseZoomOpacity = interpolate(scale.value, [0.4, 0.7], [0, 1], Extrapolation.CLAMP);`;
if (content.includes(nodeLabelTarget)) {
  content = content.replace(nodeLabelTarget, nodeLabelReplacement);
  console.log("Replaced NodeLabel text fading");
}

// 6. Fix handleNodePress in tapGesture
const tapTarget = `        onPress: () => {
          if (selectedNode?.id === node.id) {
            handleNodeSelection(null);
          } else {
            handleNodeSelection(node);
          }
        }`;
const tapReplacement = `        onPress: () => handleNodePress(node)`;
if (content.includes(tapTarget)) {
  content = content.replace(tapTarget, tapReplacement);
  console.log("Replaced tap logic");
}

// 7. Styles
const stylesTarget = `const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
  }
});`;
const stylesReplacement = `const styles = StyleSheet.create({
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
});`;
if (content.includes(stylesTarget)) {
  content = content.replace(stylesTarget, stylesReplacement);
  console.log("Replaced styles");
} else {
  console.log("FAILED to replace styles");
}

// 8. JSX Render Block
const splitStrLF = '  return (\n    <View style={styles.container}>';
let jsxStart = content.indexOf(splitStrLF);

if (jsxStart === -1) {
    console.error("Could not find the return statement of CanvasMap!");
    process.exit(1);
}

const beforeJsx = content.substring(0, jsxStart);
const jsxBlock = `  const animatedBackground = useAnimatedStyle(() => {
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

  return (
    <Animated.View style={[styles.container, animatedBackground]}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={globalTransform}>
        {links.map((link, index) => {
          return <SkiaLink key={\`link-\${index}\`} link={link} activeFocusState={activeFocusState} focusTransition={focusTransition} />;
        })}
        {nodes.map(node => {
          return (
            <SkiaNode 
              key={\`node-\${node.id}\`} 
              node={node} 
              activeFocusState={activeFocusState} 
              focusTransition={focusTransition}
            />
          );
        })}
        {nodes.map(node => {
          const font = node.level === 0 ? fontBold : fontNormal;
          return (
            <NodeLabel 
              key={\`label-\${node.id}\`} 
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

      {/* HUD INFERIOR UNIFICADO (Flexbox) */}
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
    </Animated.View>
  );
};`;

// Append styles block to the end
content = beforeJsx + jsxBlock + '\n\n' + stylesReplacement + '\n';
console.log("Replaced JSX block");

// Import interpolateColor and Pressable, and useCallback
content = content.replace(`import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform } from 'react-native';`, `import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform, Pressable } from 'react-native';`);
content = content.replace(`interpolate, Extrapolation } from 'react-native-reanimated';`, `interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';`);
content = content.replace(`import React, { useEffect, useState } from 'react';`, `import React, { useEffect, useState, useCallback } from 'react';`);
console.log("Replaced top imports");

fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx', content, 'utf8');
console.log("Rebuilt CanvasMap with HUD (ROBUST)!");
