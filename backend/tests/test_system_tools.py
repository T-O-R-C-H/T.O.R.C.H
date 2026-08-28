"""
System tool safety.

open_app receives model-generated arguments, so nothing on that path may reach
a shell. run_terminal is deliberately a shell tool, and is instead gated by
mandatory approval — that gate is what these tests protect.
"""

import subprocess
import sys

import pytest

from agent.planner import HITL_TOOLS, validate_plan
from errors.plain_language import UserFacingError
from tools import system as system_tools


class _RecordingPopen:
    """Stand-in for subprocess.Popen that records how it was called."""

    def __init__(self):
        self.calls = []

    def __call__(self, args, **kwargs):
        self.calls.append((args, kwargs))
        return None


# ─── open_app must never use a shell ───


def test_open_app_primary_path_avoids_shell(monkeypatch):
    recorder = _RecordingPopen()
    monkeypatch.setattr(system_tools.platform, "system", lambda: "Windows")
    monkeypatch.setattr(system_tools.subprocess, "Popen", recorder)

    system_tools.open_app("notepad")

    args, kwargs = recorder.calls[0]
    assert kwargs.get("shell") is not True
    assert isinstance(args, list), "command must be an argv list, not a shell string"


def test_open_app_fallback_avoids_shell(monkeypatch):
    """
    The fallback runs when the primary launch raises — historically it built a
    shell string from the app name, which made it command-injectable.
    """
    started = []

    def exploding_popen(*args, **kwargs):
        raise OSError("primary launch failed")

    monkeypatch.setattr(system_tools.platform, "system", lambda: "Windows")
    monkeypatch.setattr(system_tools.subprocess, "Popen", exploding_popen)
    monkeypatch.setattr(system_tools.os, "startfile", started.append, raising=False)

    result = system_tools.open_app("notepad")

    assert started == ["notepad"], "fallback should hand the name to the OS launcher"
    assert "Opened" in result


def test_open_app_fallback_does_not_interpret_shell_metacharacters(monkeypatch):
    """A name containing shell syntax must be passed through untouched."""
    started = []
    hostile = 'notepad" & calc & "'

    def exploding_popen(*args, **kwargs):
        raise OSError("primary launch failed")

    monkeypatch.setattr(system_tools.platform, "system", lambda: "Windows")
    monkeypatch.setattr(system_tools.subprocess, "Popen", exploding_popen)
    monkeypatch.setattr(system_tools.os, "startfile", started.append, raising=False)
    # Verification is not what this test is about; skip it so the assertion
    # below is about the launcher argument only.
    monkeypatch.setattr(system_tools, "_await_new_window", lambda before, name: "Opened")
    monkeypatch.setattr(system_tools, "LAUNCH_TIMEOUT_SECONDS", 0.3)

    system_tools.open_app(hostile)

    assert started == [hostile], "name must reach the launcher verbatim, not a shell"


def test_open_app_raises_plainly_when_both_paths_fail(monkeypatch):
    def exploding(*args, **kwargs):
        raise OSError("nope")

    monkeypatch.setattr(system_tools.platform, "system", lambda: "Windows")
    monkeypatch.setattr(system_tools.subprocess, "Popen", exploding)
    monkeypatch.setattr(system_tools.os, "startfile", exploding, raising=False)

    with pytest.raises(UserFacingError) as excinfo:
        system_tools.open_app("nonexistent-app")

    message = str(excinfo.value)
    assert "nonexistent-app" in message
    assert "Traceback" not in message


# ─── run_terminal stays gated ───


def test_run_terminal_requires_approval():
    """
    run_terminal keeps shell semantics on purpose, so its safety comes from
    always requiring explicit human approval before it executes.
    """
    assert "run_terminal" in HITL_TOOLS

    steps = validate_plan([{"tool": "run_terminal", "label": "", "args": {"command": "dir"}}])
    assert steps[0]["requires_approval"] is True


def test_run_terminal_still_executes():
    result = system_tools.run_terminal(f'"{sys.executable}" -c "print(42)"')
    assert "42" in result


def test_run_terminal_reports_failure_without_raising():
    result = system_tools.run_terminal(f'"{sys.executable}" -c "import sys; sys.exit(3)"')
    assert "failed" in result.lower()


# ─── Launch verification ───


class _WindowSnapshots:
    """Returns a scripted sequence of window snapshots."""

    def __init__(self, *snapshots):
        self._snapshots = list(snapshots)

    def __call__(self):
        return self._snapshots.pop(0) if len(self._snapshots) > 1 else self._snapshots[0]


def test_common_app_names_are_normalised():
    """
    Spoken names are not executables. Without this, "calculator" becomes
    `start "" calculator`, which Windows cannot resolve.
    """
    table = system_tools.WINDOWS_APP_COMMANDS
    assert table["calculator"] == "ms-calculator:"
    assert table["paint"] == "mspaint"
    assert table["task manager"] == "taskmgr"
    assert table["word"] == "winword"
    for spoken in ("calculator", "settings", "notepad", "terminal"):
        assert spoken in table


def test_launch_reports_failure_when_no_window_appears(monkeypatch):
    """`cmd /c start` succeeds if cmd ran, so the window is the real evidence."""
    monkeypatch.setattr(system_tools.platform, "system", lambda: "Windows")
    monkeypatch.setattr(system_tools.subprocess, "Popen", lambda *a, **k: None)
    monkeypatch.setattr(system_tools, "_visible_windows", lambda: {})
    monkeypatch.setattr(system_tools, "LAUNCH_TIMEOUT_SECONDS", 0.3)

    with pytest.raises(UserFacingError) as excinfo:
        system_tools.open_app("nonexistent-app")

    message = str(excinfo.value)
    assert "nonexistent-app" in message
    assert "Traceback" not in message


def test_error_dialog_does_not_count_as_a_launch(monkeypatch):
    """
    Windows names its "cannot find" dialog after the app you asked for, so a
    naive window check reads the failure as a success.
    """
    monkeypatch.setattr(system_tools, "LAUNCH_TIMEOUT_SECONDS", 0.3)
    before = {}
    after = {1: ("definitely-not-an-app", "#32770")}
    monkeypatch.setattr(system_tools, "_visible_windows", lambda: after)

    assert system_tools._await_new_window(before, "definitely-not-an-app") is None


def test_a_real_window_counts_as_a_launch(monkeypatch):
    monkeypatch.setattr(system_tools, "LAUNCH_TIMEOUT_SECONDS", 0.5)
    before = {}
    after = {2: ("Calculator", "ApplicationFrameWindow")}
    monkeypatch.setattr(system_tools, "_visible_windows", lambda: after)

    assert system_tools._await_new_window(before, "calculator") == "Calculator"


def test_an_already_running_app_counts(monkeypatch):
    """Launching a running app focuses it rather than opening a new window."""
    monkeypatch.setattr(system_tools, "LAUNCH_TIMEOUT_SECONDS", 0.5)
    existing = {3: ("Untitled - Notepad", "Notepad")}
    monkeypatch.setattr(system_tools, "_visible_windows", lambda: existing)

    assert system_tools._await_new_window(existing, "notepad") == "Untitled - Notepad"


def test_launched_apps_do_not_inherit_torch_stdio():
    """
    A child holding TORCH's pipes keeps them open for its whole lifetime, which
    blocks anything reading the backend's output.
    """
    assert system_tools._DETACHED["stdout"] is subprocess.DEVNULL
    assert system_tools._DETACHED["stderr"] is subprocess.DEVNULL
    assert system_tools._DETACHED["stdin"] is subprocess.DEVNULL
