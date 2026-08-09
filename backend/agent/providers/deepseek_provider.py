"""DeepSeek V4 provider using the official OpenAI-compatible API."""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from openai import OpenAI

from agent.providers.base import LLMProvider
from agent.providers.gemini_provider import AVAILABLE_TOOLS, SYSTEM_PROMPT

logger = logging.getLogger("torch.providers.deepseek")


class DeepSeekProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "deepseek-v4-flash"):
        self.model = model
        self.client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    async def plan_command(
        self,
        user_command: str,
        context: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        tools_desc = "\n".join(
            f"- {tool['name']}({', '.join(tool['params'])}): {tool['description']}"
            + (" [REQUIRES APPROVAL]" if tool.get("hitl") else "")
            for tool in AVAILABLE_TOOLS
        )
        prompt = SYSTEM_PROMPT.format(tools=tools_desc)
        if context:
            recent = context[-4:]
            prompt += "\n\nRecent conversation:\n" + "\n".join(
                f"User: {item.get('user_command', '')}\nTORCH: {item.get('reply_summary', '')}"
                for item in recent
            )
        prompt += f"\n\nUser command: {user_command}"

        active_model = model if model and model.startswith("deepseek-") else self.model
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=active_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4096,
        )
        text = (response.choices[0].message.content or "").strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()
        steps = json.loads(text)
        if not isinstance(steps, list):
            steps = [steps]
        return [
            {
                "tool": step.get("tool", "unknown"),
                "label": step.get("label", f"Step {index + 1}"),
                "args": step.get("args", {}),
                "requires_approval": step.get("requires_approval", False),
            }
            for index, step in enumerate(steps)
        ]

    async def generate_text(self, prompt: str) -> str:
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
