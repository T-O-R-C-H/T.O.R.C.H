"""
TORCH Tools — Social Media & Messaging
Automates posting and messaging across platforms via Playwright.
All actions require HITL approval.
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
    Post content to a social media platform via browser automation.
    Always requires HITL approval.

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
                f"Timeout while loading {platform}. This might be due to a slow connection. "
                f"The page has been opened — please check if you need to log in manually."
            )

        # Platform-specific automation
        # Note: Each platform requires user to be logged in already
        logger.info(f"Navigated to {platform} for posting")

        return (
            f"Successfully opened {platform} for you. "
            f"Ready to post: \"{message[:80]}...\" "
            f"\n\nIMPORTANT: If you see a login screen, please log in first. "
            f"TORCH will wait for you to complete the post or provide further instructions."
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
    Send a message on a messaging platform via browser automation.
    Always requires HITL approval.

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
                f"Opened {platform}, but it's taking a while to load. "
                f"Please check the browser window — you might need to scan a QR code or log in."
            )

        logger.info(f"Navigated to {platform} messaging")

        return (
            f"Opened {platform} for messaging. "
            f"Contact: {contact}\nMessage: {message[:100]}... "
            f"\n\nAction Required: Please ensure you are logged in and selecting the correct contact."
        )

    except Exception as e:
        logger.error(f"Message send failed: {e}")
        error_msg = str(e)
        if "playwright install" in error_msg.lower():
            return error_msg
        return f"Failed to open {platform}: {error_msg}. Please check your internet connection or browser setup."
