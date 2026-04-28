import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Load environment variables
dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;

let mcpClient = null;

async function initMCP() {
    console.log("🚀 [Node Bridge] Spawning Vibe ML MCP Server...");
    
    // We launch the Python executable, and pass your agent_orchestrator.py as the argument!
    const pythonExec = path.resolve('../server/venv/Scripts/python.exe');
    const pythonScript = path.resolve('../server/agent_orchestrator.py');

    const transport = new StdioClientTransport({
        command: pythonExec,
        args: [pythonScript],
        env: {
            ...process.env,
            HF_TOKEN: HF_TOKEN || ""
        }
    });
    
    const client = new Client(
        { name: "vibe-ml-platform", version: "1.0.0" },
        { capabilities: {} }
    );
    
    try {
        await client.connect(transport);
        console.log("✅ [Node Bridge] Successfully connected to Vibe ML MCP Server!");
        mcpClient = client;
    } catch (e) {
        console.error("❌ [Node Bridge] Connection failed:", e);
    }
}

app.get("/mcp/list", async (req, res) => {
    if (!mcpClient) return res.json({ tools: [] });
    try {
        const tools = await mcpClient.listTools();
        return res.json({ tools: tools.tools });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/mcp/call", async (req, res) => {
    if (!mcpClient) return res.status(503).json({ error: "MCP Client not connected" });
    const { name, arguments: args } = req.body;
    try {
        const result = await mcpClient.callTool({ name, arguments: args });
        return res.json({ result: result.content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 1001;
app.listen(PORT, () => {
    console.log(`🌉 Node.js MCP Bridge listening on port ${PORT}`);
    initMCP();
});
