import os
import sqlite3
from pathlib import Path

ROOT = Path(os.getenv("FLAGGUARD_DATA_DIR", str(Path(__file__).parent)))

def get_replay():
    events = []

    telemetry = ROOT / "telemetry.db"

    if telemetry.exists():
        with sqlite3.connect(telemetry) as conn:
            conn.row_factory = sqlite3.Row

            rows = conn.execute("""
                SELECT run_id, version,
                       COUNT(*) AS requests,
                       SUM(CASE WHEN success = 0
                           THEN 1 ELSE 0 END) AS failures,
                       AVG(latency) AS latency,
                       MAX(created_at) AS timestamp
                FROM telemetry
                GROUP BY run_id, version
            """).fetchall()

            for row in rows:
                rate = round(
                    row["failures"] / row["requests"] * 100, 2
                )

                events.append({
                    "id": row["run_id"],
                    "type": "SIMULATION",
                    "title": f"Checkout {row['version']} tested",
                    "description": (
                        f"{row['requests']} requests, "
                        f"{row['failures']} failures, "
                        f"{rate}% failure rate"
                    ),
                    "error_rate": rate,
                    "latency_ms": round(row["latency"], 2),
                    "timestamp": row["timestamp"],
                    "source": "simulated"
                })

    audit = ROOT / "rollback.db"

    if audit.exists():
        with sqlite3.connect(audit) as conn:
            conn.row_factory = sqlite3.Row

            rows = conn.execute("""
                SELECT * FROM rollback_history
            """).fetchall()

            for row in rows:
                events.append({
                    "id": row["id"],
                    "type": row["status"],
                    "title": f"Rollback: {row['status']}",
                    "description": (
                        f"{row['feature']}: "
                        f"{row['previous_state']} to "
                        f"{row['new_state']}"
                    ),
                    "timestamp": row["created_at"],
                    "source": "management_audit"
                })

    return sorted(
        events,
        key=lambda event: event["timestamp"]
    )[-200:]

