import logging
from typing import List, Dict, Any, Optional
from agent.providers.base import LLMProvider

logger = logging.getLogger("torch.providers.anthropic")

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def plan_command(self, user_command: str, context: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        raise NotImplementedError("Anthropic provider is not yet implemented.")

    async def generate_text(self, prompt: str) -> str:
        raise NotImplementedError("Anthropic provider is not yet implemented.")
