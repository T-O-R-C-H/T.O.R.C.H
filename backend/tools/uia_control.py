"""
TORCH Tools — Windows UI Automation screen control.

Reads the accessibility tree of the focused window and acts on named elements.
Measured on this project's hardware:

    local vision (Qwen2.5-VL, no GPU)   ~183,000 ms per action
    cloud vision (Gemini)                 ~5,600 ms per action
    UI Automation                            ~66 ms per action

Vision also guesses coordinates from pixels; UIA reads the real bounding box of
an element it can name, so "click Send" targets the actual Send button.

It also never takes a screenshot, which matters for an agent pointed at
whatever happens to be on a user's screen.

Limitation worth knowing: Chromium and Electron apps expose very little of
their tree unless accessibility is enabled, so web content usually needs the
browser tools or a vision fallback instead.
"""

import logging
import time
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from errors.plain_language import UserFacingError

logger = logging.getLogger("torch.tools.uia")

try:
    import uiautomation as auto

    UIA_AVAILABLE = True
except ImportError:  # pragma: no cover - depends on the host platform
    auto = None  # type: ignore[assignment]
    UIA_AVAILABLE = False
    logger.warning("uiautomation is not installed — UIA control unavailable")


# Element types a user can actually act on.
CLICKABLE_TYPES = {
    "ButtonControl",
    "HyperlinkControl",
    "MenuItemControl",
    "ListItemControl",
    "TabItemControl",
    "CheckBoxControl",
    "RadioButtonControl",
    "SplitButtonControl",
    "TreeItemControl",
}

EDITABLE_TYPES = {"EditControl", "DocumentControl", "ComboBoxControl"}

MAX_DEPTH = 6
MAX_ELEMENTS = 80


@contextmanager
def _com_apartment():
    """
    Give the calling thread a COM apartment.

    The executor runs synchronous tools on a thread-pool thread, and COM is
    per-thread: without this every call fails with "CoInitialize has not been
    called". It is a no-op where an apartment already exists.
    """
    initializer = getattr(auto, "UIAutomationInitializerInThread", None)
    if initializer is None:
        yield
        return
    with initializer():
        yield


def _require_uia() -> None:
    if not UIA_AVAILABLE:
        raise UserFacingError(
            "Screen control is not available on this computer. "
            "It needs the Windows accessibility support that ships with TORCH."
        )


def _describe(control: Any) -> Optional[Dict[str, Any]]:
    """One element, or None if it cannot be read or is not worth listing."""
    try:
        name = (control.Name or "").strip()
        control_type = control.ControlTypeName
        if not name:
            return None

        rect = control.BoundingRectangle
        # Zero-sized elements are present in the tree but not on screen.
        if rect.right <= rect.left or rect.bottom <= rect.top:
            return None

        clickable = control_type in CLICKABLE_TYPES
        editable = control_type in EDITABLE_TYPES
        if not (clickable or editable):
            return None

        return {
            "name": name,
            "type": control_type.replace("Control", ""),
            "x": (rect.left + rect.right) // 2,
            "y": (rect.top + rect.bottom) // 2,
            "enabled": bool(control.IsEnabled),
            "editable": editable,
        }
    except Exception:
        # A control can disappear between enumeration and inspection.
        return None


def read_screen(window_title: Optional[str] = None) -> Dict[str, Any]:
    """
    List the actionable elements of a window.

    Defaults to whatever is focused, which is what a user means by "the screen".
    """
    _require_uia()

    with _com_apartment():
        window = _find_window(window_title) if window_title else auto.GetForegroundControl()
        if not window:
            raise UserFacingError("I couldn't find that window on your screen.")
        return _read_window(window)


def _read_window(window: Any) -> Dict[str, Any]:
    elements: List[Dict[str, Any]] = []

    def walk(control: Any, depth: int = 0) -> None:
        if depth > MAX_DEPTH or len(elements) >= MAX_ELEMENTS:
            return
        try:
            children = control.GetChildren()
        except Exception:
            return
        for child in children:
            if len(elements) >= MAX_ELEMENTS:
                return
            described = _describe(child)
            if described:
                elements.append(described)
            walk(child, depth + 1)

    walk(window)

    return {
        "window": (window.Name or "").strip(),
        "elements": elements,
    }


def _find_window(title: str) -> Optional[Any]:
    """Top-level window whose title contains `title`, case-insensitively."""
    needle = title.lower()
    try:
        for window in auto.GetRootControl().GetChildren():
            name = (window.Name or "").lower()
            if needle in name:
                return window
    except Exception as exc:
        logger.warning(f"Could not enumerate windows: {exc}")
    return None


