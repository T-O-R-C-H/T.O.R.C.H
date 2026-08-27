"""
The blue border that says TORCH is driving the screen.

Two things matter. It must appear whenever TORCH takes the mouse or keyboard,
and it must always come down. A border left up is a full-screen overlay sitting
on the user's display for the rest of the session.
"""

import asyncio

import pytest

from agent.executor import SCREEN_CONTROL_TOOLS, Executor


class RecordingWsManager:
    """Captures messages instead of sending them."""

    def __init__(self):
        self.messages = []

    async def send_message(self, message, client_id="main"):
        self.messages.append(message)

    def __getattr__(self, _name):
        async def noop(*args, **kwargs):
            return None

        return noop

    def types(self):
        return [m.get("type") for m in self.messages if isinstance(m, dict)]


@pytest.fixture
def executor(monkeypatch):
    import agent.executor as executor_module

    recorder = RecordingWsManager()
    monkeypatch.setattr(executor_module, "ws_manager", recorder)
    instance = Executor()
    instance.recorder = recorder  # type: ignore[attr-defined]
    return instance


# ─── Which tools count as taking control ───


def test_input_driving_tools_raise_the_border():
    assert "click_element" in SCREEN_CONTROL_TOOLS
    assert "type_into" in SCREEN_CONTROL_TOOLS


def test_reading_the_screen_does_not_raise_the_border():
    """Looking at the screen is not taking control of it."""
    for tool in ["read_screen", "describe_screen", "screenshot", "find_file"]:
        assert tool not in SCREEN_CONTROL_TOOLS


# ─── Raising and clearing ───


async def test_border_is_raised_once_for_a_run(executor):
    await executor.show_screen_control("client-a")
    await executor.show_screen_control("client-a")

    assert executor.recorder.types().count("uia_control_start") == 1


async def test_border_clears(executor):
    await executor.show_screen_control("client-a")
    await executor.clear_screen_control("client-a")

    assert executor.recorder.types() == ["uia_control_start", "uia_control_end"]


async def test_clearing_an_unraised_border_sends_nothing(executor):
    """Every exit path calls this unconditionally, so it must be harmless."""
    await executor.clear_screen_control("client-a")
    assert executor.recorder.types() == []


async def test_clearing_twice_sends_one_end(executor):
    await executor.show_screen_control("client-a")
    await executor.clear_screen_control("client-a")
    await executor.clear_screen_control("client-a")

    assert executor.recorder.types().count("uia_control_end") == 1


async def test_border_is_tracked_per_client(executor):
    await executor.show_screen_control("client-a")
    await executor.clear_screen_control("client-b")

    # client-b never had one, so client-a's is untouched.
    assert "client-a" in executor._screen_control_clients


# ─── Stop ───


async def test_stop_takes_the_border_down_immediately(executor):
    """
    Stop means the user wants their screen back now, not once the current step
    finishes unwinding.
    """
    await executor.show_screen_control("client-a")
    executor.stop_task("client-a")
    await asyncio.sleep(0)  # let the scheduled send run

    assert "uia_control_end" in executor.recorder.types()
    assert "client-a" not in executor._screen_control_clients


async def test_stop_does_not_disturb_another_client(executor):
    await executor.show_screen_control("client-a")
    executor.stop_task("client-b")
    await asyncio.sleep(0)

    assert "client-a" in executor._screen_control_clients
