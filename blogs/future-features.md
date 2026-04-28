Benchmaxxing agents  
CoT agents  
MoE agents  

Because you are using MCP, your agent_orchestrator.py could technically be used by any MCP-compatible app (like Claude Desktop or other AI IDEs), not just your VML frontend.

It allows the AI model to "choose" tools. Instead of you hardcoding buttons, the AI can say, "I need to quantize this model," and the MCP bridge will execute that Python tool automatically.