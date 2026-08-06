"""
TORCH Agent Brain — Refactored to use LLMProvider
Converts user commands into structured execution plans using the active LLM provider.
"""

import logging
import re
from typing import List, Dict, Any, Optional
from config.settings import settings
from agent.providers import get_provider

logger = logging.getLogger("torch.brain")


_SPOTIFY_PLAY_REQUEST = re.compile(
    r"^(?:(?:please\s+)?(?:can|could|would|will)\s+you\s+)?"
    r"(?:please\s+)?play\s+(?P<query>.+?)\s+on\s+spotify"
    r"(?:\s+please)?[.!?]*$",
    re.IGNORECASE,
)


def _spotify_play_plan(user_command: str) -> Optional[List[Dict[str, Any]]]:
    """Return the canonical Spotify plan for an exact play request.

    The desktop status block is appended to planner input after a blank line.
    Matching only the first request line keeps that context out of the search
    query while still allowing the deterministic route to be used.
    """
    request_line = user_command.splitlines()[0].strip() if user_command else ""
    match = _SPOTIFY_PLAY_REQUEST.fullmatch(request_line)
    if not match:
        return None

    query = match.group("query").strip()
    if not query:
        return None

    return [
        {
            "tool": "open_app",
            "label": "Opening Chrome",
            "args": {"name": "chrome"},
            "requires_approval": False,
        },
        {
            "tool": "vision_control",
            "label": "Finding and playing your track on Spotify",
            "args": {
                "task": (
                    "Navigate to open.spotify.com, search for "
                    f"{query}, and play the track"
                )
            },
            "requires_approval": False,
        },
    ]


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
        spotify_plan = _spotify_play_plan(user_command)
        if spotify_plan is not None:
            return spotify_plan

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

        # Teaching and explanatory questions do not need the heavyweight tool planner.
        # Route them through a compact text-generation prompt for a much faster reply.
        teaching_request = re.search(
            r"\b(teach me|can you teach|how (?:do|can) i (?:use|learn)|explain how|show me how)\b",
            user_command,
            re.IGNORECASE,
        )
        if teaching_request:
            provider = get_provider(model)
            if not provider:
                return [{
                    "tool": "error",
                    "label": "No AI provider configured",
                    "args": {},
                    "requires_approval": False,
                    "error": "No AI provider configured. Add an API key in Settings.",
                }]
            lesson = await provider.generate_text(
                "You are TORCH, a patient expert teacher. Answer the user's request directly. "
                "Start with a useful beginner lesson, use short clear steps, include one practical "
                "exercise they can do now, and end with one focused question. Do not disclaim that "
                "you are not a human teacher and do not redirect them to tutorials.\n\n"
                f"User request: {user_command}"
            )
            return [{
                "tool": "respond",
                "label": "Teaching",
                "args": {"message": lesson},
                "requires_approval": False,
            }]

        # Determine the active provider
        provider = get_provider(model)
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
