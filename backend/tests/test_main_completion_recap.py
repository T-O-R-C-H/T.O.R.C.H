"""
What the user is told when a task ends.

A failed task used to finish silently — the steps showed a problem inline but
no message was ever sent, which reads as the agent having ignored the request.
Equally, a failure must never be reported as success.
"""

from unittest.mock import AsyncMock, patch

import pytest

import main as backend_main


def _step(status, label="Doing the thing", error=None, tool="find_file", result=None):
    return {
        "id": "step-1",
        "tool": tool,
        "label": label,
        "args": {},
        "status": status,
        "requires_approval": False,
        "result": result,
        "error": error,
    }


async def _run_command(
    executed_steps,
    command="do the thing",
    request_id=None,
    outcome_events=None,
):
    """
    Drive process_command with planning and execution stubbed out, and collect
    every agent_response it sends.
    """
    responses = []

    async def capture(message, client_id="main"):
        responses.append(message)

    async def capture_event(message, client_id="main"):
        if outcome_events is not None and message.get("type") == "task_outcome":
            outcome_events.append(message)

    plan = [{"tool": s["tool"], "label": s["label"], "args": {}} for s in executed_steps]

    with (
        patch.object(backend_main, "plan_command", new=AsyncMock(return_value=plan)),
        patch.object(
            backend_main.executor, "execute_plan", new=AsyncMock(return_value=executed_steps)
        ),
        patch.object(backend_main.executor, "is_cancelled", return_value=False),
        patch.object(backend_main.ws_manager, "send_agent_response", new=AsyncMock(side_effect=capture)),
        patch.object(backend_main.ws_manager, "send_status", new=AsyncMock()),
        patch.object(backend_main.ws_manager, "send_terminal_line", new=AsyncMock()),
        patch.object(backend_main.ws_manager, "send_metrics", new=AsyncMock()),
        patch.object(
            backend_main.ws_manager,
            "send_message",
            new=AsyncMock(side_effect=capture_event),
        ),
        patch.object(backend_main, "get_current_metrics", new=AsyncMock(return_value={})),
    ):
        await backend_main.process_command(
            command, "client-a", request_id=request_id
        )

    return responses


def _contents(responses):
    return " ".join(str(r.get("content", "")) for r in responses)


# ─── Failure ───


async def test_failed_task_sends_a_closing_message():
    responses = await _run_command([_step("failed", error="I couldn't find that file.")])

    assert responses, "a failed task must still say something in the chat"


async def test_failed_task_surfaces_the_reason():
    responses = await _run_command([_step("failed", error="I couldn't find that file.")])

    assert "couldn't find that file" in _contents(responses)


async def test_failed_task_is_never_reported_as_success():
    responses = await _run_command([_step("failed", error="I couldn't find that file.")])

    text = _contents(responses).lower()
    for claim in ["completed the task successfully", "done!", "all set"]:
        assert claim not in text


async def test_failure_without_an_error_string_still_names_the_step():
    responses = await _run_command([_step("failed", label="Sending your email", error=None)])

    assert "Sending your email" in _contents(responses)


async def test_partial_failure_is_reported_as_failure():
    """One broken step means the task did not succeed, whatever else ran."""
    responses = await _run_command(
        [
            _step("done", label="Found the file"),
            _step("failed", label="Sending your email", error="I couldn't sign into your email."),
        ]
    )

    text = _contents(responses).lower()
    assert "couldn't" in text
    assert "your email was sent" not in text


async def test_failure_message_carries_no_technical_jargon():
    responses = await _run_command([_step("failed", error="I couldn't find that file.")])

    text = _contents(responses)
    for jargon in ["Traceback", "Exception", "None", "status=", "{"]:
        assert jargon not in text


# ─── Success ───


async def test_successful_task_sends_a_recap():
    responses = await _run_command(
        [_step("done", tool="send_email", label="Sending your email")],
        command="email john",
    )

    assert "sent" in _contents(responses).lower()


async def test_successful_task_emits_one_correlated_terminal_outcome():
    outcomes = []

    await _run_command(
        [_step("done", tool="list_directory", result="Contents of C:\\Users\\Alex")],
        request_id="onboarding-1",
        outcome_events=outcomes,
    )

    assert outcomes == [
        {
            "type": "task_outcome",
            "requestId": "onboarding-1",
            "status": "completed",
            "summary": "Contents of C:\\Users\\Alex",
        }
    ]


async def test_failed_task_emits_failure_not_completion():
    outcomes = []

    await _run_command(
        [_step("failed", error="I couldn't read that folder.")],
        request_id="onboarding-2",
        outcome_events=outcomes,
    )

    assert len(outcomes) == 1
    assert outcomes[0]["requestId"] == "onboarding-2"
    assert outcomes[0]["status"] == "failed"
    assert "couldn't read that folder" in outcomes[0]["summary"]
