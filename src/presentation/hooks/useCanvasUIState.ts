import { useState, useRef, useCallback, useEffect } from 'react';
import { Dimensions, Vibration } from 'react-native';
import { useSharedValue, withTiming, SharedValue } from 'react-native-reanimated';
import { MapNode, MapLink } from '../../types/canvas';
import { buildOverlayCluster, OverlayClusterPaths } from '../components/canvas/FastCanvasRenderer';
import { SkFont } from '@shopify/react-native-skia';

interface UseCanvasUIStateProps {
  nodes: MapNode[];
  links: MapLink[];
  fontBold: SkFont | null;
}

export function useCanvasUIState({ nodes, links, fontBold }: UseCanvasUIStateProps) {
  const [showQR, setShowQR] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showProvinceForm, setShowProvinceForm] = useState(false);
  const [showAlertsAndMessages, setShowAlertsAndMessages] = useState(false);
  const [initialChatTarget, setInitialChatTarget] = useState<any>(null);
  const [currentLOD, setCurrentLOD] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [isNodeChatOpen, setIsNodeChatOpen] = useState(false);
  const [sheetSnapIndex, setSheetSnapIndex] = useState<number>(0);

  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const animatedPosition = useSharedValue(SCREEN_HEIGHT);
  const animatedIndex = useSharedValue(-1);
  const bottomSheetRef = useRef<any>(null);

  const activeFocusState = useSharedValue<{ selected: string | null; connected: Record<string, boolean> }>({
    selected: null,
    connected: {},
  });
  const focusTransition = useSharedValue(0);
  const overlayClusterData = useSharedValue<OverlayClusterPaths | null>(null);
  const selectedNodeShared = useSharedValue<MapNode | null>(null);

  useEffect(() => {
    selectedNodeShared.value = selectedNode;
  }, [selectedNode, selectedNodeShared]);

  const openActionMenu = useCallback(() => {
    setShowActionMenu(true);
    setShowProvinceForm(false);
    setShowAlertsAndMessages(false);
    setSelectedNode(null);
    setIsNodeChatOpen(false);
    setSheetSnapIndex(0);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const openAlertsAndMessages = useCallback((target?: any) => {
    setInitialChatTarget(target || null);
    setShowAlertsAndMessages(true);
    setShowActionMenu(false);
    setShowProvinceForm(false);
    setSelectedNode(null);
    setIsNodeChatOpen(false);
    setSheetSnapIndex(0);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  // FASE 1: Solo dispara la animación de cierre. NO modifica estado de React.
  // Esto garantiza que el mode y los snapPoints permanezcan estables
  // durante toda la animación de cierre del BottomSheet.
  const closePanels = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  // FASE 2: Limpieza de estado. Se ejecuta DESPUÉS de que la animación
  // de cierre haya terminado, a través del callback nativo onClose del
  // BottomSheet. En este punto el panel ya es invisible, así que cambiar
  // mode/snapPoints no provoca saltos ni recálculos de posición.
  const onPanelsClosed = useCallback(() => {
    setShowActionMenu(false);
    setShowProvinceForm(false);
    setShowAlertsAndMessages(false);
    setInitialChatTarget(null);
    setIsNodeChatOpen(false);
    setSelectedNode(null);
    setSheetSnapIndex(-1);
    focusTransition.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        overlayClusterData.value = null;
        activeFocusState.value = { selected: null, connected: {} };
      }
    });
  }, [activeFocusState, focusTransition, overlayClusterData]);

  const handleNodePress = useCallback(
    (node: MapNode) => {
      if (selectedNode?.id === node.id) {
        closePanels();
      } else {
        Vibration.vibrate(50);
        const connected: Record<string, boolean> = {};
        connected[node.id] = true;
        links.forEach((l) => {
          if (l.sourceId === node.id) connected[l.targetId] = true;
          if (l.targetId === node.id) connected[l.sourceId] = true;
        });

        const clusterPaths = buildOverlayCluster(node, nodes, links, fontBold);
        activeFocusState.value = { selected: node.id, connected };
        overlayClusterData.value = clusterPaths;
        focusTransition.value = withTiming(1, { duration: 250 });

        setSelectedNode(node);
        setIsNodeChatOpen(false);
        setSheetSnapIndex(0);
        setShowActionMenu(false);
        setShowProvinceForm(false);
        setShowAlertsAndMessages(false);
        bottomSheetRef.current?.snapToIndex(0);
      }
    },
    [selectedNode, nodes, links, fontBold, activeFocusState, focusTransition, overlayClusterData, closePanels]
  );

  return {
    showQR,
    setShowQR,
    showActionMenu,
    setShowActionMenu,
    showProvinceForm,
    setShowProvinceForm,
    showAlertsAndMessages,
    setShowAlertsAndMessages,
    initialChatTarget,
    setInitialChatTarget,
    openAlertsAndMessages,
    currentLOD,
    setCurrentLOD,
    selectedNode,
    setSelectedNode,
    isNodeChatOpen,
    setIsNodeChatOpen,
    sheetSnapIndex,
    setSheetSnapIndex,
    animatedPosition,
    animatedIndex,
    bottomSheetRef,
    activeFocusState,
    focusTransition,
    overlayClusterData,
    openActionMenu,
    closePanels,
    onPanelsClosed,
    handleNodePress,
  };
}
