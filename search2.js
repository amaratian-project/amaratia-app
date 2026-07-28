const fs = require('fs');
const readline = require('readline');

async function search() {
  const fileStream = fs.createReadStream('C:/Users/Aurelio/.gemini/antigravity-ide/brain/f2001a13-d9aa-4d40-863b-efcce803f501/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lines = [];
  let buffer = [];

  for await (const line of rl) {
    buffer.push(line);
    if (buffer.length > 5) buffer.shift();

    if (line.includes('handleSemanticZoomOut')) {
      lines.push(...buffer);
    }
  }

  if (lines.length > 0) {
    fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/zoom_out_search.jsonl', lines.join('\n'), 'utf8');
    console.log("Found references to handleSemanticZoomOut");
  } else {
    console.log("No references found.");
  }
}
search();
