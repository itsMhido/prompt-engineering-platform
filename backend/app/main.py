from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, health, prompts
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401

app = FastAPI(title="Prompt Engineering Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Bootstrap schema for local/dev. Use migrations in production.
    Base.metadata.create_all(bind=engine)


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
