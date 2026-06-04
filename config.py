from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 1. LLM Settings
    LLM_API_KEY: str
    LLM_PROVIDER: str = "groq"
    LLM_MODEL_ID: str = "llama-3.3-70b-versatile"
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MAX_TOKENS: int = 500
    LLM_TEMPERATURE: float = 0.3

    # 2. Zoho Settings
    ZOHO_CLIENT_ID: str
    ZOHO_CLIENT_SECRET: str
    SCOPE_NAME: str
    ZOHO_REFRESH_TOKEN: str

    # 3. Database Settings
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    DB_NAME: str
    DB_PORT: int

    # 4. PgAdmin Settings
    PGADMIN_EMAIL: str
    PGADMIN_PASSWORD: str

    # Batch Processing
    BATCH_INTERVAL_MINUTES: int = 30

    # Pydantic v2 configuration
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# Instantiate settings
settings = Settings()
