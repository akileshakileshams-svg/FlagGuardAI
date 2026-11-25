import os
import httpx
from fastapi import HTTPException
from datetime import datetime, timezone

async def get_experiment():
    key = os.getenv("FLAGSMITH_ADMIN_API_KEY")
    env_key = os.getenv("FLAGSMITH_ENVIRONMENT_KEY")
    experiment_id = os.getenv("FLAGSMITH_EXPERIMENT_ID", "1")

    if not key or not env_key:
        raise HTTPException(503, "Flagsmith credentials missing")

    base = os.getenv(
        "FLAGSMITH_API_URL",
        "http://127.0.0.1:8000/api/v1"
    ).rstrip("/")

    url = f"{base}/environments/{env_key}/experiments/{experiment_id}/"
    headers = {"Authorization": f"Api-Key {key}"}

    try:
        async with httpx.AsyncClient(
            timeout=20, trust_env=False
        ) as client:
            config_response = await client.get(
                url, headers=headers
            )
            config_response.raise_for_status()

            results_response = await client.get(
                url + "results/", headers=headers
            )
            results_response.raise_for_status()

        config = config_response.json()
        result = results_response.json().get("results") or {}
        payload = result.get("payload") or {}

        feature = config.get("feature") or {}
        options = feature.get("multivariate_options") or []

        labels = {"control": "Standard Checkout"}
        for option in options:
            key_name = option.get("key")
            if key_name:
                labels[key_name] = (
                    "Express Checkout"
                    if option.get("string_value") == "express"
                    else str(option.get("string_value") or key_name)
                )

        metric_id = (config.get("metrics") or [{}])[0].get("metric")

        metric = next(
            (m for m in payload.get("metrics", [])
             if m.get("metric_id") == metric_id),
            {}
        )

        variants = metric.get("variants") or {}
        inference = metric.get("inference") or {}

        rows = []

        for name, data in variants.items():
            n = data.get("n", 0)
            conversions = data.get("sum", 0)
            stats = inference.get(name) or {}

            rows.append({
                "key": name,
                "name": labels.get(name, name),
                "users": n,
                "conversions": conversions,
                "conversion_rate": round(
                    conversions / n * 100, 2
                ) if n else None,
                "lift": stats.get("lift"),
                "chance_to_win": stats.get("chance_to_win"),
                "ci_low": stats.get("ci_low"),
                "ci_high": stats.get("ci_high")
            })

        candidate = max(
            [r for r in rows
             if r["chance_to_win"] is not None],
            key=lambda r: r["chance_to_win"],
            default=None
        )

        return {
            "id": config["id"],
            "name": config["name"],
            "status": config["status"],
            "hypothesis": config.get("hypothesis"),
            "feature": feature.get("name"),
            "users": sum(r["users"] for r in rows),
            "conversions": sum(
                r["conversions"] for r in rows
            ),
            "variants": rows,
            "candidate": candidate,
            "as_of": result.get("as_of"),
            "last_error_at": result.get("last_error_at"),
            "is_final": result.get("is_final", False),
            "source": "flagsmith_native",
            "data_source": "simulated_and_manual_demo_test",
            "retrieved_at": datetime.now(
                timezone.utc
            ).isoformat()
        }

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            502,
            f"Flagsmith returned HTTP {exc.response.status_code}"
        )
    except httpx.RequestError:
        raise HTTPException(
            502, "Flagsmith connection failed"
        )

