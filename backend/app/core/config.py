from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    ENCRYPTION_KEY: str
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
