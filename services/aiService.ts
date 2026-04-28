import { NotebookResponse, GeminiResponse, ExecutionMode } from "../types";
import { getSystemPrompt } from "./prompts";

// API Key from environment variables
const apiKey = import.meta.env.VITE_KIMI_API_KEY;
const API_URL = 'https://api.moonshot.ai/v1/chat/completions';

export async function callKimi(messages: any[], temperature = 0.1) {
  const maxRetries = 4; // Increased retries for Tier 2 handling
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
           model: 'moonshot-v1-32k',
           messages: messages,
           temperature: temperature,
           max_tokens: 4096 // Ensure long code blocks aren't truncated
         })
      });

      // Handle Rate Limiting (429) specifically as suggested by Kimi K2
      if (response.status === 429) {
        attempt++;
        if (attempt > maxRetries) throw new Error("Kimi API Rate limit exceeded. Please wait a moment.");
        
        // Exponential backoff: 2s, 4s, 8s... + random jitter
        const delay = Math.pow(2, attempt) * 1000 + (Math.random() * 500); 
        console.warn(`[Kimi Tier 2] Rate limited (429). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error: any) {
      if (attempt >= maxRetries) throw error;
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export const executeCode = async (
    code: string, 
    onProgress?: (text: string) => void,
    onPlotData?: (data: any) => void
): Promise<GeminiResponse> => {
    try {
        const response = await fetch("http://127.0.0.1:2000/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullOutput = "";
        let isError = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    try {
                        const jsonStr = line.trim().slice(6);
                        const data = JSON.parse(jsonStr);
                        
                        if (data.output !== undefined) {
                            let chunk = data.output;
                            
                            // Real-time Telemetry Interception
                            if (chunk.includes('[VML_DATA]')) {
                                try {
                                    const parts = chunk.split('[VML_DATA]');
                                    const jsonPart = parts[1].trim();
                                    
                                    // Robust match for JSON objects even with newlines
                                    const match = jsonPart.match(/^(\{[\s\S]*?\})/);
                                    if (match && onPlotData) {
                                        const parsed = JSON.parse(match[1]);
                                        
                                        // Data Normalization: Convert numeric strings to actual Numbers
                                        const normalized = Object.entries(parsed).reduce((acc: any, [k, v]) => {
                                            const num = Number(v);
                                            acc[k] = (typeof v === 'string' && v.trim() !== '' && !isNaN(num)) ? num : v;
                                            return acc;
                                        }, {});
                                        
                                        // Inject high-resolution timestamp for live runtime tracking
                                        normalized.timestamp = Date.now();
                                        
                                        onPlotData(normalized);
                                    }
                                    
                                    // Remove the tag and the JSON block from terminal output
                                    const jsonStr = match ? match[1] : '';
                                    const remaining = jsonPart.substring(jsonStr.length);
                                    chunk = parts[0] + remaining;
                                } catch (e) {
                                    console.warn("Plot data parse error", e);
                                }
                            }

                            // Initialize terminal lines
                            if (fullOutput === "") {
                                (window as any)._vml_term_lines = [""];
                                (window as any)._vml_term_cursorY = 0;
                            }
                            
                            let lines = (window as any)._vml_term_lines as string[];
                            let cursorY = (window as any)._vml_term_cursorY as number;

                            while (chunk.includes('\x1b[A')) {
                                const idx = chunk.indexOf('\x1b[A');
                                processText(chunk.slice(0, idx), lines, cursorY);
                                cursorY = Math.max(0, cursorY - 1);
                                chunk = chunk.slice(idx + 3);
                            }

                            function processText(text: string, termLines: string[], y: number) {
                                let parts = text.split('\r');
                                for (let i = 0; i < parts.length; i++) {
                                    if (i > 0 || text.startsWith('\r')) termLines[y] = "";
                                    let subParts = parts[i].split('\n');
                                    for (let j = 0; j < subParts.length; j++) {
                                        if (j > 0) {
                                            y++;
                                            if (!termLines[y]) termLines[y] = "";
                                        }
                                        termLines[y] += subParts[j];
                                    }
                                }
                                return y;
                            }

                            cursorY = processText(chunk, lines, cursorY);
                            (window as any)._vml_term_lines = lines;
                            (window as any)._vml_term_cursorY = cursorY;
                            
                            if (lines.length > 200) {
                                lines = lines.slice(lines.length - 100);
                                cursorY = Math.max(0, cursorY - (lines.length - 100));
                            }

                            fullOutput = lines.join('\n');
                            if (onProgress) onProgress(fullOutput);
                        }
                        
                        if (data.is_done) {
                            isError = data.is_error;
                            reader.cancel();
                            return { text: fullOutput, error: isError ? (fullOutput.trim() || "Execution failed") : undefined };
                        }
                    } catch (e) {
                        console.warn("Stream parse error", e);
                    }
                }
            }
        }

        return { text: fullOutput, error: isError ? (fullOutput.trim() || "Execution failed") : undefined };

    } catch (error: any) {
        return { text: '', error: "Connect error: " + error.message };
    }
};

export const fixCodeError = async (code: string, error: string): Promise<string> => {
    try {
        let fixedCode = await callKimi([
            { role: 'system', content: `
You are an expert Python debugger and autonomous recovery agent. 
Your goal is to fix the provided code so it runs without the specified error.

RECOVERY RULES:
1. If the error is a 'ModuleNotFoundError' or 'ImportError', prepend a '!pip install <package>' line at the very top of the code to fix the environment.
2. Maintain the original logic as much as possible.
3. Return ONLY the fixed python code (including any !pip commands). No markdown, no explanations.
            `},
            { role: 'user', content: `Original Code:\n${code}\n\nError Traceback:\n${error}\n\nFix the code. If a library is missing, add the !pip install line.` }
        ]);
        
        fixedCode = fixedCode.replace(/^\`\`\`python\n/, '').replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
        return fixedCode;
    } catch (err) {
        console.error("Kimi Auto-fix failed:", err);
        return code;
    }
}

export const generateNotebookStructure = async (prompt: string, mode: ExecutionMode = 'agent'): Promise<NotebookResponse> => {
    try {
        const systemPrompt = getSystemPrompt(mode, prompt);

        const text = await callKimi([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ]);

        if (text) {
            try {
                let cleanResponse = text.replace(/```json/g, '').replace(/```/g, '').trim();
                
                // Fix LLM glitches like "type"": " or "content"": "
                cleanResponse = cleanResponse.replace(/"(\w+)""\s*:/g, '"$1":');
                
                // FIX: LLMs often illegally escape single quotes in JSON strings
                cleanResponse = cleanResponse.replace(/\\'/g, "'");
                
                // FIX: Heuristic for unbalanced quotes in "content" fields (common typo)
                // If a line ends with a missing quote before a comma, add it
                cleanResponse = cleanResponse.replace(/(=["']\w+)(?=[,)\s]*",?$)/g, '$1"');
                
                // Fix trailing commas in objects/arrays
                cleanResponse = cleanResponse.replace(/,\s*([\]}])/g, '$1');

                const startObj = cleanResponse.indexOf('{');
                const endObj = cleanResponse.lastIndexOf('}');
                
                if (startObj === -1 || endObj === -1) {
                    return { cells: [], clarification: text };
                }

                const cleanText = cleanResponse.substring(startObj, endObj + 1);
                const data = JSON.parse(cleanText);
                
                if (data.clarification) return { cells: [], clarification: data.clarification };
                return { cells: data.cells || [] };
            } catch (parseError: any) {
                if (!text.includes('{')) return { cells: [], clarification: text };
                return { cells: [], error: "Format error. Raw: " + text };
            }
        }
    } catch (error: any) {
        return { cells: [], error: error.message };
    }
}