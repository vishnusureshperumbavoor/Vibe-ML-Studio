import asyncio
import time
import httpx
from typing import Dict, Any, Optional

API_BASE_URL = "http://127.0.0.1:2000"

async def fetch_daemon_status() -> Optional[Dict[str, Any]]:
    """Checks the status of the local VibeML backend Colab bridge."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{API_BASE_URL}/colab/status")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None

async def trigger_daemon_connect() -> Dict[str, Any]:
    """Sends connect command to the local VibeML backend Colab bridge."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{API_BASE_URL}/colab/connect")
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Failed to reach backend daemon"}

async def wait_for_colab_pairing(timeout_seconds: float = 60.0) -> bool:
    """Polls until the Google Colab session is paired and connected."""
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        status = await fetch_daemon_status()
        if status and status.get("connected"):
            return True
        await asyncio.sleep(2.0)
    return False

async def execute_remote_code(code: str, keep_cell: bool = True) -> Dict[str, Any]:
    """Executes code cell on Google Colab Cloud GPU."""
    async with httpx.AsyncClient(timeout=1200.0) as client:
        resp = await client.post(
            f"{API_BASE_URL}/colab/execute",
            json={"code": code, "keep_cell": keepCell}
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Colab execution error ({resp.status_code}): {resp.text}")
        return resp.json()
