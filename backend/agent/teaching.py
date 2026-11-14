"""Teaching and doing in one conversation.

"How do I import a video?" - TORCH looks at the screen, says the next step and
points at it on the real screen. "Do it for me" - TORCH performs that same
step. There is no mode switch: both are ordinary chat messages, and this module
decides which one a message is.

It is deliberately rule-based. The decision is made before any AI service is
called, so a teaching question never turns into an action by accident.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any, Optional

# The marker stored in the conversation so a later "do it" knows what "it" is.
TEACH_TOOL = "teach"

_TEACHING = re.compile(
    r"""^\s*(?:hey\s+torch[,!\s]*|torch[,!\s]+|please\s+|pls\s+|ok(?:ay)?[,\s]+|so[,\s]+)*
    (?:
        how\s+(?:do|can|should|would|to)\b
      | show\s+me\b
      | teach\s+me\b
      | walk\s+me\s+through\b
      | guide\s+me\b
      | explain\b
      | where\s+(?:is|are|do|can|should)\b
      | what\s+(?:is|are|does|do)\s+(?:this|that|these|those)\b
      | what(?:'s|\s+is)\s+on\s+my\s+screen\b
      | what\s+(?:should|do)\s+i\s+(?:do|click|press)\b
      | which\s+(?:button|one|icon|menu|tab)\b
      | help\s+me\s+(?:understand|learn|with\s+this)\b
      | i\s+(?:want|would\s+like|need)\s+to\s+learn\b
      | i\s+don'?t\s+(?:know|understand)\s+how\b
    )""",
    re.IGNORECASE | re.VERBOSE,
)

_DO_IT = re.compile(
    r"""^\s*(?:ok(?:ay)?[,\s]+|yes[,\s]+|yeah[,\s]+|please\s+|pls\s+|just\s+|then\s+|torch[,\s]+)*
    (?:
        (?:you\s+)?do\s+(?:it|that|this)(?:\s+for\s+me)?
      | go\s+ahead
      | (?:can|could)\s+you\s+(?:just\s+)?do\s+(?:it|that|this)(?:\s+for\s+me)?
      | click\s+(?:it|that)(?:\s+for\s+me)?
      | open\s+(?:it|that)(?:\s+for\s+me)?
      | help\s+me\s+do\s+(?:it|that)
    )
    [\s.!?]*(?:please|pls|thanks|thank\s+you|bro|abeg)?[\s.!?]*$""",
    re.IGNORECASE | re.VERBOSE,
)


def is_teaching_request(command: str) -> bool:
    """True when the user wants to be shown or told, not have it done."""
    first_line = command.splitlines()[0] if command else ""
    return bool(_TEACHING.match(first_line))


_NEEDS_SCREEN = re.compile(
    r"\b(?:on\s+(?:my|the|this)\s+screen|show\s+me|where\s+(?:is|are)|point|"
    r"this|that|these|those|which\s+(?:button|one|icon|menu|tab)|"
    r"what\s+(?:should|do)\s+i\s+(?:click|press))\b",
    re.IGNORECASE,
)


def needs_screen(command: str) -> bool:
    """True when the question cannot be answered without seeing the screen."""
    first_line = command.splitlines()[0] if command else ""
    return bool(_NEEDS_SCREEN.search(first_line))


def is_do_it_request(command: str) -> bool:
    """True for a bare "do it for me" that only makes sense after a lesson."""
    first_line = command.splitlines()[0] if command else ""
    return bool(_DO_IT.match(first_line))


def _last_lesson(context: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not context:
        return None
    last = context[-1]
    steps = last.get("step_results") or []
    if any(step.get("tool") == TEACH_TOOL for step in steps):
        return last
    return None


def follow_up_plan(
    command: str, context: list[dict[str, Any]]
) -> Optional[list[dict[str, Any]]]:
    """Turn "do it for me" into the step TORCH just explained.

    Returns None unless the previous turn was a lesson - "do it" after anything
    else is left to the normal planner, which has the conversation to go on.
    """
    if not is_do_it_request(command):
        return None
    lesson = _last_lesson(context)
    if lesson is None:
        return None
    asked = str(lesson.get("user_command") or "").strip()
    told = str(lesson.get("reply_summary") or "").strip()
    if not told:
        return None
    return [
        {
            "tool": "vision_control",
            "label": "Doing that step for you",
            "args": {
                "task": (
                    f"The user asked: \"{asked}\". You told them: \"{told}\". "
                    "They have now asked you to do that one step for them. Do exactly "
                    "that step and nothing more, then report done and say what is on "
                    "screen now. Do not carry on to later steps."
                )
            },
            "requires_approval": False,
        }
    ]


async def look_and_teach(
    command: str,
    context: list[dict[str, Any]],
    client_id: str,
) -> dict[str, Any]:
    """Capture the screen and answer `command` about it.

    Returns {"speech": str, "guidance": {...}}. Guidance coordinates are in
    physical desktop pixels and are tagged so the desktop shell can convert
    them. Raises UserFacingError when the screen cannot be read.
    """
    from agent.companion import answer_with_screen
    from tools import vision_control as vc
    from websocket import manager as ws_manager

    # Hide TORCH's own always-on-top windows for the instant of the capture, the
    # same way screen control does, so TORCH does not describe itself.
    await ws_manager.send_message({"type": "vision_capture_start"}, client_id)
    try:
        if vc.CAPTURE_OVERLAY_SETTLE_SECONDS > 0:
            await asyncio.sleep(vc.CAPTURE_OVERLAY_SETTLE_SECONDS)
        frame = await asyncio.to_thread(vc.take_screenshot)
    finally:
        await ws_manager.send_message({"type": "vision_capture_end"}, client_id)

    left, top, width, height = frame.capture_bounds
    screenshots = [
        {
            "dataUrl": f"data:{vc.SCREENSHOT_MEDIA_TYPE};base64,{frame.image}",
            "width": frame.model_size[0],
            "height": frame.model_size[1],
            "bounds": {"x": left, "y": top, "width": width, "height": height},
        }
    ]
    result = await answer_with_screen(command, screenshots, context)
    guidance = result.get("guidance") or {"type": "none"}
    if guidance.get("type") == "point":
        # The model's point is a good guess. Where Windows can name the exact
        # control, use its real middle instead.
        from tools.uia_control import snap_to_named_control

        exact = await asyncio.to_thread(
            snap_to_named_control,
            str(guidance.get("label") or ""),
            float(guidance["x"]),
            float(guidance["y"]),
        )
        if exact is not None:
            guidance = {**guidance, "x": float(exact[0]), "y": float(exact[1])}
        guidance = {**guidance, "space": "physical"}
    return {"speech": result["speech"], "guidance": guidance}
