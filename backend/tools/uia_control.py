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
from typing import Any, Dict, List, Optional

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


def _require_uia() -> None:
    if not UIA_AVAILABLE:
        raise RuntimeError(
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

    window = _find_window(window_title) if window_title else auto.GetForegroundControl()
    if not window:
        raise RuntimeError("I couldn't find that window on your screen.")

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
    name: str, want_editable: bool = False, exact: bool = False
) -> Optional[Any]:
    """
    Locate an element by its accessible name inside the focused window.

    Prefers an exact match so "Save" does not select "Save As" when both exist.
    """
    window = auto.GetForegroundControl()
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


def click_element(name: str, exact: bool = False) -> str:
    """Click a named element in the focused window."""
    _require_uia()

    target = _find_element(name, want_editable=False, exact=exact)
    if not target:
        raise ValueError(f"I couldn't find anything called '{name}' on your screen.")

    label = (target.Name or name).strip()
    try:
        # Invoke is more reliable than a synthetic click: it does not depend on
        # the element being unobscured or the pointer landing precisely.
        pattern = target.GetInvokePattern()
        if pattern:
            pattern.Invoke()
            return f"Clicked '{label}'."
    except Exception:
        pass

    try:
        target.Click(simulateMove=False)
        return f"Clicked '{label}'."
    except Exception as exc:
        raise RuntimeError(f"I found '{label}' but couldn't click it.") from exc


def type_into(name: str, text: str) -> str:
    """Type into a named text field in the focused window."""
    _require_uia()

    target = _find_element(name, want_editable=True, exact=False)
    if not target:
        raise ValueError(f"I couldn't find a text box called '{name}' on your screen.")

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
        raise RuntimeError(f"I found '{label}' but couldn't type into it.") from exc


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
