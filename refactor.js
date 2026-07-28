const fs = require('fs');
const path = 'c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. IMPORTS
content = content.replace(
  "import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform } from 'react-native';",
  "import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Text, Platform, Pressable } from 'react-native';"
);

content = content.replace(
  "import { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation } from 'react-native-reanimated';",
  "import { useSharedValue, runOnJS, useDerivedValue, useAnimatedStyle, withSpring, withTiming, SharedValue, interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';"
);

content = content.replace(
  "import Animated from 'react-native-reanimated';",
  "import Animated from 'react-native-reanimated';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';"
);

content = content.replace(
  "import { NodeInfoOverlay } from './NodeInfoOverlay';",
  "import { ContextualBottomSheet } from './ContextualBottomSheet';\nimport { CitizenProfileContent } from './CitizenProfileContent';\nimport { ActionMenuContent } from './ActionMenuContent';\nimport { FloatingDock } from './FloatingDock';\nimport { QRGenerator } from './QRGenerator';"
);

// 2. STATE AND HANDLERS
content = content.replace(
  "  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);",
  `  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [currentLOD, setCurrentLOD] = useState(1);
  const animMode = useSharedValue(1);
  
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

  const goToLOD = (level: number) => { setCurrentLOD(level); };

  const handleNodePress = React.useCallback((node: MapNode | null) => {
    if (!node) {
      closePanels();
      return;
    }
    if (selectedNode?.id === node.id) {
      closePanels();
    } else {
      setSelectedNode(node);
      panelTranslateY.value = SCREEN_HEIGHT;
      panelTranslateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
    }
  }, [selectedNode, panelTranslateY, SCREEN_HEIGHT]);`
);

content = content.replace(
  "runOnJS(handleNodeSelection)(foundNode);",
  "runOnJS(handleNodePress)(foundNode);"
);

// 3. RENDER STYLES
content = content.replace(
  "  if (isLoading || !fontNormal || !fontBold) {",
  `  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    );
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    return { transform: [{ translateY: (showActionMenu || selectedNode) ? panelTranslateY.value : 0 }] };
  });

  if (isLoading || !fontNormal || !fontBold) {`
);

// 4. THE EXACT RENDER REPLACEMENT
const renderStartText = `      {selectedNode && (
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
      )}`;

const newRenderText = `{/* HUD INFERIOR UNIFICADO (Flexbox) */}
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
      )}`;

content = content.replace(renderStartText, newRenderText);

// 5. STYLES
const newStyles = `lodControlsContainer: {
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
  },`;

content = content.replace("canvasWrapper: {\n    flex: 1,\n  }", "canvasWrapper: {\n    flex: 1,\n  },\n  " + newStyles);


fs.writeFileSync(path, content, 'utf8');
console.log("Refactoring complete.");
