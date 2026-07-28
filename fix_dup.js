const fs = require('fs');
const path = 'c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\s*\/\/ ESTADO 100% NATIVO PARA EL FOCUS MODE \(CERO REACT RENDER\)[\s\S]*?originFocalY = useSharedValue\(0\);/g;

// This will match all occurrences.
const matches = content.match(regex);
if (matches && matches.length > 1) {
  // Replace the LAST occurrence with empty string
  const lastMatch = matches[matches.length - 1];
  const lastIndex = content.lastIndexOf(lastMatch);
  
  content = content.substring(0, lastIndex) + content.substring(lastIndex + lastMatch.length);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Deleted duplicate state declarations.");
} else {
  console.log("No duplicates found or regex failed.");
}
