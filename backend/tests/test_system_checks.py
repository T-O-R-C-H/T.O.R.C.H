"""Runtime dependency readiness must reflect usable binaries, not imports."""

from unittest.mock import AsyncMock

import pytest

import system_checks


class _PlaywrightContext:
    def __init__(self, playwright):
        self.playwright = playwright

    async def __aenter__(self):
        return self.playwright

    async def __aexit__(self, exc_type, exc, traceback):
        return False


@pytest.mark.asyncio
async def test_playwright_missing_is_not_ready(monkeypatch):
    def missing_playwright():
        raise ImportError("not installed")

    monkeypatch.setattr(system_checks, "_load_async_playwright", missing_playwright)

    result = await system_checks.check_playwright_readiness()

    assert result == {
        "playwright_installed": False,
        "chromium_installed": False,
        "browser_automation_ready": False,
        "message": "Playwright is not installed.",
    }


@pytest.mark.asyncio
async def test_missing_chromium_is_not_ready_even_when_playwright_imports(monkeypatch):
    chromium = type(
        "Chromium",
        (),
        {"launch": AsyncMock(side_effect=RuntimeError("Executable doesn't exist"))},
    )()
    playwright = type("Playwright", (), {"chromium": chromium})()
    monkeypatch.setattr(
        system_checks,
        "_load_async_playwright",
        lambda: lambda: _PlaywrightContext(playwright),
    )

    result = await system_checks.check_playwright_readiness()

    assert result["playwright_installed"] is True
    assert result["chromium_installed"] is False
    assert result["browser_automation_ready"] is False
    assert "Executable" not in result["message"]


@pytest.mark.asyncio
async def test_launchable_chromium_is_ready_and_closed(monkeypatch):
    browser = type("Browser", (), {"close": AsyncMock()})()
    chromium = type("Chromium", (), {"launch": AsyncMock(return_value=browser)})()
    playwright = type("Playwright", (), {"chromium": chromium})()
    monkeypatch.setattr(
        system_checks,
        "_load_async_playwright",
        lambda: lambda: _PlaywrightContext(playwright),
    )

    result = await system_checks.check_playwright_readiness()

    assert result["browser_automation_ready"] is True
    chromium.launch.assert_awaited_once_with(headless=True)
    browser.close.assert_awaited_once_with()
