import os
import sqlite3
import random
import uuid
from pathlib import Path
from datetime import datetime, timezone

DB = Path(os.getenv("FLAGGUARD_DATA_DIR", str(Path(__file__).parent))) / "telemetry.db"

def init_db():
    with sqlite3.connect(DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                version TEXT NOT NULL,
                success INTEGER NOT NULL,
                latency INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

def simulate(version, customers=500):
    init_db()

    run_id = str(uuid.uuid4())
    failure_rate = 0.25 if version == "v2" else 0.02
    rows = []

    for _ in range(customers):
        success = int(random.random() >= failure_rate)

        latency = random.randint(
            300 if version == "v2" else 120,
            1200 if version == "v2" else 350
        )

        rows.append((
            run_id,
            version,
            success,
            latency,
            datetime.now(timezone.utc).isoformat()
        ))

    with sqlite3.connect(DB) as conn:
        conn.executemany("""
            INSERT INTO telemetry
            (run_id, version, success, latency, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, rows)

    return {
        "run_id": run_id,
        "version": version,
        "customers": customers,
        "source": "simulated"
    }

def get_metrics():
    init_db()
    results = []

    with sqlite3.connect(DB) as conn:
        rows = conn.execute("""
            SELECT version,
                   COUNT(*),
                   SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END),
                   AVG(latency)
            FROM telemetry
            GROUP BY version
        """).fetchall()

    for version, total, failures, latency in rows:
        error_rate = round(failures / total * 100, 2)

        if total < 100:
            risk = "INSUFFICIENT_DATA"
        elif error_rate >= 15:
            risk = "HIGH"
        elif error_rate >= 5:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        results.append({
            "version": version,
            "requests": total,
            "failures": failures,
            "successes": total - failures,
            "error_rate": error_rate,
            "avg_latency_ms": round(latency, 2),
            "risk": risk,
            "source": "simulated"
        })

    return results

def get_risk():
    metrics = get_metrics()

    stable = next(
        (m for m in metrics if m["version"] == "v1"),
        None
    )

    release = next(
        (m for m in metrics if m["version"] == "v2"),
        None
    )

    if not stable or not release:
        return {
            "status": "INSUFFICIENT_DATA",
            "recommendation": "Simulate both versions first."
        }

    if min(stable["requests"], release["requests"]) < 100:
        return {
            "status": "INSUFFICIENT_DATA",
            "recommendation": "Collect more samples."
        }

    difference = round(
        release["error_rate"] - stable["error_rate"], 2
    )

    high_risk = (
        release["error_rate"] >= 15
        and difference >= 10
    )

    return {
        "status": "HIGH" if high_risk else "NO_CRITICAL_RISK",
        "stable_error_rate": stable["error_rate"],
        "release_error_rate": release["error_rate"],
        "difference_percentage_points": difference,
        "rollback_recommended": high_risk,
        "human_approval_required": True,
        "source": "simulated"
    }

