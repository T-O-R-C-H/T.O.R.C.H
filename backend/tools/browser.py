"""
TORCH Tools — Browser Automation
Web browsing, clicking, typing, and web search via Playwright + BeautifulSoup.
"""

import logging
from typing import Optional, List, Dict
from urllib.parse import quote_plus

logger = logging.getLogger("torch.tools.browser")

# Playwright browser instance (lazy-loaded)
_browser = None
_page = None


async def _get_page():
    """Get or create a Playwright browser page with robust error handling."""
    global _browser, _page
    
    if _page is not None:
        try:
            # Check if page is still functional
            await _page.title()
            return _page
        except Exception:
            logger.info("Browser page lost, recreating...")
            _page = None
            _browser = None

    try:
        from playwright.async_api import async_playwright
        pw = await async_playwright().start()
        
        try:
            _browser = await pw.chromium.launch(headless=False)
        except Exception as launch_err:
            if "executable" in str(launch_err).lower() or "not installed" in str(launch_err).lower():
                raise RuntimeError(
                    "Playwright browser (Chromium) is not installed. "
                    "Please run 'playwright install chromium' in your terminal."
                ) from launch_err
            raise

        _page = await _browser.new_page()
        return _page
        
    except ImportError:
        raise ImportError(
            "Playwright library is not installed. "
            "Please run 'pip install playwright' and then 'playwright install chromium'."
        )


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


_SEARCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def _parse_ddg_html(html: str) -> list:
    """Pull results out of the html.duckduckgo.com layout."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    results = []
    for block in soup.select(".result")[:8]:
        title_el = block.select_one(".result__a")
        if not title_el:
            continue
        snippet_el = block.select_one(".result__snippet")
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""
        results.append(
            f"• {title_el.get_text(strip=True)}\n  {snippet}\n  {title_el.get('href', '')}"
        )
    return results


def _parse_ddg_lite(html: str) -> list:
    """Pull results out of the lite.duckduckgo.com layout, which has no result blocks."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    results = []
    for link in soup.select("a.result-link")[:8]:
        results.append(f"• {link.get_text(strip=True)}\n  {link.get('href', '')}")
    return results


def _search_via_browser(query: str) -> list:
    """
    Fall back to a real browser when the HTTP endpoints refuse to answer.

    Runs headless and in its own browser instance so it never disturbs the
    visible window used for browser automation.
    """
    from playwright.sync_api import sync_playwright

    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_default_timeout(20000)
            page.goto(
                f"https://duckduckgo.com/?q={quote_plus(query)}",
                wait_until="domcontentloaded",
            )
            selector = "article[data-testid='result']"
            page.wait_for_selector(selector, timeout=15000)
            for block in page.query_selector_all(selector)[:8]:
                title_el = block.query_selector("h2")
                link_el = block.query_selector("a[href]")
                snippet_el = block.query_selector("[data-result='snippet']")
                if not title_el:
                    continue
                results.append(
                    f"• {title_el.inner_text().strip()}\n"
                    f"  {snippet_el.inner_text().strip() if snippet_el else ''}\n"
                    f"  {link_el.get_attribute('href') if link_el else ''}"
                )
        finally:
            browser.close()
    return results


def search_web(query: str) -> str:
    """Search the web via DuckDuckGo and return the top results."""
    import requests

    # DuckDuckGo answers the plain GET form with a 202 challenge page, and
    # throttles bursts of requests, so the query is POSTed and a second
    # endpoint stands by. A throttled search must never be reported as
    # "no results" - that reads as a definitive answer the user would believe.
    endpoints = (
        ("https://html.duckduckgo.com/html/", _parse_ddg_html),
        ("https://lite.duckduckgo.com/lite/", _parse_ddg_lite),
    )

    blocked = False
    for url, parse in endpoints:
        try:
            response = requests.post(
                url, data={"q": query}, headers=_SEARCH_HEADERS, timeout=15
            )
        except Exception as e:
            logger.warning(f"Web search request to {url} failed: {e}")
            continue

        if response.status_code != 200:
            logger.warning(f"Web search to {url} returned {response.status_code}")
            blocked = True
            continue

        results = parse(response.text)
        if results:
            return "\n\n".join(results)
        blocked = True

    if blocked:
        # The lightweight endpoints throttle aggressively. A real browser gets
        # through, at the cost of a few seconds, so it is only used on refusal.
        logger.info("Search endpoints refused; retrying through a headless browser")
        try:
            results = _search_via_browser(query)
            if results:
                return "\n\n".join(results)
        except Exception as e:
            logger.error(f"Browser-based web search failed: {e}")
        raise RuntimeError("Search is temporarily unavailable")

    return f"No results found for: {query}"
