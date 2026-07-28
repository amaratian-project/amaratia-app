const fs = require('fs');
const path = 'c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove states
content = content.replace(/const \[nodeLimit, setNodeLimit\] = useState\(300\);\r?\n\s*/g, '');
content = content.replace(/const \[sliderVal, setSliderVal\] = useState\(300\);\r?\n\s*/g, '');

// Remove slice limit
content = content.replace(/\.slice\(0, nodeLimit\)/g, '');

// Remove dependency
content = content.replace(/\[fullTopology, nodeLimit\]/g, '[fullTopology]');

// Remove debugPan
const debugPanRegex = /const debugPan = Gesture\.Pan\(\)[\s\S]*?runOnJS\(setNodeLimit\)\(newVal\);\r?\n\s*\}\);\r?\n\s*/;
content = content.replace(debugPanRegex, '');

// Remove Debug UI
const debugUIRegex = /\{\/\*\s*DEBUGER UI \(Temporal\)\s*\*\/\}[\s\S]*?Desliza para ajustar<\/Text>\r?\n\s*<\/View>\r?\n\s*/;
content = content.replace(debugUIRegex, '');

fs.writeFileSync(path, content, 'utf8');
console.log("Slider removed completely.");
