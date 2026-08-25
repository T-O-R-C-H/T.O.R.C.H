"""
Approval policy.

Which tools pause for confirmation is a safety boundary, and it is decided in
Python rather than by the model — a plan that claims otherwise must not be able
to talk its way past it.
"""

import pytest

from agent.planner import HITL_TOOLS, validate_plan


def _plan(tool, args=None):
    return validate_plan([{"tool": tool, "label": "", "args": args or {}}])[0]


# ─── Destructive and outbound tools always confirm ───


@pytest.mark.parametrize("tool", sorted(HITL_TOOLS))
def test_risky_tools_require_approval(tool):
    assert _plan(tool)["requires_approval"] is True


@pytest.mark.parametrize(
    "tool",
    ["find_file", "read_pdf", "list_directory", "search_web", "screenshot", "open_app"],
)
def test_read_only_tools_do_not_require_approval(tool):
    """Prompting on read-only steps trains users to click through approvals."""
    assert _plan(tool)["requires_approval"] is False


def test_model_cannot_lower_approval_requirement():
    """A plan asking to skip confirmation on a destructive tool is overridden."""
    step = validate_plan(
        [{"tool": "delete_file", "label": "", "args": {}, "requires_approval": False}]
    )[0]
    assert step["requires_approval"] is True


# ─── Vision control is gated on what the task actually does ───


@pytest.mark.parametrize(
    "task",
    [
        "buy the blue shirt in my cart",
        "complete the payment",
        "send this message to my manager",
        "upload the report",
        "delete the old folder",
        "uninstall that program",
        "open powershell and run the script",
        "disable windows defender",
    ],
)
def test_consequential_vision_tasks_require_approval(task):
    assert _plan("vision_control", {"task": task})["requires_approval"] is True


@pytest.mark.parametrize(
    "task",
    [
        "scroll down the page",
        "open the settings menu",
        "read what is on screen",
    ],
)
def test_ordinary_vision_navigation_does_not_require_approval(task):
    assert _plan("vision_control", {"task": task})["requires_approval"] is False


def test_spotify_playback_is_pre_approved():
    """A known-safe deterministic flow stays approval-free despite 'play'."""
    task = "navigate to open.spotify.com, search for Doja Cat, and play the track"
    assert _plan("vision_control", {"task": task})["requires_approval"] is False


# ─── Unknown tools ───


def test_unknown_tool_is_marked_as_error():
    step = _plan("send_fax")
    assert step["tool"] == "error"


def test_unknown_tool_error_is_plain_language():
    """
    The plan reaches the chat before execution starts, so this string is shown
    to the user as-is. It must not leak the tool name or internal wording.
    """
    error = _plan("send_fax")["error"]
    assert error
    assert "send_fax" not in error
    assert "unknown tool" not in error.lower()


# ─── Structure ───


def test_validated_steps_get_unique_ids_and_pending_status():
    steps = validate_plan(
        [
            {"tool": "find_file", "label": "", "args": {}},
            {"tool": "find_file", "label": "", "args": {}},
        ]
    )
    assert steps[0]["id"] != steps[1]["id"]
    assert all(step["status"] == "pending" for step in steps)


def test_empty_plan_is_handled():
    assert validate_plan([]) == []
