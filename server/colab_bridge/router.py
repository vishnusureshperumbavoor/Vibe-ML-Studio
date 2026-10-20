from typing import Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from colab_bridge.chrome_profiles import discover_chrome_accounts
from colab_bridge.client import internal_colab_client

router = APIRouter(prefix="/colab", tags=["Google Colab Bridge"])


class ExecuteRequest(BaseModel):
    code: str
    keep_cell: bool = True


class ConnectRequest(BaseModel):
    profile_dir: Optional[str] = None
    authuser: Optional[int] = None
    email: Optional[str] = None


@router.get("/status")
async def get_status():
    """Returns the internal Colab MCP daemon status."""
    return {
        "status": internal_colab_client.status,
        "message": internal_colab_client.status_message,
        "tools": list(internal_colab_client.tools.keys()),
        "connected": internal_colab_client.status == "connected",
        "colabAvailable": internal_colab_client.status == "connected",
        "profile_dir": internal_colab_client.profile_dir,
        "authuser": internal_colab_client.authuser,
        "email": internal_colab_client.google_email,
        "recent_logs": list(internal_colab_client.logs)[-25:]
    }


@router.get("/accounts")
async def get_accounts():
    """Returns Google accounts found in local Chrome profiles."""
    return {"accounts": discover_chrome_accounts()}


@router.post("/connect")
async def connect_colab(req: Optional[ConnectRequest] = Body(default=None)):
    """Triggers pairing with Google Colab tab."""
    profile_dir = req.profile_dir if req else None
    authuser = req.authuser if req else None
    email = req.email if req else None
    await internal_colab_client.select_profile(profile_dir, authuser, email)
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
