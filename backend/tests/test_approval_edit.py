"""
Editing a step's arguments before approving it.

The Edit button previously sent no data and the executor ignored the action, so
a user who corrected an email recipient watched the step run against the
original value. Approving something other than what was shown is the worst
possible outcome for a confirmation prompt.
"""

import asyncio

import pytest

from agent.executor import Executor


@pytest.fixture
def executor():
    return Executor()


async def test_edited_arguments_are_returned_to_the_caller(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-1", "client-a"))
    await asyncio.sleep(0)

    executor.submit_approval("step-1", "edit", {"to": "correct@example.com"})
    action, edits = await waiter

    assert action == "edit"
    assert edits == {"to": "correct@example.com"}


async def test_plain_approval_carries_no_edits(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-2", "client-a"))
    await asyncio.sleep(0)

    executor.submit_approval("step-2", "approve")
    action, edits = await waiter

    assert action == "approve"
    assert edits is None


async def test_edits_are_ignored_on_a_cancel(executor):
    """A cancel must not smuggle argument changes into a step that never runs."""
    waiter = asyncio.create_task(executor._wait_for_approval("step-3", "client-a"))
    await asyncio.sleep(0)

    executor.submit_approval("step-3", "cancel", {"to": "attacker@example.com"})
    action, edits = await waiter

    assert action == "cancel"
    assert edits is None


async def test_timeout_returns_cancel_with_no_edits(executor):
    action, edits = await executor._wait_for_approval("step-4", "client-a", timeout=0.05)
    assert action == "cancel"
    assert edits is None


async def test_edit_state_is_cleaned_up(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-5", "client-a"))
    await asyncio.sleep(0)
    executor.submit_approval("step-5", "edit", {"to": "x@example.com"})
    await waiter

    assert "step-5" not in executor._approval_edits
    assert "step-5" not in executor._approval_events


async def test_non_dict_edits_are_rejected(executor):
    waiter = asyncio.create_task(executor._wait_for_approval("step-6", "client-a"))
    await asyncio.sleep(0)

    executor.submit_approval("step-6", "edit", "not-a-dict")  # type: ignore[arg-type]
    action, edits = await waiter

    assert action == "edit"
    assert edits is None


def test_stop_releases_a_pending_edit_without_applying_it(executor):
    """Stop must not run the step with half-entered values."""

    async def scenario():
        waiter = asyncio.create_task(executor._wait_for_approval("step-7", "client-a"))
        await asyncio.sleep(0)
        executor.stop_task("client-a")
        return await asyncio.wait_for(waiter, timeout=1)

    action, edits = asyncio.run(scenario())
    assert action == "cancel"
    assert edits is None
