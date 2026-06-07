"""
Claude LLM Provider Stub for TORCH.

To activate this provider:
1. Install the Anthropic Python SDK:
   pip install anthropic>=0.18.0 (or uncomment in requirements.txt)
2. Add your Anthropic API key in Settings / .env file under ANTHROPIC_API_KEY.
"""

import json
import logging
from typing import List, Dict, Any, Optional

from agent.providers.base import LLMProvider
from agent.providers.gemini_provider import AVAILABLE_TOOLS, SYSTEM_PROMPT

logger = logging.getLogger("torch.providers.claude")

# Dynamic import check for optional anthropic dependency
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class ClaudeProvider(LLMProvider):
    """
    Claude LLM provider implementing the LLMProvider interface.
    """

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        if not HAS_ANTHROPIC:
            raise ImportError("Install anthropic package to use Claude")
        self.api_key = api_key
        self.model = model
        self.client = anthropic.Anthropic(api_key=self.api_key)

    async def plan_command(self, user_command: str, context: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
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

            # Call Anthropic Claude
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.1,
                messages=[
                    {"role": "user", "content": contents}
                ],
            )

            # Parse response
            text = response.content[0].text.strip()
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
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            return [{
                "tool": "error",
                "label": "Failed to parse AI response",
                "args": {},
                "requires_approval": False,
                "error": str(e),
            }]
        except Exception as e:
            logger.error(f"Claude planning failed: {e}")
            raise e

    async def generate_text(self, prompt: str) -> str:
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Claude generate_text failed: {e}")
            raise e
