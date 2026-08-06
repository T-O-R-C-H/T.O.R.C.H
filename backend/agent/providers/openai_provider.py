"""
OpenAI LLM Provider Stub for TORCH.

To activate this provider:
1. Install the OpenAI Python SDK:
   pip install openai>=1.0.0 (or uncomment in requirements.txt)
2. Add your OpenAI API key in Settings / .env file under OPENAI_API_KEY.
"""

import json
import logging
import asyncio
from typing import List, Dict, Any, Optional

from agent.providers.base import LLMProvider
from agent.providers.gemini_provider import AVAILABLE_TOOLS, SYSTEM_PROMPT

logger = logging.getLogger("torch.providers.openai")

# Dynamic import check for optional openai dependency
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class OpenAIProvider(LLMProvider):
    """
    OpenAI LLM provider implementing the LLMProvider interface.
    """

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        if not HAS_OPENAI:
            raise ImportError("Install openai package to use OpenAI")
        self.api_key = api_key
        self.model = model
        self.client = openai.OpenAI(api_key=self.api_key)

    async def plan_command(
        self,
        user_command: str,
        context: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        try:
            # Build tools description
            tools_desc = "\n".join(
                f"- {t['name']}({', '.join(t['params'])}): {t['description']}"
                + (" [REQUIRES APPROVAL]" if t.get('hitl') else "")
                for t in AVAILABLE_TOOLS
            )

            system = SYSTEM_PROMPT.format(tools=tools_desc)

            # Build message contents
            contents = system + "\n\nUser command: " + user_command
            if context:
                ctx_parts = []
                for ex in context:
                    user_cmd = ex.get("user_command", "")
                    reply = ex.get("reply_summary", "")
                    step_res = ex.get("step_results", [])
                    
                    # Format step results into a readable string
                    step_details = []
                    for idx, step in enumerate(step_res):
                        tool = step.get("tool", "unknown")
                        label = step.get("label", "")
                        status = step.get("status", "unknown")
                        res = step.get("result", "")
                        err = step.get("error", "")
                        
                        detail = f"  - Step {idx}: {label} (tool: {tool}) -> {status}"
                        if status == "done" and res:
                            detail += f", result: {res}"
                        elif status == "failed" and err:
                            detail += f", error: {err}"
                        step_details.append(detail)
                    
                    steps_text = "\n".join(step_details)
                    
                    exchange_str = (
                        f"User command: {user_cmd}\n"
                        f"TORCH response: {reply}\n"
                        f"Execution steps & outcomes:\n{steps_text}"
                    )
                    ctx_parts.append(exchange_str)
                
                ctx_text = "\n\n".join(ctx_parts)
                contents = system + "\n\nConversation context:\n" + ctx_text + "\n\nUser command: " + user_command

            # Call OpenAI GPT-4o
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=model if model and model.startswith(("gpt-", "o1", "o3", "o4")) else self.model,
                messages=[
                    {"role": "user", "content": contents}
                ],
                temperature=0.1,
                max_tokens=4096,
            )

            # Parse response
            text = response.choices[0].message.content.strip()
            # Remove markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text.rsplit("```", 1)[0]
                text = text.strip()

            steps = json.loads(text)

            if not isinstance(steps, list):
                steps = [steps]

            # Validate and normalize steps
            validated = []
            for i, step in enumerate(steps):
                validated.append({
                    "tool": step.get("tool", "unknown"),
                    "label": step.get("label", f"Step {i + 1}"),
                    "args": step.get("args", {}),
                    "requires_approval": step.get("requires_approval", False),
                })

            logger.info(f"Planned {len(validated)} steps for: {user_command[:80]}")
            return validated

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            return [{
                "tool": "error",
                "label": "Failed to parse AI response",
                "args": {},
                "requires_approval": False,
                "error": str(e),
            }]
        except Exception as e:
            logger.error(f"OpenAI planning failed: {e}")
            raise e

    async def generate_text(self, prompt: str) -> str:
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI generate_text failed: {e}")
            raise e
