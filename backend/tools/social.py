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

        page = await _get_page()
        await page.goto(url, wait_until="domcontentloaded")

        # Platform-specific automation
        # Note: Each platform requires user to be logged in already
        logger.info(f"Navigated to {platform} for posting")

        return (
            f"Opened {platform} posting page. "
            f"Message to post: {message[:100]}... "
            f"Please complete the post manually or ensure you are logged in."
        )

    except Exception as e:
        logger.error(f"Social post failed: {e}")
        return f"Failed to post to {platform}: {e}"


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

        page = await _get_page()
        await page.goto(url, wait_until="domcontentloaded")

        logger.info(f"Navigated to {platform} messaging")

        return (
            f"Opened {platform}. "
            f"Contact: {contact}, Message: {message[:100]}... "
            f"Please ensure you are logged in to complete the action."
        )

    except Exception as e:
        logger.error(f"Message send failed: {e}")
        return f"Failed to message on {platform}: {e}"
