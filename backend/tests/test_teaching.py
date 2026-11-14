"""Teaching and doing in one conversation, and the service that looks at the screen."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from agent import companion, teaching, vision_model
from agent.planner import SCREEN_OFF_MESSAGE, validate_plan
from config.settings import settings
from errors.plain_language import UserFacingError


@pytest.mark.parametrize(
    "command",
    [
        "how do i import a video",
        "hey torch, how can I add text here",
        "show me how to import a video",
        "where is the export button",
        "i want to learn Capcut but i am kinda too busy",
        "what does this button do",
        "explain the timeline",
    ],
)
def test_questions_are_teaching_requests(command):
    assert teaching.is_teaching_request(command)


@pytest.mark.parametrize(
    "command",
    [
        "find my cv",
        "open capcut",
        "send the report to John",
        "do it for me",
        "delete the old folder",
        "what is the capital of France",
    ],
)
def test_commands_are_not_teaching_requests(command):
    assert not teaching.is_teaching_request(command)


@pytest.mark.parametrize(
    "command", ["do it for me", "just do it", "ok do it", "go ahead", "you do it please"]
)
def test_do_it_phrases(command):
    assert teaching.is_do_it_request(command)


@pytest.mark.parametrize(
    "command", ["do it tomorrow", "do the dishes", "do it again with the other file"]
)
def test_longer_instructions_are_left_to_the_planner(command):
    assert not teaching.is_do_it_request(command)


def _lesson():
    return {
        "user_command": "how do i open capcut",
        "reply_summary": "Click the CapCut icon on your desktop.",
        "step_results": [{"tool": teaching.TEACH_TOOL, "status": "done"}],
    }


def test_do_it_after_a_lesson_becomes_that_one_step():
    plan = teaching.follow_up_plan("do it for me", [_lesson()])
    assert plan is not None and len(plan) == 1
    assert plan[0]["tool"] == "vision_control"
    assert "Click the CapCut icon" in plan[0]["args"]["task"]
    assert "nothing more" in plan[0]["args"]["task"]


def test_do_it_without_a_lesson_is_left_to_the_planner():
    ordinary = {"user_command": "find my cv", "reply_summary": "Found it.", "step_results": []}
    assert teaching.follow_up_plan("do it for me", []) is None
    assert teaching.follow_up_plan("do it for me", [ordinary]) is None
    # A lesson two turns back is stale: "it" is no longer that step.
    assert teaching.follow_up_plan("do it for me", [_lesson(), ordinary]) is None


def test_screen_tools_are_refused_until_the_user_allows_them(monkeypatch):
    monkeypatch.setattr(settings, "allow_screen", False)
    plan = validate_plan(
        [{"tool": "vision_control", "label": "Click", "args": {"task": "click ok"}}]
    )
    assert plan[0]["tool"] == "error"
    assert plan[0]["error"] == SCREEN_OFF_MESSAGE
    assert "AI service" in SCREEN_OFF_MESSAGE


def test_screen_permission_is_off_unless_the_user_turns_it_on():
    assert type(settings).model_fields["allow_screen"].default is False


# ── The service that looks at the screen ──


def test_chosen_service_goes_first_and_the_other_is_the_fallback(monkeypatch):
    monkeypatch.setattr(settings, "deepseek_api_key", "d")
    monkeypatch.setattr(settings, "anthropic_api_key", "a")
    monkeypatch.setattr(settings, "active_provider", "claude")
    assert vision_model.vision_providers() == ["claude", "deepseek"]
    monkeypatch.setattr(settings, "active_provider", "")
    assert vision_model.vision_providers() == ["deepseek", "claude"]
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    assert vision_model.vision_providers() == ["deepseek"]


def test_no_key_says_where_to_add_one(monkeypatch):
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(vision_model.VisionUnavailable) as raised:
        vision_model.ask_vision_sync("system", "text", ["image"])
    assert "Settings" in str(raised.value)


def test_a_failing_service_falls_back_and_never_leaks_its_error():
    def broken(*_args):
        raise RuntimeError("429 insufficient_quota sk-secret")

    with patch.dict(
        vision_model._PROVIDERS,
        {"deepseek": broken, "claude": lambda *_args: '{"ok": true}'},
    ):
        assert (
            vision_model.ask_vision_sync("s", "t", ["i"], providers=["deepseek", "claude"])
            == '{"ok": true}'
        )
        with pytest.raises(vision_model.VisionUnavailable) as raised:
            vision_model.ask_vision_sync("s", "t", ["i"], providers=["deepseek"])
    assert "sk-secret" not in str(raised.value)
    assert "429" not in str(raised.value)


# ── Answering about the screen ──


def _screens():
    return [
        {
            "dataUrl": "data:image/png;base64,AAAA",
            "width": 960,
            "height": 540,
            "bounds": {"x": 0, "y": 0, "width": 1920, "height": 1080},
        }
    ]


def test_answer_points_at_the_middle_of_the_box_in_desktop_pixels():
    reply = (
        '{"speech": "Click the CapCut icon.", "guidance": {"type": "point", '
        '"screen_index": 0, "box_2d": [400, 200, 600, 400], "label": "CapCut"}}'
    )
    with patch.object(companion, "ask_vision_sync", return_value=reply) as ask:
        result = asyncio.run(companion.answer_with_screen("how do i open it", _screens(), []))

    assert result["speech"] == "Click the CapCut icon."
    assert result["guidance"] == {"type": "point", "x": 576.0, "y": 540.0, "label": "CapCut"}
    # The picture goes as PNG, exactly as captured.
    assert ask.call_args.args[2] == ["AAAA"]
    assert ask.call_args.args[3] == "image/png"


def test_answer_takes_no_audio():
    """Voice never leaves the machine, so there is no way to pass audio in."""
    import inspect

    assert "audio" not in inspect.signature(companion.answer_with_screen).parameters
    source = inspect.getsource(companion)
    assert "generativelanguage" not in source and "gemini" not in source.lower()


def test_unreadable_answer_is_a_plain_message():
    with patch.object(companion, "ask_vision_sync", return_value="not json at all"):
        with pytest.raises(UserFacingError):
            asyncio.run(companion.answer_with_screen("what is this", _screens(), []))


# ── The chat pipeline ──


@pytest.fixture
def pipeline(monkeypatch):
    import main

    sent = {"responses": [], "overlay": [], "outcomes": []}

    async def agent_response(message, client_id="main"):
        sent["responses"].append(message)

    async def overlay(**kwargs):
        sent["overlay"].append(kwargs)

    async def outcome(client_id, request_id, status, text):
        sent["outcomes"].append((status, text))

    monkeypatch.setattr(main.ws_manager, "send_agent_response", agent_response)
    monkeypatch.setattr(main.ws_manager, "send_overlay_event", overlay)
    monkeypatch.setattr(main.ws_manager, "send_status", AsyncMock())
    monkeypatch.setattr(main.ws_manager, "send_terminal_line", AsyncMock())
    monkeypatch.setattr(main.ws_manager, "send_message", AsyncMock())
    monkeypatch.setattr(main, "_send_task_outcome", outcome)
    from agent.context import ConversationContext

    monkeypatch.setattr(ConversationContext, "_persist_to_db", lambda *_a, **_k: None)
    ConversationContext.clear_context("teach-client")
    return main, sent


def test_a_question_is_answered_and_pointed_at_without_planning(pipeline, monkeypatch):
    main, sent = pipeline
    planned = AsyncMock()
    monkeypatch.setattr(main, "plan_command", planned)
    monkeypatch.setattr(
        teaching,
        "look_and_teach",
        AsyncMock(
            return_value={
                "speech": "Click the CapCut icon.",
                "guidance": {"type": "point", "x": 5, "y": 6, "label": "CapCut", "space": "physical"},
            }
        ),
    )

    asyncio.run(main.process_command("how do i open capcut", "teach-client"))

    planned.assert_not_awaited()
    assert sent["responses"][0]["content"] == "Click the CapCut icon."
    assert sent["responses"][0]["steps"] == []
    assert sent["overlay"][0]["guidance"]["type"] == "point"
    assert sent["outcomes"] == [("completed", "Click the CapCut icon.")]

    from agent.context import ConversationContext

    context = ConversationContext.get_context("teach-client")
    assert teaching.follow_up_plan("do it for me", context) is not None


def test_a_screen_question_with_the_permission_off_says_how_to_turn_it_on(pipeline, monkeypatch):
    main, sent = pipeline
    monkeypatch.setattr(settings, "allow_screen", False)
    look = AsyncMock()
    monkeypatch.setattr(teaching, "look_and_teach", look)

    asyncio.run(main.process_command("where is the export button", "teach-client"))

    look.assert_not_awaited()
    assert sent["responses"][0]["content"] == SCREEN_OFF_MESSAGE
    assert sent["outcomes"][0][0] == "failed"


def test_a_failed_look_says_so_and_is_not_remembered_as_a_lesson(pipeline, monkeypatch):
    main, sent = pipeline
    monkeypatch.setattr(
        teaching,
        "look_and_teach",
        AsyncMock(side_effect=RuntimeError("Traceback: connection reset by peer")),
    )

    asyncio.run(main.process_command("show me how to import a video", "teach-client"))

    assert sent["outcomes"][0][0] == "failed"
    assert "Traceback" not in sent["responses"][0]["content"]
    assert sent["overlay"] == []

    from agent.context import ConversationContext

    assert ConversationContext.get_context("teach-client") == []


def test_an_empty_reply_is_asked_again_before_giving_up():
    replies = iter(["", '{"ok": true}'])
    with patch.dict(vision_model._PROVIDERS, {"deepseek": lambda *_a: next(replies)}):
        assert (
            vision_model.ask_vision_sync("s", "t", ["i"], providers=["deepseek"])
            == '{"ok": true}'
        )
    calls = []

    def always_empty(*_args):
        calls.append(1)
        return ""

    with patch.dict(vision_model._PROVIDERS, {"deepseek": always_empty}):
        with pytest.raises(vision_model.VisionUnavailable):
            vision_model.ask_vision_sync("s", "t", ["i"], providers=["deepseek"])
    assert len(calls) == 1 + vision_model.EMPTY_REPLY_RETRIES


def test_a_failed_click_by_name_is_retried_by_looking(monkeypatch):
    import main

    monkeypatch.setattr(vision_model, "vision_providers", lambda: ["deepseek"])
    steps = [
        {"tool": "click_element", "label": "Clicked it.", "status": "done"},
        {"tool": "click_element", "label": "Click 2", "status": "failed"},
    ]
    plan = main._plan_by_sight("work out 25 times 4\n\nConnection status: ...", steps)
    assert plan is not None and plan[0]["tool"] == "vision_control"
    assert plan[0]["args"]["task"].startswith("work out 25 times 4.")
    assert "do not repeat" in plan[0]["args"]["task"]

    # Not when the user has not allowed looking at the screen...
    monkeypatch.setattr(settings, "allow_screen", False)
    assert main._plan_by_sight("work out 25 times 4", steps) is None
    monkeypatch.setattr(settings, "allow_screen", True)
    # ...not for other kinds of failure...
    assert main._plan_by_sight("send it", [{"tool": "send_email", "status": "failed"}]) is None
    # ...and never when the plan held a step that needed approval.
    risky = steps + [{"tool": "send_email", "status": "pending", "requires_approval": True}]
    assert main._plan_by_sight("click and send", risky) is None


def test_a_blind_click_plan_becomes_one_look_then_act_step(monkeypatch):
    import main

    monkeypatch.setattr(vision_model, "vision_providers", lambda: ["deepseek"])
    blind = [
        {"tool": "open_app", "label": "Open Calculator", "args": {"name": "calculator"}},
        {"tool": "read_screen", "label": "Read", "args": {}},
        {"tool": "click_element", "label": "Click 9", "args": {"name": "9"}},
        {"tool": "click_element", "label": "Click =", "args": {"name": "="}},
        {"tool": "read_screen", "label": "Read", "args": {}},
    ]
    plan = main._prefer_sight("work out 9 times 7\n\nstatus block", blind)
    assert [step["tool"] for step in plan] == ["open_app", "vision_control"]
    assert plan[1]["args"]["task"].startswith("work out 9 times 7.")
    # What the planner meant is carried over, so "do it for me" keeps its meaning.
    assert "Click 9; Click =" in plan[1]["args"]["task"]

    # Plans that are not purely on-screen are left exactly as written.
    files = [{"tool": "find_file", "label": "Find", "args": {"query": "cv"}}]
    assert main._prefer_sight("find my cv", files) is files
    mixed = blind + [{"tool": "send_email", "label": "Send", "args": {}}]
    assert main._prefer_sight("do it and email it", mixed) is mixed
    only_reading = [{"tool": "read_screen", "label": "Read", "args": {}}]
    assert main._prefer_sight("what is on screen", only_reading) is only_reading

    # And nothing changes while looking at the screen is switched off.
    monkeypatch.setattr(settings, "allow_screen", False)
    assert main._prefer_sight("work out 9 times 7", blind) is blind


def _reply(message):
    return [{"tool": "respond", "label": "Replying", "args": {"message": message}}]


def test_a_reply_that_claims_the_work_is_done_is_recognised():
    import main

    lie = _reply(
        "Done — I opened the Calculator and worked it out. 9 × 7 = 63. "
        "The result is showing on your screen now."
    )
    assert main._is_unbacked_claim("open the calculator and work out 9 times 7", lie)
    assert main._is_unbacked_claim("email the report to John", _reply("I've sent the email."))
    # Ordinary conversation is untouched.
    assert not main._is_unbacked_claim("hey", _reply("Hey! What can I help you with today?"))
    assert not main._is_unbacked_claim(
        "send it", _reply("Which file should I send?")
    )
    # A question about earlier work may be answered in the past tense.
    assert not main._is_unbacked_claim("did you send the email?", _reply("I sent it earlier."))
    # A real plan is never a claim.
    real = [{"tool": "open_app", "label": "Open", "args": {"name": "calculator"}}]
    assert not main._is_unbacked_claim("open calculator", real)


def test_a_false_done_is_replanned_and_never_shown(pipeline, monkeypatch):
    main, sent = pipeline
    lie = _reply("Done — 9 × 7 = 63. The result is showing on your screen now.")
    planned = AsyncMock(side_effect=[lie, lie])
    monkeypatch.setattr(main, "plan_command", planned)

    asyncio.run(main.process_command("work out 9 times 7 on the calculator", "teach-client"))

    assert planned.await_count == 2
    assert "nothing has been done yet" in planned.await_args_list[1].args[0]
    shown = sent["responses"][0]["content"]
    assert "63" not in shown and "haven't done anything" in shown
