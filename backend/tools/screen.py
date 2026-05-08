"""
TORCH Tools — Screen Capture & Analysis
Screenshot capture and AI-powered screen understanding.
"""

import base64
import io
import logging
from typing import Optional

logger = logging.getLogger("torch.tools.screen")


def screenshot() -> str:
    """Take a screenshot and return as base64-encoded PNG."""
    try:
        import pyautogui
        img = pyautogui.screenshot()

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        logger.info(f"Screenshot captured: {img.size[0]}x{img.size[1]}")
        return b64

    except Exception as e:
        logger.error(f"Screenshot failed: {e}")
        raise RuntimeError(f"Screenshot failed: {e}")


async def analyse_screen() -> str:
    """Take a screenshot and analyze it using Gemini Vision."""
    try:
        import google.generativeai as genai
        from config.settings import settings

        if not settings.gemini_api_key:
            return "Gemini API key not configured"

        genai.configure(api_key=settings.gemini_api_key)

        # Capture screenshot
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

        return response.text

    except Exception as e:
        logger.error(f"Screen analysis failed: {e}")
        return f"Analysis failed: {e}"
