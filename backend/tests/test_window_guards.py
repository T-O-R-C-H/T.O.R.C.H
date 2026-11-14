"""TORCH must not close the app it is working in, or reopen a browser.

A live run "dismissed a pop-up" by clicking Chrome's own Close button, and
"Open Chrome" relaunched an open Chrome, which put up its profile chooser.
"""
import pytest

from tools import system, vision_control


def test_open_browser_window_finds_an_ordinary_chrome_window():
    windows = {
        1: ("TORCH - AI Agent", "Chrome_WidgetWin_1"),
        2: ("Google Chrome", "Chrome_WidgetWin_1"),  # the profile chooser
        3: ("Apple - Google Chrome", "Chrome_WidgetWin_1"),
    }
    assert system._open_browser_window(windows, "chrome") == "Apple - Google Chrome"


def test_profile_chooser_alone_is_not_an_open_browser():
    windows = {2: ("Google Chrome", "Chrome_WidgetWin_1")}
    assert system._open_browser_window(windows, "chrome") is None


def test_only_browsers_are_brought_forward():
    windows = {3: ("Notes - Google Chrome", "Chrome_WidgetWin_1")}
    assert system._open_browser_window(windows, "notepad") is None


def test_open_app_brings_an_open_chrome_forward_instead_of_launching(monkeypatch):
    monkeypatch.setattr(system.platform, "system", lambda: "Windows")
    monkeypatch.setattr(system, "_visible_windows", lambda: {3: ("Apple - Google Chrome", "Chrome_WidgetWin_1")})
    focused = []
    monkeypatch.setattr(system, "_bring_to_front", focused.append)

    def no_launch(*_args, **_kwargs):
        raise AssertionError("Chrome was launched again")

    monkeypatch.setattr(system.subprocess, "Popen", no_launch)
    assert system.open_app("Chrome") == "Opened Chrome."
    assert focused == ["Apple - Google Chrome"]


def _click():
    return {"action": "click", "x": 1270, "y": 10}


def test_click_on_a_window_close_button_is_refused(monkeypatch):
    monkeypatch.setattr(vision_control, "_window_caption_button_at", lambda x, y: "Close")
    monkeypatch.setattr(vision_control, "CURSOR_LEAD_SECONDS", 0)
    pressed = []
    monkeypatch.setattr(vision_control, "_press_at", lambda *a, **k: pressed.append(a))
    with pytest.raises(ValueError, match="Close button"):
        vision_control.execute_action(_click())
    assert pressed == []


def test_close_button_allowed_when_the_task_asks_to_close(monkeypatch):
    monkeypatch.setattr(vision_control, "_window_caption_button_at", lambda x, y: "Close")
    monkeypatch.setattr(vision_control, "CURSOR_LEAD_SECONDS", 0)
    pressed = []
    monkeypatch.setattr(vision_control, "_press_at", lambda *a, **k: pressed.append(a))
    action = _click()
    action["_allow_window_buttons"] = True
    vision_control.execute_action(action)
    assert len(pressed) == 1


@pytest.mark.parametrize(
    "task, allowed",
    [
        ("Close Notepad", True),
        ("minimize the browser", True),
        ("Open Chrome, go to apple.com and check out", False),
        ("find the closest store", False),
    ],
)
def test_which_tasks_may_press_window_buttons(task, allowed):
    assert bool(vision_control._WINDOW_BUTTON_WORDS.search(task)) is allowed
