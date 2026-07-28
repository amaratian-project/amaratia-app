const fs = require('fs');
const readline = require('readline');

async function reconstruct() {
  const fileStream = fs.createReadStream('C:/Users/Aurelio/.gemini/antigravity-ide/brain/f2001a13-d9aa-4d40-863b-efcce803f501/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let fileContent = '';

  for await (const line of rl) {
    if (line.includes('git checkout src/presentation/components/CanvasMap.tsx')) {
      break;
    }

    if (line.includes('replace_file_content') || line.includes('multi_replace_file_content') || line.includes('write_to_file')) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            let args = tc.args;
            if (!args && tc.arguments) {
              args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
            }
            
            if (args && args.TargetFile && args.TargetFile.includes('CanvasMap.tsx')) {
              if (tc.name === 'write_to_file') {
                if (args.CodeContent) {
                  fileContent = args.CodeContent;
                }
              } else if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
                const chunks = tc.name === 'multi_replace_file_content' ? args.ReplacementChunks : [{TargetContent: args.TargetContent, ReplacementContent: args.ReplacementContent}];
                for (const chunk of chunks) {
                  if (fileContent.includes(chunk.TargetContent)) {
                    fileContent = fileContent.replace(chunk.TargetContent, chunk.ReplacementContent);
                  } else {
                    // Try removing \r just in case
                    const noCrTarget = chunk.TargetContent.replace(/\r/g, '');
                    const noCrContent = fileContent.replace(/\r/g, '');
                    if (noCrContent.includes(noCrTarget)) {
                        // Very basic fallback: just ignore because replacing with differing CRLF is complex in JS strings without a proper lib,
                        // but let's try replacing all CRLF with LF, applying, then converting back.
                        fileContent = noCrContent.replace(noCrTarget, chunk.ReplacementContent.replace(/\r/g, ''));
                    } else {
                        console.log("Failed to match chunk in step " + obj.step_index);
                    }
                  }
                }
              }
            }
          }
        }
      } catch(e) {}
    }
  }

  fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/reconstructed_CanvasMap.tsx', fileContent, 'utf8');
  console.log("Reconstructed CanvasMap.tsx to reconstructed_CanvasMap.tsx");
}
reconstruct();
