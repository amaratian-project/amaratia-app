import { useState, useRef, useCallback, useEffect } from 'react';
import { Dimensions, Vibration } from 'react-native';
import { useSharedValue, withTiming, runOnJS, SharedValue } from 'react-native-reanimated';
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
  const [currentLOD, setCurrentLOD] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const animatedPosition = useSharedValue(SCREEN_HEIGHT);
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

  useEffect(() => {
    if (selectedNode || showActionMenu || showProvinceForm) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [selectedNode, showActionMenu, showProvinceForm]);

  const openActionMenu = useCallback(() => {
    setShowActionMenu(true);
    setShowProvinceForm(false);
    setSelectedNode(null);
  }, []);

  const clearSelectionState = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const closePanels = useCallback(() => {
    bottomSheetRef.current?.close();
    setShowActionMenu(false);
    setShowProvinceForm(false);
    focusTransition.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        overlayClusterData.value = null;
        activeFocusState.value = { selected: null, connected: {} };
        runOnJS(clearSelectionState)();
      }
    });
  }, [activeFocusState, focusTransition, overlayClusterData, clearSelectionState]);

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
        setShowActionMenu(false);
        setShowProvinceForm(false);
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
    currentLOD,
    setCurrentLOD,
    selectedNode,
    setSelectedNode,
    animatedPosition,
    bottomSheetRef,
    activeFocusState,
    focusTransition,
    overlayClusterData,
    openActionMenu,
    closePanels,
    handleNodePress,
  };
}
