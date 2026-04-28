import asyncio
import os
import json
from typing import Any

from dotenv import load_dotenv
import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
import requests

load_dotenv()

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
if not ROBOFLOW_API_KEY:
    raise RuntimeError("ROBOFLOW_API_KEY is required to start the Roboflow MCP server.")

ROBOFLOW_API_BASE = os.getenv("ROBOFLOW_API_BASE", "https://api.roboflow.com")

def build_inference_url(workspace: str, project: str, model: str) -> str:
    return f"{ROBOFLOW_API_BASE}/{workspace}/{project}/{model}/infer"

def format_predictions(predictions: list[dict[str, Any]]) -> str:
    if not predictions:
        return "No predictions returned by Roboflow."

    lines = []
    for idx, pred in enumerate(predictions[:5], start=1):
        label = pred.get("label") or pred.get("class") or "prediction"
        score = pred.get("confidence") or pred.get("probability", "N/A")
        box = pred.get("bounding_box") or pred.get("bbox")
        box_str = f" bbox={box}" if box else ""
        lines.append(f"{idx}. {label} ({score}){box_str}")
    if len(predictions) > 5:
        lines.append(f"...and {len(predictions) - 5} more predictions.")
    return "\n".join(lines)

def call_roboflow_inference(workspace: str, project: str, model: str, image_url: str, confidence: float | None) -> dict[str, Any]:
    url = build_inference_url(workspace, project, model)
    params = {"api_key": ROBOFLOW_API_KEY}
    if confidence is not None:
        params["confidence"] = str(confidence)

    response = requests.post(url, params=params, data={"image": image_url}, timeout=60)
    response.raise_for_status()
    return response.json()

server = Server("vml-roboflow")

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="roboflow_infer",
            description="Run Roboflow inference on an image using your workspace/project/model.",
            inputSchema={
                "type": "object",
                "properties": {
                    "workspace": {"type": "string", "description": "Roboflow workspace slug."},
                    "project": {"type": "string", "description": "Roboflow project slug."},
                    "model": {"type": "string", "description": "Roboflow model slug."},
                    "image_url": {"type": "string", "description": "Public image URL.", "format": "uri"},
                    "confidence": {"type": "number", "description": "Minimum confidence threshold."}
                },
                "required": ["workspace", "project", "model", "image_url"],
            },
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict | None):
    if name != "roboflow_infer":
        raise ValueError(f"Unknown tool: {name}")

    workspace = arguments.get("workspace")
    project = arguments.get("project")
    model = arguments.get("model")
    image_url = arguments.get("image_url")
    confidence = arguments.get("confidence")

    if not all([workspace, project, model, image_url]):
        raise ValueError("workspace/project/model/image_url are required.")

    try:
        payload = call_roboflow_inference(workspace, project, model, image_url, confidence)
        predictions = payload.get("predictions", [])
        summary = format_predictions(predictions)
        metadata = json.dumps(payload.get("metadata", {}), indent=2)
        text = f"Roboflow inference completed for {workspace}/{project}/{model}\n\nPredictions:\n{summary}\n\nRaw metadata:\n{metadata}"
        return [types.TextContent(type="text", text=text)]
    except requests.HTTPError as exc:
        return [types.TextContent(type="text", text=f"Roboflow inference failed: {exc} - {exc.response.text}")]

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="vml-roboflow",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
