import { v4 as uuidv4 } from "uuid";
import { CellData, CellType, ConnectorConfig } from "../types";
import { callKimi, executeCode } from "./aiService";
import { VML_SYSTEM_PROMPT } from "./prompts/vmlSystemPrompt";

/**
 * VMLAgent handles the dynamic, iterative conversation loop with the LLM.
 * It uses XML tags for tool calling, reasoning, and notebook management.
 */

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type AgentToolType =
  | "load_skill"
  | "load_skill_resource"
  | "save_skill"
  | "execute_python"
  | "list_skills"
  | "read_file"
  | "add_cell"
  | "edit_cell";

export class VMLAgent {
  private mcpTools: any[] = [];
  private mcpToolServerByName: Record<string, string> = {};
  private messages: AgentMessage[] = [];
  private onThinking: (text: string) => void;
  private onUpdateCells: (cells: CellData[]) => void;
  private currentCells: CellData[] = [];
  private connectorConfigs: ConnectorConfig[] = [];
  private shouldStop: () => boolean;

  constructor(
    cells: CellData[],
    onThinking: (text: string) => void,
    onUpdateCells: (cells: CellData[]) => void,
    connectorConfigs: ConnectorConfig[] = [],
    shouldStop: () => boolean = () => false,
  ) {
    this.currentCells = cells;
    this.onThinking = onThinking;
    this.onUpdateCells = onUpdateCells;
    this.connectorConfigs =
      connectorConfigs.length > 0
        ? connectorConfigs
        : this.getDefaultConnectorConfigs();
    this.shouldStop = shouldStop;
  }

  async init() {
    const serversToLoad = this.connectorConfigs
      .filter((conn) => conn.enabled && conn.url)
      .map((conn) => ({
        id: conn.id,
        label: conn.label,
        url: conn.url,
      }));

    this.mcpTools = [];
    this.mcpToolServerByName = {};

    for (const s of serversToLoad) {
      try {
        const resp = await fetch(`${s.url}/mcp/list`);
        const data = await resp.json();
        const tools = data.tools || [];
        tools.forEach((t: any) => {
          if (!t?.name) return;
          this.mcpTools.push({
            ...t,
            _mcpServerId: s.id,
            _mcpServerLabel: s.label,
          });
          this.mcpToolServerByName[t.name] = s.url;
        });
      } catch (e) {
        console.error(`Failed to load MCP tools from ${s.id}:`, e);
      }
    }

    if (this.mcpTools.length > 0) {
      console.log(
        "VMLAgent loaded MCP tools:",
        this.mcpTools.map((t: any) => `${t._mcpServerId}:${t.name}`),
      );
    }

    let mcpPrompt = "";
    const grouped: Record<string, any[]> = {};
    this.mcpTools.forEach((t: any) => {
      const key = t._mcpServerLabel || "MCP";
      grouped[key] = grouped[key] || [];
      grouped[key].push(t);
    });
    for (const label of Object.keys(grouped)) {
      mcpPrompt += `\n\n### HUB TOOLS (${label}):\nYou have access to these NATIVE tools. Call them using <tool_use> tags:\n`;
      grouped[label].forEach((t: any) => {
        mcpPrompt += `- **${t.name}**: ${t.description}\n  Args: ${JSON.stringify(t.inputSchema)}\n`;
      });
    }

    // Initialize System Message with combined prompt
    if (this.messages.length === 0) {
      this.messages = [
        { role: "system" as any, content: VML_SYSTEM_PROMPT + mcpPrompt },
      ];
    }
  }

  setHistory(messages: AgentMessage[]) {
    this.messages = messages;
  }

  getHistory(): AgentMessage[] {
    return this.messages;
  }

  private getDefaultConnectorConfigs(): ConnectorConfig[] {
    return [
      {
        id: "huggingface",
        label: "Hugging Face MCP",
        description: "Default Hugging Face bridge",
        url: "http://127.0.0.1:1001",
        enabled: true,
      },
      {
        id: "kaggle",
        label: "Kaggle MCP",
        description: "Default Kaggle bridge",
        url: "http://127.0.0.1:1002",
        enabled: true,
      },
      {
        id: "roboflow",
        label: "Roboflow MCP",
        description: "Default Roboflow bridge",
        url: "http://127.0.0.1:1003",
        enabled: true,
      },
    ];
  }

