"""
Ollama Provider for TORCH Backend.
Provides 100% local, offline planning and text generation via Ollama REST API.
"""

import json
import logging
import asyncio
import re
from typing import List, Dict, Any, Optional
import httpx

from config.settings import settings
from agent.providers.base import LLMProvider
from agent.providers.gemini_provider import AVAILABLE_TOOLS, CONVERSATIONAL_PATTERNS

logger = logging.getLogger("torch.providers.ollama")

OLLAMA_BASE_URL = getattr(settings, "ollama_url", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = getattr(settings, "ollama_model", "llama3.2")


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = OLLAMA_BASE_URL, default_model: str = DEFAULT_OLLAMA_MODEL):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model

    async def plan_command(
        self,
        user_command: str,
        context: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        target_model = model or self.default_model
        cmd = user_command.strip()

        # Check conversational patterns
        for pattern in CONVERSATIONAL_PATTERNS:
            if re.search(pattern, cmd, re.IGNORECASE):
                logger.info(f"Conversational pattern matched for Ollama: {cmd}")
                return [{
                    "id": "step_0",
                    "tool": "respond",
                    "args": {"message": f"Hello! How can I help you on your PC today?"},
                    "status": "pending",
                    "requires_approval": False
                }]

        system_prompt = (
            "You are TORCH, an autonomous desktop AI assistant. "
            "Convert the user command into a structured JSON execution plan.\n"
            "Respond ONLY with a valid JSON array of step objects.\n"
            "Each step object must have keys: id (string), tool (string), args (object), status ('pending'), requires_approval (boolean).\n"
            f"Available tools: {json.dumps(AVAILABLE_TOOLS)}"
        )

        prompt = f"User Command: {cmd}"
        if context:
            prompt = f"Context: {json.dumps(context[-3:])}\n" + prompt

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": target_model,
                        "prompt": prompt,
                        "system": system_prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                response_text = data.get("response", "").strip()

                # Extract JSON array
                match = re.search(r"\[.*\]", response_text, re.DOTALL)
                if match:
                    steps = json.loads(match.group(0))
                    if isinstance(steps, list) and len(steps) > 0:
                        return steps
        except Exception as e:
            logger.warning(f"Ollama plan generation failed ({e}), falling back to respond step")

        return [{
            "id": "step_0",
            "tool": "respond",
            "args": {"message": f"I processed your request: '{user_command}'"},
            "status": "pending",
            "requires_approval": False
        }]

    async def generate_text(self, prompt: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.default_model,
                        "prompt": prompt,
                        "stream": False,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("response", "").strip()
        except Exception as e:
            logger.error(f"Ollama generate_text error: {e}")
            return "I am currently unable to reach the local Ollama service."
