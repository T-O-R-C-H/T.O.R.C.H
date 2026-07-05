"""
TORCH Agent Brain — Refactored to use LLMProvider
Converts user commands into structured execution plans using the active LLM provider.
"""

import logging
from typing import List, Dict, Any, Optional
from config.settings import settings
from agent.providers import get_provider

logger = logging.getLogger("torch.brain")


async def plan_command(
    user_command: str,
    context: Optional[List[Dict]] = None,
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Send user command to the active LLM provider and receive a structured execution plan.

    Args:
        user_command: The user's natural language command
        context: Optional list of previous messages for context

    Returns:
        List of step dictionaries with tool, label, args, requires_approval
    """
    try:
        import re
        # 1. Detect: "Save this as a skill called [Name]"
        save_match = re.search(r"save this as a skill called (.+)", user_command, re.IGNORECASE)
        if save_match:
            skill_name = save_match.group(1).strip().strip('\'"')
            from memory.storage import db
            # Get the previous command from the tasks database
            tasks = db.get_tasks(limit=1)
            if not tasks:
                return [{
                    "tool": "error",
                    "label": "No previous command found to save as a skill",
                    "args": {},
                    "requires_approval": False,
                    "error": "No previous command found in history."
                }]
            last_cmd = tasks[0]["command"]
            return [{
                "tool": "save_skill",
                "label": f"Saving skill '{skill_name}'",
                "args": {"name": skill_name, "command": last_cmd},
                "requires_approval": False,
            }]

        # 2. Detect: "Run [Name]"
        if user_command.lower().startswith("run "):
            skill_name = user_command[4:].strip().strip('\'"')
            from memory.storage import db
            with db._connect() as conn:
                row = conn.execute(
                    "SELECT id, command FROM skills WHERE LOWER(name) = LOWER(?)",
                    (skill_name,)
                ).fetchone()
            if row:
                skill_id = row["id"]
                stored_command = row["command"]
                # Increment run count
                from skills import run_skill
                run_skill(skill_id)
                # Recursively plan the stored command
                return await plan_command(stored_command, context)

        # Determine the active provider
        provider = get_provider()
        if not provider:
            return [{
                "tool": "error",
                "label": "No AI provider configured",
                "args": {},
                "requires_approval": False,
                "error": "No AI provider configured. Add API key in Settings."
            }]

        return await provider.plan_command(user_command, context, model=model)

    except NotImplementedError as e:
        logger.error(f"Brain provider error: {e}")
        return [{
            "tool": "error",
            "label": "Selected provider not implemented",
            "args": {},
            "requires_approval": False,
            "error": str(e),
        }]
    except Exception as e:
        logger.error(f"Brain error: {e}")
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower() or "limit" in err_msg.lower() or "exhausted" in err_msg.lower():
            return [{
                "tool": "error",
                "label": "AI Provider rate limit hit",
                "args": {},
                "requires_approval": False,
                "error": "Rate limit exceeded. Please try again later or configure another provider."
            }]
        return [{
            "tool": "error",
            "label": f"AI planning failed: {str(e)[:100]}",
            "args": {},
            "requires_approval": False,
            "error": str(e),
        }]
