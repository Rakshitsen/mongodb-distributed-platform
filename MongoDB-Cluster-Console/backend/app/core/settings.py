from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MongoDB Infra Learning Platform"
    environment: str = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    mongo_uri: str = "mongodb://127.0.0.1:27017"
    mongo_database: str = "infra_learning"
    log_level: str = "INFO"


settings = Settings()

