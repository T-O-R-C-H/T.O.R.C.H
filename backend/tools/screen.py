"""
TORCH Tools — Screen Capture & Analysis
Screenshot capture and AI-powered screen understanding.
"""

import base64
import io
import logging

logger = logging.getLogger("torch.tools.screen")


def _capture_png_bytes() -> bytes:
    """Capture the screen as PNG bytes, trying pyautogui then mss."""
    errors: list[str] = []

    try:
        import pyautogui
        img = pyautogui.screenshot()
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        logger.info("Screenshot captured via pyautogui: %sx%s", img.size[0], img.size[1])
        return buffer.getvalue()
    except Exception as e:
        errors.append(f"pyautogui: {e}")

    try:
        import mss
        from PIL import Image

        with mss.mss() as sct:
            monitor = sct.monitors[0]
            shot = sct.grab(monitor)
            img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            logger.info("Screenshot captured via mss: %sx%s", img.size[0], img.size[1])
            return buffer.getvalue()
    except Exception as e:
        errors.append(f"mss: {e}")

    hint = "Run: pip install pyautogui mss Pillow"
    raise RuntimeError(f"Screenshot failed. {'; '.join(errors)}. {hint}")


def screenshot() -> str:
    """Take a screenshot and return as base64-encoded PNG."""
    png_bytes = _capture_png_bytes()
    return base64.b64encode(png_bytes).decode("utf-8")


async def analyse_screen() -> str:
    """Take a screenshot and analyze it using Gemini Vision."""
    import google.generativeai as genai
    from config.settings import settings

    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key not configured. Add it in Settings.")

    genai.configure(api_key=settings.gemini_api_key)

    b64_image = screenshot()
    image_bytes = base64.b64decode(b64_image)

    model = genai.GenerativeModel(settings.gemini_model)
    response = model.generate_content([
        "Analyze this screenshot. Describe:\n"
        "1. What application is open\n"
        "2. What the user appears to be doing\n"
        "3. Any notable or urgent items visible\n"
        "4. Should TORCH interrupt the user? (yes/no and why)\n"
        "Be concise.",
        {"mime_type": "image/png", "data": image_bytes}
    ])

    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Screen analysis returned no result.")

    return text
