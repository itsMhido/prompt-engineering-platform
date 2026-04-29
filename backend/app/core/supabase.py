from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be configured")
    return create_client(settings.supabase_url, settings.supabase_anon_key)
