import os
import sqlite3
import httpx
import uuid
from pathlib import Path
from datetime import datetime, timezone
from fastapi import HTTPException
from risk_engine import get_risk

DB = Path(os.getenv("FLAGGUARD_DATA_DIR", str(Path(__file__).parent))) / "rollback.db"

def init_audit():
    with sqlite3.connect(DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rollback_history (
                id TEXT PRIMARY KEY,
                feature TEXT,
                previous_state TEXT,
                new_state TEXT,
                reason TEXT,
                status TEXT,
                created_at TEXT
            )
        """)

def save_audit(old, new, reason, status):
    init_audit()
    record = (
        str(uuid.uuid4()),
        "checkout_v2",
        old,
        new,
        reason,
        status,
        datetime.now(timezone.utc).isoformat()
    )

    with sqlite3.connect(DB) as conn:
        conn.execute("""
            INSERT INTO rollback_history
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, record)

def get_history():
    init_audit()
    with sqlite3.connect(DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT * FROM rollback_history
            ORDER BY created_at DESC
            LIMIT 100
        """).fetchall()

    return [dict(row) for row in rows]

async def execute_rollback(approved):
    if approved is not True:
        raise HTTPException(400, "Human approval required")

    risk = get_risk()

    if not risk.get("rollback_recommended"):
        raise HTTPException(409, "Rollback not recommended")

    key = os.getenv("FLAGSMITH_ADMIN_API_KEY")
    env_key = os.getenv("FLAGSMITH_ENVIRONMENT_KEY")

    if not key or not env_key:
        raise HTTPException(503, "Management credentials missing")

    base = os.getenv("FLAGSMITH_API_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
    headers = {"Authorization": f"Api-Key {key}"}

    reason = "High risk in simulated checkout traffic"
    attempted = False

    try:
        async with httpx.AsyncClient(
            timeout=15, trust_env=False
        ) as client:

            flags = await client.get(
                f"{base}/flags/",
                headers={"X-Environment-Key": env_key}
            )
            flags.raise_for_status()
            items = flags.json()

            if isinstance(items, dict):
                items = items.get("value", [])

            flag = next((
                f for f in items
                if f.get("feature", {}).get("name") == "checkout_v2"
            ), None)

            if not flag:
                raise HTTPException(404, "Feature not found")

            state_id = flag["id"]
            url = f"{base}/environments/{env_key}/featurestates/{state_id}/"

            current = await client.get(url, headers=headers)
            current.raise_for_status()
            state = current.json()

            if (
                state.get("feature") != flag["feature"]["id"]
                or state.get("identity") is not None
                or state.get("feature_segment") is not None
            ):
                raise HTTPException(409, "Unexpected feature state")

            if state.get("enabled") is False:
                return {
                    "status": "ALREADY_STABLE",
                    "message": "Checkout V1 is already active"
                }

            save_audit("ON", "PENDING", reason, "APPROVED")
            attempted = True

            result = await client.patch(
                url,
                headers=headers,
                json={"enabled": False}
            )
            result.raise_for_status()

            verify = await client.get(url, headers=headers)
            verify.raise_for_status()

            if verify.json().get("enabled") is not False:
                save_audit("ON", "UNKNOWN", reason, "UNVERIFIED")
                raise HTTPException(502, "Rollback verification failed")

            save_audit("ON", "OFF", reason, "SUCCESS")

            return {
                "status": "SUCCESS",
                "feature": "checkout_v2",
                "enabled": False,
                "restored_version": "v1",
                "source": "simulated",
                "message": "Rollback verified in Flagsmith"
            }

    except httpx.HTTPStatusError as exc:
        save_audit(
            "ON" if attempted else "UNKNOWN",
            "UNKNOWN",
            reason,
            f"HTTP_{exc.response.status_code}"
        )
        raise HTTPException(
            502,
            f"Flagsmith returned HTTP {exc.response.status_code}"
        )

    except httpx.RequestError:
        save_audit("UNKNOWN", "UNKNOWN", reason, "CONNECTION_ERROR")
        raise HTTPException(502, "Flagsmith connection failed")


