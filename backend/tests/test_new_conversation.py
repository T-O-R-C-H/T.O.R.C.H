"""
"New chat" must clear what the agent remembers, not just what the UI shows.

The screen used to empty while the model still held the previous turns, so a
pronoun in a fresh conversation could resolve to something from the one the
user had just closed.
"""

import pytest

import main as backend_main
from agent.context import ConversationContext


@pytest.mark.asyncio
async def test_new_conversation_clears_only_that_clients_context():
    ConversationContext.get_context("client-a")
    ConversationContext.get_context("client-b")

    await backend_main.handle_ws_message({"type": "new_conversation"}, "client-a")

    assert "client-a" not in ConversationContext._contexts
    assert "client-b" in ConversationContext._contexts
    ConversationContext.clear_context("client-b")


@pytest.mark.asyncio
async def test_new_conversation_is_harmless_with_no_context():
    await backend_main.handle_ws_message({"type": "new_conversation"}, "never-seen")
    assert "never-seen" not in ConversationContext._contexts


@pytest.mark.asyncio
async def test_metrics_report_no_invented_numbers(temp_db, monkeypatch):
    import memory.storage as storage

    monkeypatch.setattr(storage, "db", temp_db)
    metrics = await backend_main.get_current_metrics()

    # Nothing measures time saved, so it must not come back at all.
    assert "timeSaved" not in metrics
    assert "timeDelta" not in metrics
    # No tasks yet: no rate, rather than a perfect score for doing nothing.
    assert metrics["successRate"] is None
    assert metrics["successDelta"] is None
    assert metrics["tasksCompleted"] == 0


def test_an_open_invitation_is_not_drawn_as_a_question_to_answer():
    import main

    plain = (
        "I'm TORCH, your AI agent. I can find and read files, send emails, search "
        "the web, and control your browser and apps. What would you like to do?"
    )
    assert main._is_clarifying_question(plain) is False
    assert main._is_clarifying_question("Hey! What can I help you with today?") is False
    assert main._is_clarifying_question("Sure. How would you like to start?") is False
    # A question TORCH is genuinely blocked on still gets the answer box.
    assert main._is_clarifying_question("Which John do you mean?") is True
    assert main._is_clarifying_question("I found two files. Which one should I send?") is True
