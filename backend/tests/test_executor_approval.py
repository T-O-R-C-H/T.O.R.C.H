"""
Approval and cancellation plumbing.

A step waiting on confirmation must resume on approval, refuse on cancel, and
never hang forever — and Stop has to release a waiting step rather than leaving
the agent parked.
"""

import asyncio

import pytest

from agent.executor import Executor


@pytest.fixture
def executor():
    """A fresh instance, so tests never share the module-level singleton."""
    return Executor()


# ─── Approval resolution ───


async def test_approval_resolves_with_the_submitted_action(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-1", "client-a"))
    await asyncio.sleep(0)  # let the waiter register its event

    assert executor.submit_approval("step-1", "approve") is True
    assert await waiter == "approve"


async def test_cancel_action_is_returned(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-2", "client-a"))
    await asyncio.sleep(0)

    executor.submit_approval("step-2", "cancel")
    assert await waiter == "cancel"


async def test_approval_times_out_to_cancel(executor):
    """Defaulting to 'cancel' keeps an unanswered prompt from acting on its own."""
    assert await executor._wait_for_approval("step-3", "client-a", timeout=0.05) == "cancel"


async def test_approval_state_is_cleaned_up(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-4", "client-a"))
    await asyncio.sleep(0)
    executor.submit_approval("step-4", "approve")
    await waiter

    assert "step-4" not in executor._approval_events
    assert "step-4" not in executor._approval_clients


# ─── submit_approval guards ───


def test_submit_approval_rejects_unknown_step(executor):
    assert executor.submit_approval("never-registered", "approve") is False


@pytest.mark.parametrize("action", ["yes", "", "APPROVE", "delete"])
async def test_submit_approval_rejects_invalid_actions(executor, action):
    waiter = asyncio.create_task(executor._wait_for_approval("step-5", "client-a"))
    await asyncio.sleep(0)
    try:
        assert executor.submit_approval("step-5", action) is False
    finally:
        executor.submit_approval("step-5", "cancel")
        await waiter


async def test_second_approval_for_same_step_is_ignored(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-6", "client-a"))
    await asyncio.sleep(0)

    assert executor.submit_approval("step-6", "approve") is True
    assert executor.submit_approval("step-6", "cancel") is False
    assert await waiter == "approve"


# ─── Stop releases waiting approvals ───


async def test_stop_task_releases_a_pending_approval(executor):
    """
    Stop must unblock a step waiting on confirmation. Without a recorded
    result the waiter falls back to 'cancel', so Stop never approves anything.
    """
    waiter = asyncio.create_task(executor._wait_for_approval("step-7", "client-a"))
    await asyncio.sleep(0)

    executor.stop_task("client-a")

    assert await asyncio.wait_for(waiter, timeout=1) == "cancel"


async def test_stop_task_only_releases_the_requesting_client(executor):
    other = asyncio.create_task(executor._wait_for_approval("step-8", "client-b"))
    await asyncio.sleep(0)

    executor.stop_task("client-a")
    await asyncio.sleep(0.05)

    assert not other.done(), "another client's approval should be untouched"

    executor.submit_approval("step-8", "approve")
    assert await other == "approve"


# ─── Tool registry ───


def test_tool_registry_exposes_expected_tools(executor):
    for tool in ["find_file", "send_email", "run_terminal", "open_app"]:
        assert tool in executor._tool_registry


def test_tool_registry_accepts_injected_fakes(executor):
    """Tests substitute tools here rather than patching the tools package."""
    executor._tool_registry["find_file"] = lambda **kwargs: "stubbed"
    assert executor._tool_registry["find_file"]() == "stubbed"
