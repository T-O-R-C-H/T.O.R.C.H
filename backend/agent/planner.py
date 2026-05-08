"""
TORCH Agent Planner
Validates and enriches the execution plan from the brain.
"""

import uuid
import logging
from typing import List, Dict, Any

logger = logging.getLogger("torch.planner")

# Tools that always require HITL approval
HITL_TOOLS = {
    "send_email",
    "post_social",
    "send_message",
    "delete_file",
    "run_terminal",  # Terminal commands that modify system
}

# Tools that exist in the system
VALID_TOOLS = {
    "find_file", "read_pdf", "read_word", "read_excel",
    "send_email", "read_inbox", "open_browser", "click",
    "type_text", "screenshot", "analyse_screen", "search_web",
    "download_file", "open_app", "post_social", "send_message",
    "run_terminal", "move_file", "delete_file", "create_folder",
    "zip_files", "error",
}


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

    for i, step in enumerate(raw_steps):
        tool = step.get("tool", "unknown")

        # Validate tool exists
        if tool not in VALID_TOOLS and tool != "error":
            logger.warning(f"Unknown tool: {tool}, marking as error")
            step["tool"] = "error"
            step["error"] = f"Unknown tool: {tool}"

        # Force HITL for dangerous tools
        requires_approval = step.get("requires_approval", False)
        if tool in HITL_TOOLS:
            requires_approval = True

        validated_step = {
            "id": str(uuid.uuid4()),
            "tool": tool,
            "label": step.get("label", f"Step {i + 1}"),
            "args": step.get("args", {}),
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
