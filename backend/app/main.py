from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.routers import auth, datasets, evaluations, experiments, inference, models, prompts, workspaces, metrics

security = HTTPBearer()

# Create limiter — uses client IP as the key
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Prompt Engineering Platform API", 
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True}
)

# Attach limiter to app state
app.state.limiter = limiter

# Add rate limit exceeded handler — returns clean 429 JSON response
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait before trying again.",
            "retryAfter": str(exc.retry_after) if hasattr(exc, 'retry_after') else "60"
        }
    )

app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["prompts"])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(experiments.router, prefix="/api/experiments", tags=["experiments"])
app.include_router(inference.router, prefix="/api/inference", tags=["inference"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["evaluations"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])

@app.get("/health")
def health():
    return {"status": "ok"}
