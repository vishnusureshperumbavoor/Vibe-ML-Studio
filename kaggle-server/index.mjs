import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

dotenv.config({ path: "../.env" });

const KAGGLE_MCP_URL = process.env.KAGGLE_MCP_URL || "https://www.kaggle.com/mcp";
const KAGGLE_API_TOKEN = process.env.KAGGLE_API_TOKEN;

const app = express();
app.use(cors());
app.use(express.json());

let mcpClient = null;

async function initMCP() {
  console.log("[Kaggle Bridge] Connecting to Kaggle MCP:", KAGGLE_MCP_URL);

  const headers = {};
  if (KAGGLE_API_TOKEN) {
    headers["Authorization"] = `Bearer ${KAGGLE_API_TOKEN}`;
  }

  const transport = new StreamableHTTPClientTransport(new URL(KAGGLE_MCP_URL), {
    requestInit: { headers },
  });

  const client = new Client(
    { name: "vibe-ml-platform", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    console.log("[Kaggle Bridge] Connected.");
    mcpClient = client;
  } catch (e) {
    console.error("[Kaggle Bridge] Connection failed:", e);
  }
}

app.get("/mcp/list", async (_req, res) => {
  if (!mcpClient) return res.json({ tools: [] });
  try {
    const tools = await mcpClient.listTools();
    return res.json({ tools: tools.tools });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post("/mcp/call", async (req, res) => {
  if (!mcpClient) return res.status(503).json({ error: "MCP Client not connected" });
  const { name, arguments: args } = req.body || {};
  try {
    const result = await mcpClient.callTool({ name, arguments: args });
    return res.json({ result: result.content });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

const PORT = 1002;
app.listen(PORT, () => {
  console.log(`[Kaggle Bridge] Listening on port ${PORT}`);
  initMCP();
});

