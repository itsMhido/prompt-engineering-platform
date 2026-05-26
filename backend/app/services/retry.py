import asyncio
import random
import httpx
from typing import Callable, Any

class RateLimitError(Exception):
    """Raised when a provider returns a rate limit response"""
    def __init__(self, message: str, retry_after: float = None):
        super().__init__(message)
        self.retry_after = retry_after

async def with_exponential_backoff(
    func: Callable,
    max_retries: int = 4,
    base_delay: float = 2.0,
    max_delay: float = 60.0,
    jitter: bool = True
) -> Any:
    """
    Calls func() and retries with exponential backoff on rate limit errors.

    Retry schedule (approximate):
    - Attempt 1: immediate
    - Attempt 2: ~2s
    - Attempt 3: ~4s
    - Attempt 4: ~8s
    - Attempt 5: ~16s
    After max_retries exhausted: raises the last exception
    """
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            return await func()
            
        except RateLimitError as e:
            last_error = e
            
            if attempt == max_retries:
                raise
                
            # Use provider's retry-after if available, otherwise exponential backoff
            if e.retry_after:
                delay = min(e.retry_after, max_delay)
            else:
                delay = min(base_delay * (2 ** attempt), max_delay)
                
            if jitter:
                delay = delay * (0.5 + random.random() * 0.5)
                
            print(f"Rate limited. Attempt {attempt + 1}/{max_retries}. Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)
            
        except Exception as e:
            # Non-rate-limit errors are not retried
            raise
            
    raise last_error
