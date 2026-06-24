from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()


class TorchSettings(BaseSettings):
    """TORCH application settings loaded from environment variables."""

    # API Keys
    gemini_api_key: str = Field(default="AIzaSyTrialCloudKeyPlaceholder", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")

    # Gmail
    gmail_address: str = Field(default="", alias="GMAIL_ADDRESS")
    gmail_app_password: str = Field(default="", alias="GMAIL_APP_PASSWORD")
    gmail_smtp_host: str = Field(default="smtp.gmail.com", alias="GMAIL_SMTP_HOST")
    gmail_smtp_port: int = Field(default=587, alias="GMAIL_SMTP_PORT")
    gmail_imap_host: str = Field(default="imap.gmail.com", alias="GMAIL_IMAP_HOST")

    # Voice
    wake_word: str = Field(default="hey torch", alias="WAKE_WORD")
    wake_word_sensitivity: float = Field(default=0.5, alias="WAKE_WORD_SENSITIVITY")
    whisper_model_size: str = Field(default="base", alias="WHISPER_MODEL_SIZE")

    # Screen Watch
    screen_watch_enabled: bool = Field(default=False, alias="SCREEN_WATCH_ENABLED")
    screen_watch_interval: int = Field(default=30, alias="SCREEN_WATCH_INTERVAL")

    # Agent retry handling
    agent_retry_enabled: bool = Field(default=True, alias="TORCH_AGENT_RETRY_ENABLED")
    agent_retry_attempts: int = Field(default=2, alias="TORCH_AGENT_RETRY_ATTEMPTS")
    agent_retry_delay_seconds: float = Field(default=0.5, alias="TORCH_AGENT_RETRY_DELAY_SECONDS")
    agent_retry_tools: str = Field(
        default="find_file,list_directory,read_pdf,read_word,read_excel,read_inbox,open_browser,search_web,download_file,screenshot,analyse_screen",
        alias="TORCH_AGENT_RETRY_TOOLS",
    )

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
