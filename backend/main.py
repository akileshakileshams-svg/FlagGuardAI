from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import httpx
import os

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI(
    title="FlagGuard AI",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
   allow_origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
],
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)

@app.get("/")
def home():
    return {
        "message": "FlagGuard AI Backend Running"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "FlagGuard AI"
    }

@app.get("/api/flags")
async def flags():
    key = os.getenv("FLAGSMITH_ENVIRONMENT_KEY")
    url = os.getenv(
        "FLAGSMITH_API_URL",
        "http://127.0.0.1:8000/api/v1/"
    )

    if not key:
        raise HTTPException(
            503, "Environment key missing"
        )

    try:
        async with httpx.AsyncClient(
            timeout=15, trust_env=False
        ) as client:
            response = await client.get(
                url.rstrip("/") + "/flags/",
                headers={"X-Environment-Key": key}
            )
            response.raise_for_status()
            return response.json()

    except httpx.HTTPError:
        raise HTTPException(
            502, "Flagsmith connection failed"
        )

@app.get("/api/flags/checkout_v2")
async def checkout():
    data = await flags()

    if isinstance(data, dict):
        data = data.get("value", [])

    for flag in data:
        if flag.get("feature", {}).get("name") == "checkout_v2":
            return flag

    raise HTTPException(404, "Feature not found")

from risk_engine import simulate, get_metrics, get_risk
from fastapi import Query

@app.post("/api/simulate")
async def run_simulation(
    customers: int = Query(500, ge=100, le=5000)
):
    flag = await checkout()
    version = "v2" if flag["enabled"] else "v1"
    return simulate(version, customers)

@app.get("/api/metrics")
def telemetry_metrics():
    return get_metrics()

@app.get("/api/risk")
def release_risk():
    return get_risk()


from pydantic import BaseModel, StrictBool
from fastapi import Request
from rollback_engine import execute_rollback, get_history

class RollbackApproval(BaseModel):
    approved: StrictBool

@app.post("/api/rollback")
async def rollback(body: RollbackApproval, request: Request):
    allowed = {
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    }
    if request.headers.get("origin") not in allowed:
        raise HTTPException(403, "Local dashboard approval required")

    return await execute_rollback(body.approved)

@app.get("/api/rollback/history")
def rollback_history():
    return get_history()


from replay_engine import get_replay

@app.get("/api/replay")
def release_replay():
    return get_replay()


from ai_engine import analyse_release

@app.post("/api/ai/analyse")
async def ai_analysis():
    flag = await checkout()
    return await analyse_release(flag['enabled'])



from experiment_engine import get_experiment

@app.get("/api/experiments")
async def experiments():
    return await get_experiment()

