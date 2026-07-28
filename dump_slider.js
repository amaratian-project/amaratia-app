const fs = require('fs');
const content = fs.readFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx', 'utf8');

const matches = content.split('\n').filter(line => line.includes('Slider') || line.includes('nodeLimit') || line.includes('sliderVal') || line.includes('Topología'));
fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/slider_matches.txt', matches.join('\n'), 'utf8');
