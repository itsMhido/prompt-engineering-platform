import ipaddress
from urllib.parse import urlparse
from fastapi import HTTPException

# Allowlist of permitted provider hostnames
ALLOWED_PROVIDER_HOSTS = {
    "api.anthropic.com",
    "api.openai.com",
    "api.groq.com",
    "api.mistral.ai",
    "generativelanguage.googleapis.com",
    "router.huggingface.co",
    "api-inference.huggingface.co",
    "huggingface.co",
}

# Private/reserved IP ranges to block
BLOCKED_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # AWS/cloud metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

def validate_endpoint_url(url: str) -> None:
    """
    Validates that a provider endpoint URL is safe to call.
    Raises HTTPException if the URL is suspicious or blocked.
    """
    if not url:
        return
        
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid endpoint URL")

    # Must be HTTPS (except localhost for development)
    if parsed.scheme not in ("https", "http"):
        raise HTTPException(status_code=400, detail="Endpoint must use HTTP or HTTPS")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid endpoint hostname")

    # Block direct IP address access
    try:
        ip = ipaddress.ip_address(hostname)
        # If it's an IP, check if it's in a blocked range
        for blocked_range in BLOCKED_IP_RANGES:
            if ip in blocked_range:
                raise HTTPException(
                    status_code=400,
                    detail="Endpoint IP address is not allowed"
                )
    except ValueError:
        # Not an IP address — it's a hostname, check allowlist
        # Allow exact matches or subdomain matches
        is_allowed = any(
            hostname == allowed or hostname.endswith(f".{allowed}")
            for allowed in ALLOWED_PROVIDER_HOSTS
        )
        if not is_allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Endpoint hostname '{hostname}' is not in the list of "
                       f"permitted providers. For custom endpoints, contact support."
            )
