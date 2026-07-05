from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class LLMProvider(ABC):
    @abstractmethod
    async def plan_command(
        self,
        user_command: str,
        context: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Send user command to the provider and receive a structured execution plan.
        """
        pass

    @abstractmethod
    async def generate_text(self, prompt: str) -> str:
        """
        Generate a text response based on a prompt.
        """
        pass
