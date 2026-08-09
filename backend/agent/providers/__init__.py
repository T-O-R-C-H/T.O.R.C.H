import logging
from typing import Optional
from config.settings import settings
from agent.providers.base import LLMProvider
from agent.providers.gemini_provider import GeminiProvider
from agent.providers.openai_provider import OpenAIProvider
from agent.providers.claude_provider import ClaudeProvider
from agent.providers.deepseek_provider import DeepSeekProvider

# Alias for backwards compatibility
AnthropicProvider = ClaudeProvider

logger = logging.getLogger("torch.providers")

def get_provider(model: Optional[str] = None) -> Optional[LLMProvider]:
    """
    Returns the active LLMProvider instance based on the configured API keys.
    """
    requested_model = (model or "auto").lower()
    if requested_model.startswith("deepseek-"):
        return DeepSeekProvider(settings.deepseek_api_key, model=requested_model) if settings.deepseek_api_key else None
    if requested_model.startswith("claude-"):
        return ClaudeProvider(settings.anthropic_api_key, model=requested_model) if settings.anthropic_api_key else None
    if requested_model.startswith("gemini-"):
        return GeminiProvider(settings.gemini_api_key) if settings.gemini_api_key else None
    if requested_model.startswith(("gpt-", "o1", "o3", "o4")):
        return OpenAIProvider(settings.openai_api_key, model=requested_model) if settings.openai_api_key else None

    # Preserve TORCH's established Gemini path for Auto. DeepSeek remains
    # available when explicitly selected, but an empty DeepSeek balance should
    # not break otherwise healthy automatic planning.
    if settings.gemini_api_key:
        return GeminiProvider(settings.gemini_api_key)
    elif settings.deepseek_api_key:
        return DeepSeekProvider(settings.deepseek_api_key, model=settings.deepseek_model)
    elif settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key)
    elif settings.anthropic_api_key:
        return ClaudeProvider(settings.anthropic_api_key)
    return None
