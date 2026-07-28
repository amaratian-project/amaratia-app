const fs = require('fs');
const content = fs.readFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx', 'utf8');

const lines = content.split('\n');
const matches = lines.map((line, idx) => {
  if (line.includes('sliderVal') || line.includes('nodeLimit')) {
    return `${idx + 1}: ${line}`;
  }
  return null;
}).filter(Boolean);

fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/slider_matches2.txt', matches.join('\n'), 'utf8');