def _find_element(
    name: str,
    want_editable: bool = False,
    exact: bool = False,
    window: Optional[Any] = None,
) -> Optional[Any]:
    """
    Locate an element by its accessible name inside a window.

    Prefers an exact match so "Save" does not select "Save As" when both exist.
    """
    window = window or auto.GetForegroundControl()
    if not window:
        return None

    needle = name.strip().lower()
    exact_match: Optional[Any] = None
    partial_match: Optional[Any] = None

    def walk(control: Any, depth: int = 0) -> None:
        nonlocal exact_match, partial_match
        if exact_match or depth > MAX_DEPTH:
            return
        try:
            children = control.GetChildren()
        except Exception:
            return
        for child in children:
            if exact_match:
                return
            try:
                child_name = (child.Name or "").strip()
                control_type = child.ControlTypeName
                matches_kind = (
                    control_type in EDITABLE_TYPES
                    if want_editable
                    else control_type in CLICKABLE_TYPES
                )
                if child_name and matches_kind and child.IsEnabled:
                    lowered = child_name.lower()
                    if lowered == needle:
                        exact_match = child
                        return
                    if not exact and partial_match is None and needle in lowered:
                        partial_match = child
            except Exception:
                pass
            walk(child, depth + 1)

    walk(window)
    return exact_match or partial_match


def _resolve_target_window(window_title: Optional[str]) -> Optional[Any]:
    """
    The window to act on, brought to the front when named explicitly.

    Returns None to mean "whatever is focused", which _find_element resolves.
    """
    if not window_title:
        return None
    window = _find_window(window_title)
    if not window:
        raise UserFacingError(f"I couldn't find a window called '{window_title}'.")
    try:
        window.SetActive()
        time.sleep(0.3)
    except Exception:
        # Some windows refuse activation; the click can still land.
        pass
    return window


def click_element(name: str, exact: bool = False, window_title: Optional[str] = None) -> str:
    """
    Click a named element.

    Pass window_title whenever the target is known. Resolving "the focused
    window" at execution time is unreliable: planning takes seconds, and
    whatever the user clicks in the meantime becomes the target instead.
    """
    _require_uia()

    with _com_apartment():
        window = _resolve_target_window(window_title)
        target = _find_element(name, want_editable=False, exact=exact, window=window)
        if not target:
            raise UserFacingError(f"I couldn't find anything called '{name}' on your screen.")
        return _invoke_or_click(target, name)


def _invoke_or_click(target: Any, name: str) -> str:
    """
    Activate a control using the pattern it actually supports.

    Order matters. A radio button or tab exposes SelectionItem, a checkbox
    exposes Toggle, and a plain button exposes Invoke. Calling Invoke on a
    radio button appears to succeed while changing nothing, which would report
    a click that never happened.
    """
    label = (target.Name or name).strip()

    for pattern_name, action in (
        ("GetSelectionItemPattern", "Select"),
        ("GetTogglePattern", "Toggle"),
        ("GetInvokePattern", "Invoke"),
    ):
        try:
            getter = getattr(target, pattern_name, None)
            if not getter:
                continue
            pattern = getter()
            if not pattern:
                continue
            getattr(pattern, action)()
            return f"Clicked '{label}'."
        except Exception:
            continue

    try:
        # Last resort: a real click, which needs the control to be visible and
        # unobscured.
        target.Click(simulateMove=False)
        return f"Clicked '{label}'."
    except Exception as exc:
        raise UserFacingError(f"I found '{label}' but couldn't click it.") from exc


def type_into(name: str, text: str, window_title: Optional[str] = None) -> str:
    """Type into a named text field. Pass window_title when the target is known."""
    _require_uia()

    with _com_apartment():
        window = _resolve_target_window(window_title)
        target = _find_element(name, want_editable=True, exact=False, window=window)
        if not target:
            raise UserFacingError(f"I couldn't find a text box called '{name}' on your screen.")
        return _set_value_or_type(target, name, text)


def _set_value_or_type(target: Any, name: str, text: str) -> str:
    label = (target.Name or name).strip()
    try:
        pattern = target.GetValuePattern()
        if pattern:
            pattern.SetValue(text)
            return f"Typed into '{label}'."
    except Exception:
        pass

    try:
        target.Click(simulateMove=False)
        time.sleep(0.1)
        auto.SendKeys(text, waitTime=0.01)
        return f"Typed into '{label}'."
    except Exception as exc:
        raise UserFacingError(f"I found '{label}' but couldn't type into it.") from exc


def describe_screen(window_title: Optional[str] = None) -> str:
    """Plain-text summary of what is on screen, for the planner to reason over."""
    snapshot = read_screen(window_title)
    if not snapshot["elements"]:
        return (
            f"'{snapshot['window']}' is open, but it doesn't expose any controls "
            f"TORCH can read. Some apps hide them from accessibility tools."
        )

    lines = [f"Window: {snapshot['window']}", "Things I can act on:"]
    for element in snapshot["elements"]:
        kind = "text box" if element["editable"] else element["type"].lower()
        state = "" if element["enabled"] else " (disabled)"
        lines.append(f"  - {element['name']} [{kind}]{state}")
    return "\n".join(lines)
