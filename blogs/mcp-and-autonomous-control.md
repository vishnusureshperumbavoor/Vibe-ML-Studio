# Beyond the UI: Controlling Vibe ML via MCP

Most AI platforms are "Walled Gardens"—you have to stay inside their website or app to get anything done. **Vibe ML Studio** takes a different approach. We've built an **Intelligence API** using the **Model Context Protocol (MCP)**, allowing you to drive your local training and retrieval engine from anywhere.

## What is MCP?

Developed by Anthropic, the **Model Context Protocol** is an open standard that allows LLMs (like Claude) to securely use local tools. Instead of just "chatting" about code, Claude can now "act" on your local machine using VML's specific toolbelt.

## The Implementation

Our implementation uses a **Node.js Bridge** that connects external agents to our **Python Orchestration Engine**.

### The Connection Snippet

By adding this to your `claude_desktop_config.json`, you give Claude "Remote Control" over your VML Studio:

```json
{
  "mcpServers": {
    "vml-studio": {
      "command": "node",
      "args": ["D:/Projects/VML-Studio/mcp-bridge/index.mjs"],
      "env": {
        "HF_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## What This Enables

When you connect VML to an external agent like Claude or Cursor, you unlock **Autonomous Tool-Calling**:

1.  **Remote Training Orchestration**: You can say, *"Claude, start a 500-step training job on the medical dataset,"* and Claude will call the `start_sft_job` tool to prepare the VML notebook blocks.
2.  **Hardware-Aware Decision Making**: Using `get_system_specs`, an agent can decide whether your local machine can handle a 7B model or if it should fall back to a 0.5B tiny-model for CPU training.
3.  **Semantic Knowledge Mining**: You can point Claude to a PDF, and it will use VML's `ingest_knowledge` tool to index it into your local RAG database without you ever leaving the chat interface.
4.  **Local-to-Cloud Deployment**: Agents can monitor your training progress and, once a threshold is met, trigger an autonomous upload to Hugging Face via the VML deployment pipeline.

## Why Portability Matters

In the era of Agentic AI, your tools should not be trapped in a browser tab. By exposing our core functions through MCP, Vibe ML Studio becomes part of your **System-Wide Intelligence**. 

You're not just using a tool; you're building a **Personal AI Cloud** that lives on your machine but is accessible to every smart agent in your workflow.

---
*Vibe ML: Orchestrating the future of local-first agentic intelligence.*