  /**
   * The main iterative loop: User Prompt -> [Assistant Thinking -> Tool Call -> Tool Result]* -> Final Answer.
   */
  async process(userPrompt: string) {
    this.messages.push({ role: "user", content: userPrompt });
    let isDone = false;
    let turns = 0;
    const maxTurns = 20;

    while (!isDone && turns < maxTurns) {
      if (this.shouldStop()) {
        console.log("VMLAgent: Stop signal received. Exiting process loop.");
        break;
      }
      turns++;
      const response = await callKimi(this.messages as any, 0.2);
      this.messages.push({ role: "assistant", content: response });

      // 1. Parse Thinking
      const thinking = this.extractTag(response, "thinking");
      if (thinking) this.onThinking(thinking);

      // 2. Fuzzy Multi-Tool Extraction (Allows direct tags like <add_cell>)
      let toolResults: any[] = [];

      // Format A: Standard Wrapper <tool_use><name>X</name><input>Y</input></tool_use>
      const wrappedRegex = /<tool_use>([\s\S]*?)<\/tool_use>/gi;
      let m;
      while ((m = wrappedRegex.exec(response)) !== null) {
        const results = await this.handleWrappedTool(m[1]);
        toolResults.push(results);
      }

      // Format B: Direct Tool Tags
      const toolNames: AgentToolType[] = [
        "add_cell",
        "edit_cell",
        "execute_python",
        "load_skill",
        "load_skill_resource",
        "save_skill",
        "read_file",
        "list_skills",
      ];
      for (const tName of toolNames) {
        const tagRegex = new RegExp(
          `<${tName}>([\\s\\S]*?)<\\/${tName}>`,
          "gi",
        );
        let tm;
        while ((tm = tagRegex.exec(response)) !== null) {
          const inputStr = tm[1].trim();
          const input = this.parseInput(inputStr);
          const res = await this.dispatchTool(tName, input);
          toolResults.push(res);
        }
      }

      if (toolResults.length > 0) {
        this.messages.push({
          role: "user",
          content: `<tool_results>\n${JSON.stringify(toolResults, null, 2)}\n</tool_results>`,
        });
      } else {
        // FALLBACK: Auto-promote reasoning if no cells exist yet
        const chatText = response
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
          .replace(/<[\s\S]*?>/g, "")
          .trim();
        const thinkingText = thinking
          ? thinking.replace(/<[\s\S]*?>/g, "").trim()
          : "";
        const finalCellContent =
          chatText || (this.currentCells.length === 0 ? thinkingText : "");

        if (finalCellContent) {
          this.toolAddCell({ type: "markdown", content: finalCellContent });
        }
        isDone = true;
      }
    }
  }

  private extractTag(text: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  private parseInput(text: string): any {
    // Attempt to extract content from internal tags if it's not raw JSON
    if (text.includes("<type>") && text.includes("<content>")) {
      const type = this.extractTag(text, "type") as any;
      const content = this.extractTag(text, "content");
      if (type && content) return { type, content };
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  private async handleWrappedTool(xmlFragment: string): Promise<any> {
    const nameMatch = xmlFragment.match(/<name>([\s\S]*?)<\/name>/);
    const inputMatch = xmlFragment.match(/<input>([\s\S]*?)<\/input>/);
    if (!nameMatch || !inputMatch)
      return { error: "Invalid tool_use structure." };
    return await this.dispatchTool(
      nameMatch[1].trim() as any,
      this.parseInput(inputMatch[1]),
    );
  }

  private async dispatchTool(name: string, input: any): Promise<any> {
    switch (name) {
      case "load_skill":
      case "get_skill":
        const skillName = typeof input === "object" ? input.name || "" : input;
        return await this.toolReadFile(`skills/${skillName}/SKILLS.md`);
      case "load_skill_resource":
        const resSkill = typeof input === "object" ? input.skill : "";
        const resFile =
          typeof input === "object" ? input.path || input.filename : "";
        return await this.toolReadFile(
          `skills/${resSkill}/references/${resFile}`,
        );
      case "save_skill":
        return await this.toolSaveSkill(input);
      case "execute_python":
        const codeString = typeof input === "object" ? input.code || "" : input;
        return await this.toolExecutePython(codeString);
      case "read_file":
        const filePath =
          typeof input === "object" ? input.path || input.file || "" : input;
        return await this.toolReadFile(filePath);
      case "add_cell":
        return this.toolAddCell(input);
      case "edit_cell":
        return this.toolEditCell(input);
      case "list_skills":
        return await this.toolListSkills();
      default:
        // Check if it's an MCP tool
        const mcpServerUrl = this.mcpToolServerByName[name];
        if (mcpServerUrl) {
          return await this.toolCallMCP(mcpServerUrl, name, input);
        }
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async toolCallMCP(
    serverUrl: string,
    name: string,
    arguments_obj: any,
  ) {
    try {
      const resp = await fetch(`${serverUrl}/mcp/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: arguments_obj }),
      });
      return await resp.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }

  private async toolExecutePython(code: string) {
    if (!code) return { error: "No code provided." };
    const cellId = uuidv4();
    const newCell: CellData = {
      id: cellId,
      type: "code",
      content: code,
      status: "running",
    };
    this.currentCells = [...this.currentCells, newCell];
    this.onUpdateCells(this.currentCells);

    const result = await executeCode(code, (partial) => {
      this.currentCells = this.currentCells.map((c) =>
        c.id === cellId ? { ...c, output: partial } : c,
      );
      this.onUpdateCells(this.currentCells);
    });

    this.currentCells = this.currentCells.map((c) =>
      c.id === cellId
        ? {
            ...c,
            status: result.error ? "error" : "success",
            output: result.error || result.text,
          }
        : c,
    );
    this.onUpdateCells(this.currentCells);
    return result;
  }

  private async toolListSkills() {
    try {
      const resp = await fetch("http://127.0.0.1:2000/list_skills");
      return await resp.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }

  private async toolReadFile(path: string) {
    if (!path) return { error: "Empty path." };
    try {
      const resp = await fetch("http://127.0.0.1:2000/read_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      return await resp.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }

  private async toolSaveSkill(input: {
    skill_name: string;
    filename: string;
    content: string;
  }) {
    try {
      const resp = await fetch("http://127.0.0.1:2000/save_skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return await resp.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }

  private toolAddCell(input: { type: CellType; content: string }) {
    const newCell: CellData = {
      id: uuidv4(),
      type: input.type,
      content: input.content,
      status: "idle",
    };
    this.currentCells = [...this.currentCells, newCell];
    this.onUpdateCells(this.currentCells);
    return { success: true, cellId: newCell.id };
  }

  private toolEditCell(input: { id: string; content: string }) {
    this.currentCells = this.currentCells.map((c) =>
      c.id === input.id ? { ...c, content: input.content } : c,
    );
    this.onUpdateCells(this.currentCells);
    return { success: true };
  }
}
