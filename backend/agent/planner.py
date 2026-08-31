"""
TORCH Agent Planner
Validates and enriches the execution plan from the brain.
"""

import uuid
import logging
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger("torch.planner")

# Tools that always require HITL approval (HIDE-4)
HITL_TOOLS = {
    "send_email",
    "post_social",
    "send_message",
    "delete_file",
    "download_file",
    "run_terminal",  # Terminal commands that modify system
}

# Tools that exist in the system
VALID_TOOLS = {
    "find_file", "find_file_fuzzy", "list_directory", "read_pdf", "read_word", "read_excel",
    "send_email", "read_inbox", "open_browser", "click",
    "type_text", "screenshot", "analyse_screen", "search_web",
    "download_file", "open_app", "post_social", "send_message",
    "run_terminal", "move_file", "delete_file", "create_folder",
    "zip_files", "vision_control", "error", "save_skill", "respond",
    "read_screen", "click_element", "type_into", "describe_screen",
}


# Vision control can otherwise reach consequential UI paths that have dedicated
# HITL tools. Keep ordinary navigation approval-free, but require confirmation
# when the actual vision task clearly asks for an external or system change.
VISION_HITL_PATTERNS = (
    re.compile(
        r"\b(?:buy|purchase|checkout|pay|donate|subscribe)\b|"
        r"\bplace\s+(?:the|an?|my|your)\s+order\b|"
        r"\b(?:complete|make|confirm|authorize|send)\s+"
        r"(?:the\s+|an?\s+)?(?:payment|purchase|transaction)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:send|upload)\b|"
        r"\b(?:post|publish|share)\s+(?:this|that|the|an?|my|our|your|it)\b|"
        r"\bsubmit\s+(?:this|that|the|an?|my|our|your)\s+"
        r"(?:form|application|document|file|message|post)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:delete|erase|uninstall)\b|"
        r"\bempty\s+(?:the\s+)?(?:trash|recycle\s+bin)\b|"
        r"\bremove\s+(?:the\s+|an?\s+|my\s+|your\s+)?"
        r"(?:file|folder|account|application|app|program|extension|document|data)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:terminal|powershell|command\s+prompt|cmd(?:\.exe)?|"
        r"regedit|registry|execution\s+policy)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:disable|enable|turn\s+(?:on|off)|change|modify|configure|reset)\b"
        r".{0,80}\b(?:security\s+settings?|firewall|windows\s+defender|antivirus)\b|"
        r"\b(?:security\s+settings?|firewall|windows\s+defender|antivirus)\b"
        r".{0,80}\b(?:disable|enable|turn\s+(?:on|off)|change|modify|configure|reset)\b",
        re.IGNORECASE,
    ),
)

SPOTIFY_PLAYBACK_VISION_TASK = re.compile(
    r"^navigate\s+to\s+(?:https?://)?open\.spotify\.com,\s*"
    r"search\s+for\s+.+,\s*and\s+play\s+the\s+track[.!]?$",
    re.IGNORECASE,
)


# Capabilities the user can switch off during onboarding or in Settings. A
# disabled capability blocks its tools here, in the planner, rather than
# relying on the model to leave them out of the plan.
CAPABILITY_TOOLS = {
    "files": {
        "find_file", "find_file_fuzzy", "list_directory", "read_pdf", "read_word",
        "read_excel", "move_file", "delete_file", "create_folder", "zip_files",
    },
    "apps": {
        "open_app", "run_terminal", "vision_control",
        "read_screen", "click_element", "type_into", "describe_screen",
    },
    "email": {"send_email", "read_inbox"},
}

CAPABILITY_REFUSALS = {
    "files": "File access is switched off, so I can't look through your files. You can turn it back on in Settings.",
    "apps": "Opening apps is switched off, so I can't do that. You can turn it back on in Settings.",
    "email": "Email access is switched off, so I can't reach your inbox. You can turn it back on in Settings.",
}


def _disabled_capability(tool: str) -> Optional[str]:
    """Return the capability blocking this tool, or None when it is allowed."""
    from config.settings import settings

    enabled = {
        "files": settings.allow_files,
        "apps": settings.allow_apps,
        "email": settings.allow_email,
    }
    for capability, tools in CAPABILITY_TOOLS.items():
        if tool in tools and not enabled[capability]:
            return capability
    return None


def _vision_task_requires_approval(tool: str, tool_args: Any) -> bool:
    if tool != "vision_control" or not isinstance(tool_args, dict):
        return False
    task = str(tool_args.get("task") or "").strip()
    if SPOTIFY_PLAYBACK_VISION_TASK.fullmatch(task):
        return False
    return bool(task) and any(pattern.search(task) for pattern in VISION_HITL_PATTERNS)


def validate_plan(raw_steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Validate and enrich a raw plan from the brain.

    - Assigns unique IDs to each step
    - Validates tool names exist
    - Enforces HITL for dangerous tools
    - Sets initial status to 'pending'

    Returns:
        List of validated step dictionaries ready for execution
    """
    validated_steps = []
    from agent.step_phrasing import get_plain_phrase
    from errors.plain_language import translate_error

    for i, step in enumerate(raw_steps):
        tool = step.get("tool", "unknown")

        # Validate tool exists
        if tool not in VALID_TOOLS and tool != "error":
            logger.warning(f"Unknown tool: {tool}, marking as error")
            # Rebind the local too: everything below (approval policy, phrasing,
            # the validated step itself) reads `tool`, so mutating only the
            # incoming dict would let the unknown name through unchanged.
            step["tool"] = tool = "error"
            # This plan is sent to the UI before execution starts, so the error
            # has to be readable now — not only once the executor reaches it.
            step["error"] = translate_error("Unknown tool")["what_happened"]

        blocked_by = _disabled_capability(tool)
        if blocked_by:
            logger.info(f"Tool {tool} blocked: {blocked_by} capability is disabled")
            step["tool"] = tool = "error"
            step["error"] = CAPABILITY_REFUSALS[blocked_by]

        tool_args = step.get("args", {})

        # Approval is policy-controlled, not model-controlled. Otherwise an LLM
        # can accidentally leave a read-only search waiting forever in clients
        # that do not render an approval prompt (such as the compact overlay).
        requires_approval = (
            tool in HITL_TOOLS or _vision_task_requires_approval(tool, tool_args)
        )

        provided_label = str(step.get("label") or "").strip()
        plain_label = provided_label or get_plain_phrase(tool, tool_args, "pending")

        validated_step = {
            "id": str(uuid.uuid4()),
            "tool": tool,
            "label": plain_label,
            "args": tool_args,
            "status": "pending",
            "requires_approval": requires_approval,
            "result": None,
            "error": step.get("error"),
        }

        validated_steps.append(validated_step)

    logger.info(
        f"Validated plan: {len(validated_steps)} steps, "
        f"{sum(1 for s in validated_steps if s['requires_approval'])} require approval"
    )

    return validated_steps


def create_response_message(
    content: str,
    steps: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Create a TORCH response message with steps for the frontend."""
    return {
        "id": str(uuid.uuid4()),
        "role": "torch",
        "content": content,
        "timestamp": __import__("time").time() * 1000,
        "steps": [
            {
                "id": s["id"],
                "label": s["label"],
                "tool": s["tool"],
                "args": s["args"],
                "status": s["status"],
                "requiresApproval": s["requires_approval"],
                "result": s.get("result"),
                "error": s.get("error"),
            }
            for s in steps
        ],
    }
