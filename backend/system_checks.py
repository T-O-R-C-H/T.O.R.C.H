"""Runtime dependency checks exposed to the desktop application."""

from __future__ import annotations

from typing import Any, Callable


def _load_async_playwright() -> Callable[[], Any]:
    """Import Playwright lazily so a missing optional dependency is reportable."""
    from playwright.async_api import async_playwright

    return async_playwright


async def check_playwright_readiness() -> dict[str, bool | str]:
    """Return whether both Playwright and a launchable Chromium are available.

    Importing Playwright only proves that its Python package exists. Browser
    automation is not usable until the separately installed Chromium binary
    can launch, so readiness deliberately requires a real headless launch.
    """
    try:
        async_playwright = _load_async_playwright()
    except ImportError:
        return {
            "playwright_installed": False,
            "chromium_installed": False,
            "browser_automation_ready": False,
            "message": "Playwright is not installed.",
        }

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            await browser.close()
    except Exception:
        return {
            "playwright_installed": True,
            "chromium_installed": False,
            "browser_automation_ready": False,
            "message": "Chromium is missing or could not start.",
        }

    return {
        "playwright_installed": True,
        "chromium_installed": True,
        "browser_automation_ready": True,
        "message": "Browser automation is ready.",
    }
