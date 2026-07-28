const fs = require('fs');
const path = 'c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove injectDummyTopology
content = content.replace("import { injectDummyTopology } from '../../infrastructure/database/dummyData';\n", "");
content = content.replace("      await injectDummyTopology();\n", "");

// 2. Restore activeFocusState inside handleNodePress and closePanels
// Current closePanels:
const oldClosePanels = `  const closePanels = () => {
    panelTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
      runOnJS(setShowActionMenu)(false);
      runOnJS(handleNodeSelection)(null);
    });
  };`;

// Note: my previous refactor script injected runOnJS(handleNodeSelection)(null); inside closePanels! But handleNodeSelection was REMOVED! That means closing the panel would crash!
// Wait! `handleNodePress` is the new function. Let's fix both.

const newClosePanels = `  const closePanels = () => {
    activeFocusState.value = { selected: null, connected: {} };
    focusTransition.value = withTiming(0, { duration: 300 });
    panelTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
      runOnJS(setShowActionMenu)(false);
      runOnJS(setSelectedNode)(null);
    });
  };`;
  
content = content.replace(oldClosePanels, newClosePanels);

const oldHandleNodePress = `  const handleNodePress = React.useCallback((node: MapNode | null) => {
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
  }, [selectedNode, panelTranslateY, SCREEN_HEIGHT]);`;

const newHandleNodePress = `  const handleNodePress = React.useCallback((node: MapNode | null) => {
    if (!node) {
      closePanels();
      return;
    }
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
      panelTranslateY.value = SCREEN_HEIGHT;
      panelTranslateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
    }
  }, [selectedNode, panelTranslateY, SCREEN_HEIGHT, links]);`;

content = content.replace(oldHandleNodePress, newHandleNodePress);

fs.writeFileSync(path, content, 'utf8');
console.log("Restored features in CanvasMap.tsx");
