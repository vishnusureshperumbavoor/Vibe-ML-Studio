import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

let mcpClient = null;

async function initMCP() {
    console.log("🚀 [Roboflow Bridge] Spawning Roboflow MCP server...");
    const pythonExec = path.resolve('../server/venv/Scripts/python.exe');
    const pythonScript = path.resolve('../server/mcp_server_roboflow.py');

    const transport = new StdioClientTransport({
        command: pythonExec,
        args: [pythonScript],
        env: {
            ...process.env,
        }
    });

    const client = new Client(
        { name: "vml-roboflow-bridge", version: "1.0.0" },
        { capabilities: {} }
    );

    try {
        await client.connect(transport);
        console.log("✅ [Roboflow Bridge] Connected to Roboflow MCP server.");
        mcpClient = client;
    } catch (e) {
        console.error("❌ [Roboflow Bridge] Connection failed:", e);
    }
}

app.get("/mcp/list", async (_req, res) => {
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

const PORT = 1003;
app.listen(PORT, () => {
    console.log(`🌐 [Roboflow Bridge] Listening on port ${PORT}`);
    initMCP();
});
