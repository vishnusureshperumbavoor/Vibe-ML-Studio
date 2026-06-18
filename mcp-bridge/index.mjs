import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVER_ROOT = path.join(PROJECT_ROOT, 'server');

// Load environment variables
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;

let mcpClient = null;

async function initMCP() {
    console.log("🚀 Connecting to Vibe ML MCP Server...");
    
    // Resolve Python executable across Windows/macOS/Linux.
    const platform = os.platform();
    const venvPython = platform === 'win32'
        ? path.join(SERVER_ROOT, 'venv', 'Scripts', 'python.exe')
        : path.join(SERVER_ROOT, 'venv', 'bin', 'python');
    const pythonExec = existsSync(venvPython)
        ? venvPython
        : (platform === 'win32' ? 'python' : 'python3');
    const pythonScript = path.join(SERVER_ROOT, 'agent_orchestrator.py');

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
        console.log("✅ Successfully connected to Vibe ML MCP Server!");
        mcpClient = client;
    } catch (e) {
        console.error("❌ Connection failed:", e);
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

const PORT = Number(process.env.MCP_BRIDGE_PORT || 3001);
const HOST = "127.0.0.1";
const httpServer = app.listen(PORT, HOST, () => {
    console.log(`🌉 Node.js MCP Bridge listening at http://${HOST}:${PORT}`);
    initMCP();
});

httpServer.on("error", (error) => {
    console.error(`❌ MCP Bridge failed to listen on http://${HOST}:${PORT}:`, error);
    process.exit(1);
});
