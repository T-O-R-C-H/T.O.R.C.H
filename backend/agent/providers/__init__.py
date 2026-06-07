import logging
from typing import Optional
from config.settings import settings
from agent.providers.base import LLMProvider
from agent.providers.gemini_provider import GeminiProvider
from agent.providers.openai_provider import OpenAIProvider
from agent.providers.claude_provider import ClaudeProvider

# Alias for backwards compatibility
AnthropicProvider = ClaudeProvider

logger = logging.getLogger("torch.providers")

def get_provider() -> Optional[LLMProvider]:
    """
    Returns the active LLMProvider instance based on the configured API keys.
    """
    if settings.gemini_api_key:
        return GeminiProvider(settings.gemini_api_key)
    elif settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key)
    elif settings.anthropic_api_key:
        return ClaudeProvider(settings.anthropic_api_key)
    return None
