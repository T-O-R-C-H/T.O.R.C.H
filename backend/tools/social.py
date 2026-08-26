"""
TORCH Tools — Social Media & Messaging

These tools open the platform in a browser with the text prepared. They do NOT
publish or send: every site here sits behind a login and anti-automation
checks, and there is no reliable posting automation.

Say so plainly in every message they return. Claiming a post went out when it
did not is worse than not offering the feature, and the user has already
approved the step by the time this runs.
"""

import logging
from typing import Optional

logger = logging.getLogger("torch.tools.social")


async def post_social(
    platform: str,
    message: str,
    image: Optional[str] = None,
) -> str:
    """
    Open a social platform with the message ready to paste.

    This does not publish anything - the user posts it themselves.
    Supported platforms: twitter/x, linkedin, facebook, instagram, reddit
    """
    platform = platform.lower().strip()

    platform_urls = {
        "twitter": "https://twitter.com/compose/tweet",
        "x": "https://twitter.com/compose/tweet",
        "linkedin": "https://www.linkedin.com/feed/",
        "facebook": "https://www.facebook.com/",
        "reddit": "https://www.reddit.com/submit",
        "instagram": "https://www.instagram.com/",
    }

    url = platform_urls.get(platform)
    if not url:
        return f"Unsupported platform: {platform}. Supported: {', '.join(platform_urls.keys())}"

    try:
        from tools.browser import _get_page
        from playwright.async_api import TimeoutError as PlaywrightTimeout

        page = await _get_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except PlaywrightTimeout:
            return (
                f"{platform.title()} is slow to load. I've opened it, but you may "
                f"need to wait or sign in. Nothing has been posted."
            )

        logger.info(f"Opened {platform} for the user to post manually")

        return (
            f"I've opened {platform.title()} for you. I can't post on your behalf, "
            f"so you'll need to publish it yourself.\n\n"
            f"Here's the message to paste:\n{message}"
        )

    except Exception as e:
        logger.error(f"Social post failed: {e}")
        error_msg = str(e)
        if "playwright install" in error_msg.lower():
            return error_msg
        return f"I couldn't open {platform} automatically. Error: {error_msg}. \nTry opening it manually in your browser first."


async def send_message(
    platform: str,
    contact: str,
    message: str,
) -> str:
    """
    Open a messaging app with the message ready to paste.

    This does not send anything - the user sends it themselves.
    Supported: whatsapp, telegram, slack, discord
    """
    platform = platform.lower().strip()

    platform_urls = {
        "whatsapp": "https://web.whatsapp.com/",
        "telegram": "https://web.telegram.org/",
        "slack": "https://app.slack.com/",
        "discord": "https://discord.com/channels/@me",
    }

    url = platform_urls.get(platform)
    if not url:
        return f"Unsupported platform: {platform}. Supported: {', '.join(platform_urls.keys())}"

    try:
        from tools.browser import _get_page
        from playwright.async_api import TimeoutError as PlaywrightTimeout

        page = await _get_page()
        try:
            # Messaging apps often take longer to load (e.g. WhatsApp QR)
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except PlaywrightTimeout:
            return (
                f"{platform.title()} is slow to load. I've opened it, but you may need "
                f"to sign in or scan a QR code. Nothing has been sent."
            )

        logger.info(f"Opened {platform} for the user to send manually")

        return (
            f"I've opened {platform.title()} for you. I can't send messages on your "
            f"behalf, so you'll need to pick {contact} and send it yourself.\n\n"
            f"Here's the message to paste:\n{message}"
        )

    except Exception as e:
        logger.error(f"Message send failed: {e}")
        error_msg = str(e)
        if "playwright install" in error_msg.lower():
            return error_msg
        return f"Failed to open {platform}: {error_msg}. Please check your internet connection or browser setup."
