const fs = require('fs');
const path = 'c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx';
let content = fs.readFileSync(path, 'utf8');

const stateDecls = `  // ESTADO 100% NATIVO PARA EL FOCUS MODE (CERO REACT RENDER)
  const activeFocusState = useSharedValue<{ selected: string | null, connected: Record<string, boolean> }>({ selected: null, connected: {} });
  const focusTransition = useSharedValue(0);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  const originFocalX = useSharedValue(0);
  const originFocalY = useSharedValue(0);`;

content = content.replace(stateDecls, ""); // Remove from original position

const insertAnchor = `  const panelTranslateY = useSharedValue(SCREEN_HEIGHT);`;
content = content.replace(insertAnchor, insertAnchor + "\n\n" + stateDecls);

fs.writeFileSync(path, content, 'utf8');
console.log("Moved declarations up.");
