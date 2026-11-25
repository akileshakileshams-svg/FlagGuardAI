import json
import os
import httpx
from fastapi import HTTPException
from risk_engine import get_metrics, get_risk

async def analyse_release(flag_enabled):
    metrics = get_metrics()
    risk = get_risk()

    if not metrics:
        raise HTTPException(409, "Run simulations first")

    payload = {
        "metrics": metrics,
        "risk": risk,
        "data_source": "simulated", "current_flag_enabled": flag_enabled
    }

    prompt = """
You are FlagGuard AI, a release safety analyst.

Analyse only the supplied metrics.
The traffic is simulated, not production traffic.
Do not invent facts or claim a confirmed root cause.
Do not execute any actions. If current_flag_enabled is false, stable V1 is already active. Recommend recovery verification instead of another rollback. Do not invent monitoring deadlines or thresholds.

Provide a concise report with:
1. Release health
2. Failure rate comparison
3. Latency comparison
4. Recommended action
5. Recovery verification

Use simple English and under 100 words. Use five short bullet points. Finish every sentence.

DATA:
""" + json.dumps(payload)

    model = os.getenv("OLLAMA_MODEL", "qwen3.5:2b")

    try:
        async with httpx.AsyncClient(
            timeout=240,
            trust_env=False
        ) as client:

            response = await client.post(
                os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/") + "/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": 0,
                    "options": {
                        "num_ctx": 2048, "num_batch": 32,
                        "num_predict": 300,
                        "temperature": 0.2
                    }
                }
            )

            response.raise_for_status()
            result = response.json()

            analysis = result.get("response", "").strip()

            if not analysis:
                raise HTTPException(502, "Empty AI response")

            return {
                "model": model,
                "analysis": analysis,
                "risk": risk,
                "source": "local_ollama",
                "data_source": "simulated", "current_flag_enabled": flag_enabled,
                "advisory_only": True
            }

    except httpx.TimeoutException:
        raise HTTPException(504, "Local AI response timed out")

    except httpx.HTTPError:
        raise HTTPException(502, "Ollama request failed")




