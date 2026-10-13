from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from colab_bridge.client import internal_colab_client

router = APIRouter(prefix="/colab", tags=["Google Colab Bridge"])

class ExecuteRequest(BaseModel):
    code: str
    keep_cell: bool = True

@router.get("/status")
async def get_status():
    """Returns the internal Colab MCP daemon status."""
    return {
        "status": internal_colab_client.status,
        "message": internal_colab_client.status_message,
        "tools": list(internal_colab_client.tools.keys()),
        "connected": internal_colab_client.status == "connected",
        "colabAvailable": internal_colab_client.status == "connected",
        "recent_logs": list(internal_colab_client.logs)[-25:]
    }

@router.post("/connect")
async def connect_colab():
    """Triggers pairing with Google Colab tab."""
    return await internal_colab_client.connect_browser()

@router.post("/execute")
async def execute_code(req: ExecuteRequest):
    """Executes Python code in Google Colab Cloud GPU."""
    if not req.code or not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")
    try:
        result = await internal_colab_client.execute_code(req.code, keep_cell=req.keep_cell)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
