"""Screen-aware conversational guidance for the TORCH desktop companion."""

import asyncio
import json
import logging
import re
from typing import Any

from config.settings import settings

logger = logging.getLogger("torch.companion")

COMPANION_PROMPT = """
You are TORCH, a warm, extremely capable screen-aware AI companion. The user is
speaking or typing while looking at the attached desktop screenshots.

Answer for the ear: direct, natural, and usually one to three sentences. Refer to
specific visible details when relevant. If pointing at a visible control would help,
return its center in the exact pixel coordinate space of that screenshot. Never claim
you clicked or changed anything; this mode teaches and points but does not act.

Return JSON only:
{
  "speech": "what TORCH should say",
  "guidance": {
    "type": "point" or "none",
    "screen_index": integer starting at 0,
    "box_2d": [y_min, x_min, y_max, x_max],
    "label": "one to four words"
  }
}
The box_2d coordinates are normalized from 0 to 1000 relative to that screenshot,
with a top-left origin. Make the box tightly surround the exact visible control, not
its panel, row, or nearby text. Use type "none" when no precise target is clearly
visible. Never invent a target.
""".strip()


def _clean_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Preserve the useful spoken answer when a model emits slightly malformed
        # coordinate JSON. Guidance is optional; the whole response should not fail.
        speech_match = re.search(r'["\']speech["\']\s*:\s*["\'](.+?)["\']\s*[,}]', cleaned, re.DOTALL)
        if speech_match:
            return {"speech": speech_match.group(1).replace("\\n", " ").strip(), "guidance": {"type": "none"}}
        raise


def _normalize_result(result: dict[str, Any], screenshots: list[dict[str, Any]]) -> dict[str, Any]:
    speech = str(result.get("speech") or "I can see your screen, but I couldn't form a response.").strip()
    raw_guidance = result.get("guidance") if isinstance(result.get("guidance"), dict) else {}
    if raw_guidance.get("type") != "point" or not screenshots:
        return {"speech": speech, "guidance": {"type": "none"}}

    try:
        screen_index = max(0, min(int(raw_guidance.get("screen_index", 0)), len(screenshots) - 1))
        screenshot = screenshots[screen_index]
        box = raw_guidance.get("box_2d")
        if isinstance(box, list) and len(box) == 4:
            y_min, x_min, y_max, x_max = (max(0.0, min(float(value), 1000.0)) for value in box)
            normalized_x = (x_min + x_max) / 2000.0
            normalized_y = (y_min + y_max) / 2000.0
        else:
            source_width = max(1.0, float(screenshot["width"]))
            source_height = max(1.0, float(screenshot["height"]))
            normalized_x = max(0.0, min(float(raw_guidance["x"]), source_width)) / source_width
            normalized_y = max(0.0, min(float(raw_guidance["y"]), source_height)) / source_height
        bounds = screenshot["bounds"]
        desktop_x = float(bounds["x"]) + normalized_x * float(bounds["width"])
        desktop_y = float(bounds["y"]) + normalized_y * float(bounds["height"])
    except (KeyError, TypeError, ValueError):
        return {"speech": speech, "guidance": {"type": "none"}}

    return {
        "speech": speech,
        "guidance": {
            "type": "point",
            "x": desktop_x,
            "y": desktop_y,
            "label": str(raw_guidance.get("label") or "look here")[:48],
        },
    }


def _generate_with_gemini(
    command: str,
    screenshots: list[dict[str, Any]],
    context: list[dict],
    audio: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Use the REST API directly so both legacy AIza and new AQ keys work."""
    import requests

    recent_context = context[-6:] if context else []
    context_text = "\n".join(
        f"User: {item.get('user_command', '')}\nTORCH: {item.get('reply_summary', '')}"
        for item in recent_context
    )
    parts: list[dict[str, Any]] = [
        {"text": f"{COMPANION_PROMPT}\n\nRecent conversation:\n{context_text}\n\nUser: {command}"}
    ]
    for index, screenshot in enumerate(screenshots):
        parts.append({"text": f"Screen {index}: {screenshot['width']}x{screenshot['height']} pixels"})
        image_data = str(screenshot.get("dataUrl", "")).split(",", 1)[-1]
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": image_data}})
    if audio and audio.get("dataUrl"):
        audio_data_url = str(audio["dataUrl"])
        audio_data = audio_data_url.split(",", 1)[-1]
        parts.append({"text": "The user's spoken request is in this audio. Transcribe it internally, then answer it."})
        parts.append({"inlineData": {"mimeType": audio.get("mimeType", "audio/webm"), "data": audio_data}})

    model = settings.gemini_model.removeprefix("models/")
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 700,
                "responseMimeType": "application/json",
                "responseJsonSchema": {
                    "type": "object",
                    "required": ["speech", "guidance"],
                    "properties": {
                        "speech": {"type": "string"},
                        "guidance": {
                            "type": "object",
                            "required": ["type"],
                            "properties": {
                                "type": {"type": "string", "enum": ["point", "none"]},
                                "screen_index": {"type": "integer"},
                                "box_2d": {
                                    "type": "array",
                                    "minItems": 4,
                                    "maxItems": 4,
                                    "items": {"type": "number"},
                                },
                                "label": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
        timeout=(5, 22),
    )
    if not response.ok:
        try:
            message = response.json().get("error", {}).get("message", "Gemini rejected the request")
        except ValueError:
            message = "Gemini rejected the request"
        raise RuntimeError(f"Gemini API {response.status_code}: {message}")
    payload = response.json()
    text = payload["candidates"][0]["content"]["parts"][0]["text"]
    return _clean_json(text)


async def answer_with_screen(
    command: str,
    screenshots: list[dict[str, Any]],
    context: list[dict],
    audio: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not screenshots:
        return {"speech": "I couldn't capture your screen. Try again in a moment.", "guidance": {"type": "none"}}
    if not settings.gemini_api_key or settings.gemini_api_key == "AIzaSyTrialCloudKeyPlaceholder":
        return {
            "speech": "Visual guidance is ready, but it needs your Gemini API key in Settings before I can read this screen.",
            "guidance": {"type": "none"},
        }
    try:
        raw_result = await asyncio.wait_for(
            asyncio.to_thread(_generate_with_gemini, command, screenshots, context, audio),
            timeout=25,
        )
        return _normalize_result(raw_result, screenshots)
    except Exception as error:
        logger.exception("Screen-aware companion request failed")
        raise RuntimeError(f"Visual guidance failed: {error}") from error
