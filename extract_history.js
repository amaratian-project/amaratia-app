const fs = require('fs');
const readline = require('readline');

async function extractHistory() {
  const fileStream = fs.createReadStream('C:/Users/Aurelio/.gemini/antigravity-ide/brain/f2001a13-d9aa-4d40-863b-efcce803f501/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let history = [];

  for await (const line of rl) {
    if (line.includes('replace_file_content') || line.includes('multi_replace_file_content') || line.includes('write_to_file')) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content' || tc.name === 'write_to_file') {
              // Extract args, it could be tc.args or JSON.parse(tc.arguments) if OpenAI format
              let args = tc.args;
              if (!args && tc.arguments) {
                args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
              }
              
              if (args && args.TargetFile && args.TargetFile.includes('CanvasMap.tsx')) {
                history.push({
                  step: obj.step_index,
                  name: tc.name,
                  instruction: args.Instruction || args.Description || 'No description',
                  replacements: tc.name === 'multi_replace_file_content' ? args.ReplacementChunks : [{TargetContent: args.TargetContent, ReplacementContent: args.ReplacementContent, CodeContent: args.CodeContent}]
                });
              }
            }
          }
        }
      } catch(e) {}
    }
  }

  let output = "# ENTIRE HISTORY OF CHANGES TO CanvasMap.tsx\\n\\n";
  for (const h of history) {
    output += `## Step ${h.step} - ${h.name}\\n`;
    output += `Instruction: ${h.instruction}\\n`;
    for (let i = 0; i < h.replacements.length; i++) {
      const rep = h.replacements[i];
      if (rep.CodeContent) {
        output += `WRITE ENTIRE FILE (Omitted for brevity)\\n`;
      } else {
        output += `### Target (Chunk ${i+1})\\n\`\`\`tsx\\n${rep.TargetContent}\\n\`\`\`\\n`;
        output += `### Replacement (Chunk ${i+1})\\n\`\`\`tsx\\n${rep.ReplacementContent}\\n\`\`\`\\n`;
      }
    }
    output += "\\n---\\n\\n";
  }

  fs.writeFileSync('c:/Users/Aurelio/Documents/GitHub/Amaratia/canvas_history.md', output, 'utf8');
  console.log("Extracted entire history to canvas_history.md");
}
extractHistory();
