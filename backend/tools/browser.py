"""
TORCH Tools — Browser Automation
Web browsing, clicking, typing, and web search via Playwright + BeautifulSoup.
"""

import logging
from typing import Optional, List, Dict

logger = logging.getLogger("torch.tools.browser")

# Playwright browser instance (lazy-loaded)
_browser = None
_page = None


async def _get_page():
    """Get or create a Playwright browser page."""
    global _browser, _page
    if _page is None:
        from playwright.async_api import async_playwright
        pw = await async_playwright().start()
        _browser = await pw.chromium.launch(headless=False)
        _page = await _browser.new_page()
    return _page


async def open_browser(url: str) -> str:
    """Open a URL in the browser."""
    page = await _get_page()
    await page.goto(url, wait_until="domcontentloaded")
    title = await page.title()
    return f"Opened: {url} — Title: {title}"


async def click(x: int, y: int) -> str:
    """Click at a screen position in the browser."""
    page = await _get_page()
    await page.mouse.click(x, y)
    return f"Clicked at ({x}, {y})"


async def type_text(text: str) -> str:
    """Type text using keyboard in the browser."""
    page = await _get_page()
    await page.keyboard.type(text, delay=30)
    return f"Typed: {text[:50]}..."


def search_web(query: str) -> str:
    """Search the web using DuckDuckGo and return results."""
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    try:
        url = f"https://html.duckduckgo.com/html/?q={query}"
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")

        results = []
        for result in soup.select(".result")[:8]:
            title_el = result.select_one(".result__a")
            snippet_el = result.select_one(".result__snippet")
            if title_el:
                title = title_el.get_text(strip=True)
                link = title_el.get("href", "")
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""
                results.append(f"• {title}\n  {snippet}\n  {link}")

        return "\n\n".join(results) if results else f"No results found for: {query}"

    except Exception as e:
        logger.error(f"Web search failed: {e}")
        return f"Search failed: {e}"
