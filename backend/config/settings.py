from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()


class TorchSettings(BaseSettings):
    """TORCH application settings loaded from environment variables."""

    # API Keys
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-2.5-flash")

    # Gmail
    gmail_address: str = Field(default="")
    gmail_app_password: str = Field(default="")
    gmail_smtp_host: str = Field(default="smtp.gmail.com")
    gmail_smtp_port: int = Field(default=587)
    gmail_imap_host: str = Field(default="imap.gmail.com")

    # Voice
    wake_word: str = Field(default="hey torch")
    wake_word_sensitivity: float = Field(default=0.5)
    whisper_model_size: str = Field(default="base")

    # Screen Watch
    screen_watch_enabled: bool = Field(default=False)
    screen_watch_interval: int = Field(default=30)

    # Server
    host: str = Field(default="0.0.0.0", alias="TORCH_HOST")
    port: int = Field(default=8000, alias="TORCH_PORT")

    # Paths
    data_dir: str = Field(default="./data", alias="TORCH_DATA_DIR")
    db_path: str = Field(default="./data/torch.db", alias="TORCH_DB_PATH")

    model_config = {
        "env_file": os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True
    }


# Singleton
settings = TorchSettings()
