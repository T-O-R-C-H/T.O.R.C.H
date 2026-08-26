"""
UI Automation screen control.

Reads the accessibility tree instead of pixels, which on this project's
hardware is roughly 2,700x faster than the local vision loop and targets a
control by its real bounding box rather than a guessed coordinate.

These tests use fake controls: a real UIA tree depends on whatever happens to
be on screen, which is not something a test can rely on.
"""

import pytest

from tools import uia_control


class FakeRect:
    def __init__(self, left=0, top=0, right=100, bottom=40):
        self.left, self.top, self.right, self.bottom = left, top, right, bottom


class FakeControl:
    """Stands in for a uiautomation control."""

    def __init__(
        self,
        name="",
        control_type="ButtonControl",
        children=None,
        enabled=True,
        rect=None,
        invoke_pattern=None,
        value_pattern=None,
    ):
        self.Name = name
        self.ControlTypeName = control_type
        self.IsEnabled = enabled
        self.BoundingRectangle = rect or FakeRect()
        self._children = children or []
        self._invoke = invoke_pattern
        self._value = value_pattern
        self.clicked = False

    def GetChildren(self):
        return self._children

    def GetInvokePattern(self):
        return self._invoke

    def GetValuePattern(self):
        return self._value

    def Click(self, simulateMove=False):
        self.clicked = True


class RecordingPattern:
    def __init__(self):
        self.invoked = False
        self.value = None

    def Invoke(self):
        self.invoked = True

    def SetValue(self, value):
        self.value = value


@pytest.fixture(autouse=True)
def uia_available(monkeypatch):
    monkeypatch.setattr(uia_control, "UIA_AVAILABLE", True)


def _window(*children, title="Test Window"):
    return FakeControl(name=title, control_type="WindowControl", children=list(children))


# ─── Reading the screen ───


def test_lists_only_actionable_elements(monkeypatch):
    window = _window(
        FakeControl("Send", "ButtonControl"),
        FakeControl("Some heading", "TextControl"),
        FakeControl("Recipient", "EditControl"),
    )
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: window)

    names = [e["name"] for e in uia_control.read_screen()["elements"]]
    assert names == ["Send", "Recipient"]


def test_unnamed_and_offscreen_elements_are_skipped(monkeypatch):
    window = _window(
        FakeControl("", "ButtonControl"),
        FakeControl("Collapsed", "ButtonControl", rect=FakeRect(0, 0, 0, 0)),
        FakeControl("Real", "ButtonControl"),
    )
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: window)

    assert [e["name"] for e in uia_control.read_screen()["elements"]] == ["Real"]


def test_element_reports_its_centre(monkeypatch):
    window = _window(FakeControl("Send", "ButtonControl", rect=FakeRect(100, 200, 300, 240)))
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: window)

    element = uia_control.read_screen()["elements"][0]
    assert (element["x"], element["y"]) == (200, 220)


def test_nested_elements_are_found(monkeypatch):
    window = _window(FakeControl("Toolbar", "PaneControl", children=[FakeControl("Save")]))
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: window)

    assert "Save" in [e["name"] for e in uia_control.read_screen()["elements"]]


def test_describe_screen_says_so_when_nothing_is_readable(monkeypatch):
    """Chromium and Electron apps often expose nothing, and that must be said."""
    monkeypatch.setattr(
        uia_control.auto, "GetForegroundControl", lambda: _window(title="Some App")
    )

    described = uia_control.describe_screen()
    assert "Some App" in described
    assert "doesn't expose any controls" in described


# ─── Clicking ───


def test_click_prefers_the_invoke_pattern(monkeypatch):
    pattern = RecordingPattern()
    button = FakeControl("Send", invoke_pattern=pattern)
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: _window(button))

    assert "Send" in uia_control.click_element("Send")
    assert pattern.invoked is True
    assert button.clicked is False, "invoke should be used instead of a synthetic click"


def test_click_falls_back_to_a_real_click(monkeypatch):
    button = FakeControl("Send", invoke_pattern=None)
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: _window(button))

    uia_control.click_element("Send")
    assert button.clicked is True


def test_exact_name_wins_over_a_partial_match(monkeypatch):
    """'Save' must not select 'Save As' when both are present."""
    save_as = FakeControl("Save As", invoke_pattern=RecordingPattern())
    save = FakeControl("Save", invoke_pattern=RecordingPattern())
    monkeypatch.setattr(
        uia_control.auto, "GetForegroundControl", lambda: _window(save_as, save)
    )

    uia_control.click_element("Save")
    assert save.GetInvokePattern().invoked is True
    assert save_as.GetInvokePattern().invoked is False


def test_disabled_elements_are_not_clicked(monkeypatch):
    disabled = FakeControl("Send", enabled=False, invoke_pattern=RecordingPattern())
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: _window(disabled))

    with pytest.raises(ValueError):
        uia_control.click_element("Send")


def test_missing_element_reports_plainly(monkeypatch):
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: _window())

    with pytest.raises(ValueError) as excinfo:
        uia_control.click_element("Nowhere")

    message = str(excinfo.value)
    assert "Nowhere" in message
    assert "Traceback" not in message and "None" not in message


# ─── Typing ───


def test_type_into_sets_the_value(monkeypatch):
    pattern = RecordingPattern()
    field = FakeControl("Recipient", "EditControl", value_pattern=pattern)
    monkeypatch.setattr(uia_control.auto, "GetForegroundControl", lambda: _window(field))

    uia_control.type_into("Recipient", "someone@example.com")
    assert pattern.value == "someone@example.com"


def test_type_into_will_not_target_a_button(monkeypatch):
    monkeypatch.setattr(
        uia_control.auto, "GetForegroundControl", lambda: _window(FakeControl("Send"))
    )

    with pytest.raises(ValueError):
        uia_control.type_into("Send", "text")


# ─── Availability ───


def test_tools_report_plainly_when_uia_is_missing(monkeypatch):
    monkeypatch.setattr(uia_control, "UIA_AVAILABLE", False)

    with pytest.raises(RuntimeError) as excinfo:
        uia_control.read_screen()

    assert "not available" in str(excinfo.value).lower()
