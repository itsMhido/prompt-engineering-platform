import httpx
import time
from app.services.crypto import decrypt
from app.services.cost import calculate_cost

async def call_provider(model, system_prompt: str, user_message: str) -> dict:
    """
    Routes to the correct AI provider based on model.provider.
    Decrypts the API key, formats the request, normalizes the response.

    Returns:
    {
        "output": str,
        "latency": int,          # ms
        "input_tokens": int,
        "output_tokens": int,
        "total_tokens": int,
        "cost_estimate": float,  # always a float, never a string
        "status": "success" | "error",
        "error_message": str | None
    }
    """
    api_key = decrypt(model.api_key_encrypted)
    provider = model.provider.lower()
    start_time = time.time()

    try:
        if provider == "anthropic":
            result = await _call_anthropic(model, api_key, system_prompt, user_message)
        elif provider in ("openai", "mistral", "groq"):
            result = await _call_openai_compatible(model, api_key, system_prompt, user_message)
        elif provider == "google":
            result = await _call_google(model, api_key, system_prompt, user_message)
        else:
            # Custom — attempt OpenAI-compatible format
            result = await _call_openai_compatible(model, api_key, system_prompt, user_message)

        latency = int((time.time() - start_time) * 1000)
        cost = calculate_cost(model.model_id, result["input_tokens"], result["output_tokens"])

        return {
            "output": result["output"],
            "latency": latency,
            "input_tokens": result["input_tokens"],
            "output_tokens": result["output_tokens"],
            "total_tokens": result["input_tokens"] + result["output_tokens"],
            "cost_estimate": cost,
            "status": "success",
            "error_message": None
        }

    except Exception as e:
        latency = int((time.time() - start_time) * 1000)
        return {
            "output": None,
            "latency": latency,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost_estimate": 0.0,
            "status": "error",
            "error_message": str(e)
        }


async def _call_anthropic(model, api_key: str, system_prompt: str, user_message: str) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": model.model_id,
                "max_tokens": model.max_tokens,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}]
            }
        )
        data = response.json()
        if response.status_code != 200:
            raise Exception(data.get("error", {}).get("message", "Anthropic API error"))
        return {
            "output": data["content"][0]["text"],
            "input_tokens": data["usage"]["input_tokens"],
            "output_tokens": data["usage"]["output_tokens"]
        }


async def _call_openai_compatible(model, api_key: str, system_prompt: str, user_message: str) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            model.endpoint,
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json"
            },
            json={
                "model": model.model_id,
                "max_tokens": model.max_tokens,
                "temperature": model.temperature,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ]
            }
        )
        data = response.json()
        if response.status_code != 200:
            raise Exception(data.get("error", {}).get("message", "API error"))
        return {
            "output": data["choices"][0]["message"]["content"],
            "input_tokens": data["usage"]["prompt_tokens"],
            "output_tokens": data["usage"]["completion_tokens"]
        }


async def _call_google(model, api_key: str, system_prompt: str, user_message: str) -> dict:
    # Interpolate model_id into URL — CRITICAL: must replace {model} placeholder
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model.model_id}:generateContent"
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            params={"key": api_key},   # API key as query param, NOT header
            headers={"content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": user_message}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {
                    "maxOutputTokens": model.max_tokens,
                    "temperature": model.temperature
                }
            }
        )
        data = response.json()
        if response.status_code != 200:
            error_msg = data.get("error", {}).get("message", "Google API error")
            raise Exception(error_msg)
        usage = data.get("usageMetadata", {})
        return {
            "output": data["candidates"][0]["content"]["parts"][0]["text"],
            "input_tokens": usage.get("promptTokenCount", 0),
            "output_tokens": usage.get("candidatesTokenCount", 0)
        }
