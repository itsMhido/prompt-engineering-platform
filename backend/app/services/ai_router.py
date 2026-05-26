import httpx
import time
import asyncio
import re
from app.services.crypto import decrypt
from app.services.cost import calculate_cost
from app.services.retry import RateLimitError, with_exponential_backoff

def _check_rate_limit(response_data: dict, status_code: int, provider: str):
    """Check if response is a rate limit error and raise RateLimitError if so"""
    if status_code == 429:
        retry_after = None
        error_msg = str(response_data)
        match = re.search(r'try again in (\d+\.?\d*)s', error_msg)
        if match:
            retry_after = float(match.group(1)) + 1.0  # add 1s buffer
            
        raise RateLimitError(
            f"{provider} rate limit exceeded: {response_data}",
            retry_after=retry_after
        )

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
        
        _check_rate_limit(data, response.status_code, "Anthropic")
        
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
        
        _check_rate_limit(data, response.status_code, "OpenAI-Compatible")
        
        if response.status_code != 200:
            raise Exception(data.get("error", {}).get("message", "API error"))
        return {
            "output": data["choices"][0]["message"]["content"],
            "input_tokens": data["usage"]["prompt_tokens"],
            "output_tokens": data["usage"]["completion_tokens"]
        }

async def _call_google(model, api_key: str, system_prompt: str, user_message: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model.model_id}:generateContent"
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            params={"key": api_key},
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
        
        _check_rate_limit(data, response.status_code, "Google")
        
        if response.status_code != 200:
            error_msg = data.get("error", {}).get("message", "Google API error")
            raise Exception(error_msg)
        usage = data.get("usageMetadata", {})
        return {
            "output": data["candidates"][0]["content"]["parts"][0]["text"],
            "input_tokens": usage.get("promptTokenCount", 0),
            "output_tokens": usage.get("candidatesTokenCount", 0)
        }

async def call_provider(model, system_prompt: str, user_message: str) -> dict:
    api_key = decrypt(model.api_key_encrypted)
    provider = model.provider.lower()
    start_time = time.time()

    async def _make_call():
        if provider == "anthropic":
            return await _call_anthropic(model, api_key, system_prompt, user_message)
        elif provider in ("openai", "mistral", "groq"):
            return await _call_openai_compatible(model, api_key, system_prompt, user_message)
        elif provider == "google":
            return await _call_google(model, api_key, system_prompt, user_message)
        else:
            return await _call_openai_compatible(model, api_key, system_prompt, user_message)

    try:
        result = await with_exponential_backoff(
            _make_call,
            max_retries=4,
            base_delay=2.0,
            max_delay=60.0
        )
        
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
