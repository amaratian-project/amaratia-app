const fs = require('fs');
const readline = require('readline');

async function search() {
  const fileStream = fs.createReadStream('C:/Users/Aurelio/.gemini/antigravity-ide/brain/f2001a13-d9aa-4d40-863b-efcce803f501/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lastCanvasMapContent = null;
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (line.includes('CanvasMap.tsx')) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            if (tc.name.includes('replace_file_content') || tc.name.includes('write_to_file')) {
              const args = JSON.parse(tc.arguments);
              if (args.TargetFile && args.TargetFile.includes('CanvasMap.tsx')) {
                // If it's write_to_file, it has CodeContent
                if (args.CodeContent) {
                  lastCanvasMapContent = args.CodeContent;
                }
              }
            }
          }
        }
      } catch(e) {}
    }
  }

  if (lastCanvasMapContent) {
    fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/last_canvas.tsx', lastCanvasMapContent, 'utf8');
    console.log("Extracted CanvasMap to last_canvas.tsx");
  } else {
    console.log("Could not find the last full write to CanvasMap.tsx. Line count: " + lineCount);
  }
}
search();
