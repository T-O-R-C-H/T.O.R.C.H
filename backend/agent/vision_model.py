"""One place that shows a screenshot to the user's own AI service.

Screen control (`tools/vision_control.py`) and screen-aware answers
(`agent/companion.py`) both need "look at this picture and tell me". They used
to be wired to two different services - a local Ollama model that took minutes
per step on a machine with no graphics card, and Gemini. Both go through here
now, using whichever key the user has added (DeepSeek or Claude).

Sending a screenshot means it leaves the machine. Callers must only reach this
after the user has asked TORCH to look at or control the screen.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional

from config.settings import settings
from errors.plain_language import UserFacingError

logger = logging.getLogger("torch.vision_model")

REQUEST_TIMEOUT_SECONDS = 60.0
MAX_OUTPUT_TOKENS = 4096

NO_KEY_MESSAGE = (
    "I need an AI key before I can look at your screen. "
    "Add one in Settings, under Connections, then try again."
)
UNREACHABLE_MESSAGE = (
    "I couldn't reach the AI service to look at your screen. "
    "Check your internet connection and the key in Settings, then try again."
)
DECLINED_MESSAGE = "The AI service declined to look at this screen, so I stopped."


class VisionUnavailable(UserFacingError):
    """No AI service could look at the screenshot. The message is user-ready."""


def _ask_deepseek(system: str, text: str, images: list[str], media_type: str) -> str:
    from openai import OpenAI

    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url="https://api.deepseek.com",
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=1,
    )
    content: list[dict] = [{"type": "text", "text": text}]
    for image in images:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{media_type};base64,{image}"},
            }
        )
    response = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": content},
        ],
        max_tokens=MAX_OUTPUT_TOKENS,
        response_format={"type": "json_object"},
    )
    return (response.choices[0].message.content or "").strip()


def _ask_claude(system: str, text: str, images: list[str], media_type: str) -> str:
    import anthropic

    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=1,
    )
    content: list[dict] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": image},
        }
        for image in images
    ]
    content.append({"type": "text", "text": text})
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=MAX_OUTPUT_TOKENS,
        system=system,
        # One screen, one next action: depth is not what makes this accurate,
        # and every extra second is a second the user watches nothing happen.
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": content}],
    )
    if response.stop_reason == "refusal":
        raise VisionUnavailable(DECLINED_MESSAGE)
    return "".join(
        block.text for block in response.content if block.type == "text"
    ).strip()


_PROVIDERS: dict[str, Callable[[str, str, list[str], str], str]] = {
    "deepseek": _ask_deepseek,
    "claude": _ask_claude,
}


def _has_key(name: str) -> bool:
    if name == "deepseek":
        return bool(settings.deepseek_api_key)
    if name == "claude":
        return bool(settings.anthropic_api_key)
    return False


def vision_providers() -> list[str]:
    """Usable services, the user's chosen one first, the other as fallback."""
    preferred = (settings.active_provider or "").strip().lower()
    if preferred == "anthropic":
        preferred = "claude"
    order = [preferred] if preferred in _PROVIDERS else []
    order += [name for name in ("deepseek", "claude") if name not in order]
    return [name for name in order if _has_key(name)]


def vision_available() -> bool:
    return bool(vision_providers())


def ask_vision_sync(
    system: str,
    text: str,
    images: list[str],
    media_type: str = "image/png",
    providers: Optional[list[str]] = None,
) -> str:
    """Show base64 `images` to the AI service and return its reply text.

    Blocking - run it in a thread. Tries the chosen service, then the other
    one if the first fails for any reason (quota, rate limit, timeout, outage).
    Raises VisionUnavailable, whose message is safe to show the user.
    """
    names = providers if providers is not None else vision_providers()
    if not names:
        raise VisionUnavailable(NO_KEY_MESSAGE)

    for name in names:
        try:
            reply = _PROVIDERS[name](system, text, images, media_type)
        except VisionUnavailable:
            raise
        except Exception:
            # The raw error names the service and may quote the request; it
            # goes to the log, never to the chat.
            logger.warning("Vision request to %s failed", name, exc_info=True)
            continue
        if reply:
            return reply
        logger.warning("Vision request to %s returned no text", name)
    raise VisionUnavailable(UNREACHABLE_MESSAGE)
