from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer

from app.core.config import settings
from app.routers import auth, datasets, evaluations, experiments, inference, models, prompts, workspaces, metrics

security = HTTPBearer()


security = HTTPBearer()

app = FastAPI(
    title="Prompt Engineering Platform API", 
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True}
)

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
