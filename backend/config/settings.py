from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()


class TorchSettings(BaseSettings):
    """TORCH application settings loaded from environment variables."""

    # API Keys
    gemini_api_key: str = Field(default="", env="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", env="GEMINI_MODEL")

    # Gmail
    gmail_address: str = Field(default="", env="GMAIL_ADDRESS")
    gmail_app_password: str = Field(default="", env="GMAIL_APP_PASSWORD")
    gmail_smtp_host: str = Field(default="smtp.gmail.com", env="GMAIL_SMTP_HOST")
    gmail_smtp_port: int = Field(default=587, env="GMAIL_SMTP_PORT")
    gmail_imap_host: str = Field(default="imap.gmail.com", env="GMAIL_IMAP_HOST")

    # Voice
    wake_word: str = Field(default="hey torch", env="WAKE_WORD")
    wake_word_sensitivity: float = Field(default=0.5, env="WAKE_WORD_SENSITIVITY")
    whisper_model_size: str = Field(default="base", env="WHISPER_MODEL_SIZE")

    # Screen Watch
    screen_watch_enabled: bool = Field(default=False, env="SCREEN_WATCH_ENABLED")
    screen_watch_interval: int = Field(default=30, env="SCREEN_WATCH_INTERVAL")

    # Server
    host: str = Field(default="0.0.0.0", env="TORCH_HOST")
    port: int = Field(default=8000, env="TORCH_PORT")

    # Paths
    data_dir: str = Field(default="./data", env="TORCH_DATA_DIR")
    db_path: str = Field(default="./data/torch.db", env="TORCH_DB_PATH")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


# Singleton
settings = TorchSettings()
