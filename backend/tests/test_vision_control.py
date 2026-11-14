import asyncio
import json
import sys
import threading
import types
import unittest
from unittest.mock import ANY, AsyncMock, Mock, call, patch

from errors.plain_language import translate_error
from agent.executor import Executor
from agent.step_phrasing import get_plain_phrase
from tools import vision_control as vc


def _ollama_module(action):
    return types.SimpleNamespace(
        chat=lambda **_kwargs: {
            "message": {"content": json.dumps(action)}
        }
    )


def _as_model(fake):
    """Adapt a fake with a chat(**kwargs) method to ask_vision_sync's shape."""

    def ask(system, text, images, *_args, **_kwargs):
        reply = fake.chat(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text, "images": images},
            ]
        )
        return reply["message"]["content"]

    return ask


class VisionControlTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        vc._active_sessions.clear()
        vc._pending_clarifications.clear()
        settle_patch = patch.object(vc, "CAPTURE_OVERLAY_SETTLE_SECONDS", 0)
        settle_patch.start()
        self.addCleanup(settle_patch.stop)
        start_patch = patch.object(vc, "CONTROL_START_SETTLE_SECONDS", 0)
        start_patch.start()
        self.addCleanup(start_patch.stop)
        browser_chooser_patch = patch.object(vc, "BROWSER_CHOOSER_SETTLE_SECONDS", 0)
        browser_chooser_patch.start()
        self.addCleanup(browser_chooser_patch.stop)
        browser_window_patch = patch.object(vc, "BROWSER_WINDOW_SETTLE_SECONDS", 0)
        browser_window_patch.start()
        self.addCleanup(browser_window_patch.stop)

    async def test_failed_action_raises_and_always_emits_end(self):
        ollama = _ollama_module({"action": "failed", "reason": "button missing"})
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
        ):
            with self.assertRaisesRegex(vc.UserFacingError, "button missing"):
                await vc.vision_loop("do it", client_id="alpha", task_id="task-1")

        self.assertEqual(send.await_args_list[-1].args[0]["type"], "vision_control_end")
        self.assertNotIn("alpha", vc._active_sessions)

    async def test_max_steps_raises_instead_of_returning_success(self):
        ollama = _ollama_module({"action": "wait", "reason": "still loading"})
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            with self.assertRaisesRegex(vc.UserFacingError, "more steps than I allow"):
                await vc.vision_loop("do it", max_steps=1, task_id="task-2")

    async def test_rejected_pointer_action_is_not_executed_and_can_recover(self):
        actions = iter(
            [
                {"action": "click", "x": 5000, "y": 10, "reason": "bad target"},
                {"action": "done", "reason": "recovered safely"},
            ]
        )
        ollama = types.SimpleNamespace(
            chat=lambda **_kwargs: {
                "message": {"content": json.dumps(next(actions))}
            }
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "virtual_screen_bounds", return_value=(0, 0, 1920, 1080)),
            patch.object(vc.pyautogui, "click") as click,
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            result = await vc.vision_loop("do it", max_steps=2, task_id="task-safe")

        self.assertEqual(result, "Done: recovered safely")
        click.assert_not_called()

    async def test_stop_while_model_is_thinking_prevents_the_action(self):
        started = threading.Event()
        release = threading.Event()

        def chat(**_kwargs):
            started.set()
            release.wait(timeout=2)
            return {"message": {"content": json.dumps({"action": "click", "x": 2, "y": 3})}}

        ollama = types.SimpleNamespace(chat=chat)
        execute = Mock()
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action", new=execute),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
        ):
            task = asyncio.create_task(
                vc.vision_loop("click it", client_id="alpha", task_id="task-3")
            )
            await asyncio.to_thread(started.wait, 1)
            self.assertEqual(vc.cancel_vision_control("alpha", "task-3"), 1)
            try:
                with self.assertRaises(vc.VisionControlCancelled):
                    await asyncio.wait_for(task, timeout=0.5)
            finally:
                release.set()

        execute.assert_not_called()
        self.assertEqual(send.await_args_list[-1].args[0]["type"], "vision_control_end")

    async def test_cancellation_is_scoped_to_client_and_task(self):
        release = threading.Event()
        started_count = 0
        started_lock = threading.Lock()

        def chat(**_kwargs):
            nonlocal started_count
            with started_lock:
                started_count += 1
            release.wait(timeout=2)
            return {"message": {"content": json.dumps({"action": "done", "reason": "complete"})}}

        ollama = types.SimpleNamespace(chat=chat)
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            alpha = asyncio.create_task(vc.vision_loop("a", client_id="alpha", task_id="one"))
            beta = asyncio.create_task(vc.vision_loop("b", client_id="beta", task_id="two"))
            for _ in range(100):
                with started_lock:
                    if started_count == 2:
                        break
                await asyncio.sleep(0.01)
            self.assertEqual(vc.cancel_vision_control("alpha", "one"), 1)
            release.set()
            with self.assertRaises(vc.VisionControlCancelled):
                await alpha
            self.assertEqual(await beta, "Done: complete")

    async def test_no_ai_key_stops_with_a_message_the_user_can_act_on(self):
        from agent import vision_model

        with (
            patch.object(vision_model, "vision_providers", return_value=[]),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action") as execute,
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
        ):
            with self.assertRaises(vc.UserFacingError) as raised:
                await vc.vision_loop("click it", max_steps=1, task_id="no-key")

        self.assertIn("Settings", str(raised.exception))
        self.assertNotIn("ollama", str(raised.exception).lower())
        execute.assert_not_called()
        self.assertEqual(send.await_args_list[-1].args[0]["type"], "vision_control_end")

    async def test_handoff_waits_for_the_user_then_carries_on(self):
        actions = iter(
            [
                {"action": "handoff", "message": "Please enter your card details."},
                {"action": "done", "reason": "order 4471 is confirmed"},
            ]
        )
        fake = types.SimpleNamespace(
            chat=lambda **_kwargs: {"message": {"content": json.dumps(next(actions))}}
        )
        wait = AsyncMock(return_value=True)
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(fake)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "_wait_for_user_to_act", new=wait),
            patch.object(vc, "execute_action") as execute,
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
            patch.object(vc.ws_manager, "send_status", new=AsyncMock()) as status,
            patch.object(vc.ws_manager, "send_terminal_line", new=AsyncMock()),
        ):
            result = await vc.vision_loop("order a pizza", max_steps=3, task_id="pay")

        self.assertEqual(result, "Done: order 4471 is confirmed")
        # TORCH never performed the user's step.
        execute.assert_not_called()
        wait.assert_awaited_once()
        notices = [
            call.args[0]
            for call in send.await_args_list
            if call.args[0].get("type") == "attention_needed"
        ]
        self.assertEqual(len(notices), 1)
        self.assertEqual(notices[0]["message"], "Please enter your card details.")
        self.assertEqual(
            [call.args[0] for call in status.await_args_list],
            ["awaiting_input", "executing"],
        )

    async def test_handoff_that_nobody_answers_stops_and_says_so(self):
        fake = types.SimpleNamespace(
            chat=lambda **_kwargs: {
                "message": {
                    "content": json.dumps(
                        {"action": "handoff", "message": "Pick your video."}
                    )
                }
            }
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(fake)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "_wait_for_user_to_act", new=AsyncMock(return_value=False)),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
            patch.object(vc.ws_manager, "send_status", new=AsyncMock()),
            patch.object(vc.ws_manager, "send_terminal_line", new=AsyncMock()),
        ):
            with self.assertRaises(vc.UserFacingError) as raised:
                await vc.vision_loop("import a video", max_steps=3, task_id="idle")

        self.assertIn("waited", str(raised.exception))
        self.assertEqual(send.await_args_list[-1].args[0]["type"], "vision_control_end")

    async def test_a_profile_chooser_in_the_background_does_not_interrupt_other_tasks(self):
        requests = []

        def chat(**kwargs):
            requests.append(kwargs)
            return {"message": {"content": json.dumps({"action": "done", "reason": "63"})}}

        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(1280, 720),
            monitor_bounds=((0, 0, 1920, 1080),),
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(types.SimpleNamespace(chat=chat))),
            patch.object(vc, "take_screenshot", return_value=frame),
            patch.object(vc, "_named_controls_hint", return_value=""),
            patch.object(vc, "_chrome_profile_chooser_visible", return_value=True),
            patch.object(vc, "_chrome_profile_chooser_in_front", return_value=False),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            result = await vc.vision_loop("work out 9 times 7", max_steps=1, task_id="calc")

        self.assertEqual(result, "Done: 63")
        self.assertNotIn("ONLY permitted action is ask", requests[0]["messages"][1]["content"])

    async def test_the_models_own_progress_note_is_fed_back_to_it(self):
        requests = []
        actions = iter(
            [
                {"action": "wait", "reason": "loading", "progress": "Poem typed; saving is left."},
                {"action": "done", "reason": "saved"},
            ]
        )

        def chat(**kwargs):
            requests.append(kwargs)
            return {"message": {"content": json.dumps(next(actions))}}

        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(types.SimpleNamespace(chat=chat))),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            await vc.vision_loop("write and save", max_steps=2, task_id="notes")

        self.assertNotIn("progress note", requests[0]["messages"][1]["content"])
        self.assertIn(
            "Your progress note: Poem typed; saving is left.",
            requests[1]["messages"][1]["content"],
        )
        self.assertIn("Stay in the app the task is about", requests[0]["messages"][0]["content"])

    async def test_a_repeated_action_is_pointed_out_to_the_model(self):
        requests = []
        actions = iter(
            [
                {"action": "click", "x": 640, "y": 421, "reason": "focus"},
                {"action": "click", "x": 641, "y": 420, "reason": "focus again"},
                {"action": "done", "reason": "ok"},
            ]
        )

        def chat(**kwargs):
            requests.append(kwargs)
            return {"message": {"content": json.dumps(next(actions))}}

        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(types.SimpleNamespace(chat=chat))),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            await vc.vision_loop("type a poem", max_steps=3, task_id="repeat")

        self.assertNotIn("same thing again", requests[1]["messages"][1]["content"])
        self.assertIn("same thing again", requests[2]["messages"][1]["content"])

    async def test_todo_list_is_published_and_ticked_off(self):
        actions = iter(
            [
                {
                    "action": "wait",
                    "reason": "loading",
                    "plan": ["Open the Books page", "Add the cheapest book"],
                    "current": 1,
                },
                {"action": "wait", "reason": "still", "current": 2},
                {"action": "done", "reason": "added"},
            ]
        )
        fake = types.SimpleNamespace(
            chat=lambda **_k: {"message": {"content": json.dumps(next(actions))}}
        )
        published = []

        async def on_plan(items):
            published.append([item["status"] for item in items])

        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(fake)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            await vc.vision_loop("shop", max_steps=3, task_id="todo", on_plan=on_plan)

        self.assertEqual(
            published,
            [["active", "pending"], ["done", "active"], ["done", "done"]],
        )

    async def test_a_failure_says_which_todo_item_it_stopped_at(self):
        actions = iter(
            [
                {"action": "wait", "reason": "x", "plan": ["Find the book", "Go to checkout"], "current": 2},
                {"action": "failed", "reason": "the checkout button is greyed out"},
            ]
        )
        fake = types.SimpleNamespace(
            chat=lambda **_k: {"message": {"content": json.dumps(next(actions))}}
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(fake)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            with self.assertRaises(vc.UserFacingError) as raised:
                await vc.vision_loop("shop", max_steps=3, task_id="fail-at")
        self.assertIn("Go to checkout", str(raised.exception))
        self.assertIn("greyed out", str(raised.exception))

    async def test_follow_up_keys_run_without_another_look(self):
        looks = []
        actions = iter(
            [
                {
                    "action": "key",
                    "key": "ctrl+l",
                    "reason": "address bar",
                    "then": [
                        {"action": "type", "text": "example.com"},
                        {"action": "key", "key": "enter"},
                        {"action": "click", "x": 5, "y": 5},
                    ],
                },
                {"action": "done", "reason": "open"},
            ]
        )

        def chat(**kwargs):
            looks.append(1)
            return {"message": {"content": json.dumps(next(actions))}}

        executed = []
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(types.SimpleNamespace(chat=chat))),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action", side_effect=lambda action, *_a: executed.append(action["action"])),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            await vc.vision_loop("open example.com", max_steps=3, task_id="then")

        # Two looks for four actions; a click is never run without looking.
        self.assertEqual(len(looks), 2)
        self.assertEqual(executed, ["key", "type", "key"])

    async def test_continue_ends_the_wait_straight_away(self):
        continue_event = asyncio.Event()
        with (
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "_screen_signature", return_value=object()),
            patch.object(vc, "_screens_differ", return_value=False),
            patch.object(vc, "HANDOFF_POLL_SECONDS", 0.05),
        ):
            waiting = asyncio.create_task(
                vc._wait_for_user_to_act(threading.Event(), continue_event)
            )
            await asyncio.sleep(0.12)
            self.assertFalse(waiting.done())
            continue_event.set()
            self.assertTrue(await asyncio.wait_for(waiting, timeout=1))

        vc._pending_handoffs[("alpha", "t")] = asyncio.Event()
        self.assertTrue(vc.continue_vision_handoff("alpha", "t"))
        self.assertFalse(vc.continue_vision_handoff("alpha", "t"))
        self.assertFalse(vc.continue_vision_handoff("beta", "t"))
        vc._pending_handoffs.clear()

    async def test_a_click_by_name_uses_the_exact_position(self):
        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(1280, 720),
            monitor_bounds=((0, 0, 1920, 1080),),
        )
        actions = iter(
            [
                {"action": "click", "target": "Two", "x": 9, "y": 9, "reason": "press 2"},
                {"action": "done", "reason": "ok"},
            ]
        )
        fake = types.SimpleNamespace(
            chat=lambda **_k: {"message": {"content": json.dumps(next(actions))}}
        )

        def hint(_frame, into=None):
            if into is not None:
                into["two"] = (200, 400)
            return "list"

        executed = []
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(fake)),
            patch.object(vc, "take_screenshot", return_value=frame),
            patch.object(vc, "_named_controls_hint", side_effect=hint),
            patch.object(vc, "_chrome_profile_chooser_visible", return_value=False),
            patch.object(vc, "execute_action", side_effect=lambda action, *_a: executed.append((action["x"], action["y"]))),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            await vc.vision_loop("press 2", max_steps=2, task_id="by-name")

        self.assertEqual(executed, [(200, 400)])

    async def test_a_second_click_on_the_same_spot_is_a_real_click(self):
        actions = iter(
            [
                {"action": "click", "x": 100, "y": 200, "reason": "checkout"},
                {"action": "click", "x": 101, "y": 201, "reason": "checkout again"},
                {"action": "done", "reason": "ok"},
            ]
        )
        fake = types.SimpleNamespace(
            chat=lambda **_k: {"message": {"content": json.dumps(next(actions))}}
        )
        seen = []
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(fake)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action", side_effect=lambda action, *_a: seen.append(bool(action.get("_real_click")))),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            await vc.vision_loop("check out", max_steps=3, task_id="real-click")
        self.assertEqual(seen, [False, True])

    def test_named_controls_are_given_in_screenshot_pixels(self):
        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(1280, 720),
            monitor_bounds=((0, 0, 1920, 1080),),
        )
        screen = {
            "window": "Calculator",
            "elements": [
                {"name": "Nine", "type": "Button", "x": 300, "y": 600, "enabled": True},
                {"name": "Off screen", "type": "Button", "x": 5000, "y": 10, "enabled": True},
                {"name": "Greyed", "type": "Button", "x": 30, "y": 30, "enabled": False},
            ],
        }
        from tools import uia_control

        with (
            patch.object(uia_control, "UIA_AVAILABLE", True),
            patch.object(uia_control, "read_screen", return_value=screen),
        ):
            hint = vc._named_controls_hint(frame)
            self.assertIn('"Nine" (Button) at 200,400', hint)
            self.assertNotIn("Off screen", hint)
            self.assertNotIn("Greyed", hint)
        # TORCH never lists its own window, and an app that names nothing gives no list.
        with (
            patch.object(uia_control, "UIA_AVAILABLE", True),
            patch.object(uia_control, "read_screen", return_value={**screen, "window": "TORCH - AI Agent"}),
        ):
            self.assertEqual(vc._named_controls_hint(frame), "")
        with (
            patch.object(uia_control, "UIA_AVAILABLE", True),
            patch.object(uia_control, "read_screen", side_effect=RuntimeError("no window")),
        ):
            self.assertEqual(vc._named_controls_hint(frame), "")

    def test_handoff_needs_a_message_and_screens_are_compared_locally(self):
        with self.assertRaises(ValueError):
            vc._validate_action({"action": "handoff"})
        self.assertEqual(
            vc._validate_action({"action": "handoff", "message": " Pay now. "})["message"],
            "Pay now.",
        )
        from PIL import Image

        blank = Image.new("L", (96, 54), 0)
        caret = blank.copy()
        caret.putpixel((10, 10), 255)
        dialog = blank.copy()
        dialog.paste(255, (20, 10, 70, 40))
        self.assertFalse(vc._screens_differ(blank, caret))
        self.assertTrue(vc._screens_differ(blank, dialog))

    def test_executor_cancellation_is_client_and_task_scoped(self):
        executor = Executor()
        executor._active_tasks = {"alpha": {"one", "other"}, "beta": {"two"}}
        executor.stop_task("alpha", "one")
        self.assertTrue(executor._task_is_cancelled("alpha", "one"))
        self.assertFalse(executor._task_is_cancelled("alpha", "other"))
        self.assertFalse(executor._task_is_cancelled("beta", "two"))

    async def test_stop_during_planning_only_cancels_registered_request(self):
        executor = Executor()
        executor.begin_planning("alpha", "request-one", "command")
        self.assertEqual(executor.stop_task("alpha"), {"command"})
        self.assertTrue(
            executor.consume_pending_cancellation("alpha", "request-one")
        )

        # A stop while idle must not poison the next command for this client.
        self.assertEqual(executor.stop_task("alpha"), set())
        executor.begin_planning("alpha", "request-two", "command")
        self.assertFalse(
            executor.consume_pending_cancellation("alpha", "request-two")
        )
        executor.finish_planning("alpha", "request-two")

    async def test_executor_streams_internal_vision_action_labels(self):
        executor = Executor()

        async def fake_vision_control(
            task,
            client_id,
            task_id,
            on_step,
            **_kwargs,
        ):
            self.assertEqual(task, "use the visible app")
            self.assertEqual(client_id, "alpha")
            self.assertEqual(task_id, "message-one")
            await on_step(1, "click", "Clicking the search box")
            await on_step(2, "key", "Submitting the search")
            return "Done: complete"

        executor._tool_registry["vision_control"] = fake_vision_control
        steps = [{
            "id": "vision-step",
            "tool": "vision_control",
            "label": "Using vision control",
            "args": {"task": "use the visible app"},
            "requires_approval": False,
            "status": "pending",
        }]

        with (
            patch.object(vc.ws_manager, "send_status", new=AsyncMock()),
            patch.object(vc.ws_manager, "send_step_update", new=AsyncMock()) as updates,
            patch.object(vc.ws_manager, "send_terminal_line", new=AsyncMock()),
            patch("agent.rollback.rollback_manager.register_step"),
            patch(
                "agent.rollback.rollback_manager.schedule_cleanup",
                new=AsyncMock(return_value=None),
            ),
        ):
            await executor.execute_plan("message-one", steps, "alpha")
            await asyncio.sleep(0)

        streamed_labels = [
            (call.kwargs.get("extra") or {}).get("activity")
            for call in updates.await_args_list
            if (call.kwargs.get("extra") or {}).get("activity")
        ]
        self.assertIn("Clicking the search box", streamed_labels)
        self.assertIn("Submitting the search", streamed_labels)
        self.assertEqual(steps[0]["status"], "done")

    def test_vision_control_has_plain_step_phrasing(self):
        self.assertIn("screen", get_plain_phrase("vision_control", {}, "active"))
        done = get_plain_phrase("vision_control", {}, "done")
        self.assertIn("screen", done)
        self.assertNotIn("vision", done.lower())

    def test_actions_map_screenshot_coordinates_to_virtual_desktop(self):
        with (
            patch.object(vc, "virtual_screen_bounds", return_value=(-1920, 120, 3840, 1080)),
            patch.object(vc, "_press_at") as press,
            patch.object(vc.pyautogui, "moveTo") as move,
            patch.object(vc.time, "sleep"),
        ):
            vc.execute_action({"action": "click", "x": 200, "y": 300})
        press.assert_called_once_with(-1720, 420)
        # The user's mouse is never glided anywhere.
        move.assert_not_called()

    def test_browser_focus_visibly_clicks_then_guarantees_address_bar_focus(self):
        target = vc.BrowserWindowTarget(
            handle=42,
            title="Google - Google Chrome",
            bounds=(200, 160, 1320, 860),
        )
        cancel_event = threading.Event()
        with (
            patch.object(vc.pyautogui, "moveTo") as move,
            patch.object(vc, "_press_at") as press,
            patch.object(vc.pyautogui, "hotkey") as hotkey,
            patch.object(vc.time, "sleep"),
        ):
            vc._focus_browser_search_bar(target, cancel_event)

        move.assert_not_called()
        press.assert_called_once_with(517, 237)
        self.assertEqual(
            hotkey.call_args_list,
            [call("ctrl", "l"), call("ctrl", "a")],
        )

    def test_positive_scroll_amount_means_down(self):
        with (
            patch.object(vc, "virtual_screen_bounds", return_value=(0, 0, 1920, 1080)),
            patch.object(vc, "_scroll_at") as scroll,
        ):
            vc.execute_action({"action": "scroll", "x": 10, "y": 20, "amount": 4})
        scroll.assert_called_once_with(10, 20, 4)

    def test_a_scroll_notch_is_a_whole_wheel_notch(self):
        """Windows counts a wheel notch as 120; passing 1 moved the page by almost nothing."""
        user32 = Mock()
        user32.GetCursorPos.return_value = 1
        with (
            patch.object(vc.sys, "platform", "win32"),
            patch.object(vc.ctypes, "windll", types.SimpleNamespace(user32=user32)),
            patch.object(vc.time, "sleep"),
        ):
            vc._scroll_at(10, 20, 4)
        user32.mouse_event.assert_called_once_with(vc._MOUSEEVENTF_WHEEL, 0, 0, -480, 0)
        # The pointer goes to the spot and is then put back where the user left it.
        self.assertEqual(user32.SetCursorPos.call_args_list[0], call(10, 20))
        self.assertEqual(len(user32.SetCursorPos.call_args_list), 2)

    def test_out_of_bounds_pointer_action_is_rejected(self):
        with (
            patch.object(vc, "virtual_screen_bounds", return_value=(0, 0, 1920, 1080)),
            patch.object(vc.pyautogui, "click") as click,
        ):
            with self.assertRaisesRegex(ValueError, "outside the captured desktop"):
                vc.execute_action({"action": "click", "x": 1920, "y": 200})
        click.assert_not_called()

    def test_resized_frame_coordinates_map_back_to_capture_pixels(self):
        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(960, 540),
            monitor_bounds=((0, 0, 1920, 1080),),
        )
        with patch.object(
            vc,
            "_capture_layout",
            return_value=(frame.capture_bounds, frame.monitor_bounds),
        ):
            self.assertEqual(vc._map_screenshot_point(0, 0, frame), (1, 1))
            self.assertEqual(vc._map_screenshot_point(959, 539, frame), (1919, 1079))

    def test_frame_rejects_stale_display_layout_and_monitor_gaps(self):
        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(1920, 1080),
            monitor_bounds=((0, 0, 800, 1080), (1120, 0, 800, 1080)),
        )
        with patch.object(
            vc,
            "_capture_layout",
            return_value=(frame.capture_bounds, frame.monitor_bounds),
        ):
            with self.assertRaisesRegex(ValueError, "gap between physical monitors"):
                vc._map_screenshot_point(900, 100, frame)

        with patch.object(
            vc,
            "_capture_layout",
            return_value=((0, 0, 2560, 1440), ((0, 0, 2560, 1440),)),
        ):
            with self.assertRaisesRegex(ValueError, "Display layout changed"):
                vc._map_screenshot_point(100, 100, frame)

    def test_model_action_schema_blocks_unsafe_or_malformed_actions(self):
        with self.assertRaisesRegex(ValueError, "JSON object"):
            vc._validate_action([{"action": "click"}])
        with self.assertRaisesRegex(ValueError, "not allowed"):
            vc._validate_action({"action": "key", "key": "win+r"})
        with self.assertRaisesRegex(ValueError, "control characters"):
            vc._validate_action({"action": "type", "text": "hello\x07world"})
        # A line break is the Enter key, so several lines can go in one step.
        self.assertEqual(
            vc._validate_action({"action": "type", "text": "one\r\ntwo"})["text"], "one\ntwo"
        )
        with self.assertRaisesRegex(ValueError, "between -10 and 10"):
            vc._validate_action(
                {"action": "scroll", "x": 1, "y": 1, "amount": 100}
            )

    def test_ask_action_requires_named_choices_and_removes_other_placeholder(self):
        action = vc._validate_action({
            "action": "ask",
            "question": "Which Chrome profile should I use?",
            "options": ["Yusuf", "Yaomin", "Muyideen", "Other"],
            "reason": "The browser is showing a profile chooser",
        })
        self.assertEqual(action["options"], ["Yusuf", "Yaomin", "Muyideen"])
        with self.assertRaisesRegex(ValueError, "between two and eight"):
            vc._validate_action({
                "action": "ask",
                "question": "Which profile?",
                "options": ["Yusuf"],
            })

    def test_chrome_profile_chooser_detector_uses_exact_visible_window_title(self):
        titles = {
            1: "New Tab - Google Chrome",
            2: "Google Chrome",
            3: "Hidden Chrome",
        }

        def enum_windows(callback, context):
            for window_handle in titles:
                if callback(window_handle, context) is False:
                    break

        fake_win32gui = types.SimpleNamespace(
            EnumWindows=enum_windows,
            IsWindowVisible=lambda window_handle: window_handle != 3,
            GetWindowText=lambda window_handle: titles[window_handle],
        )
        with (
            patch.object(vc.sys, "platform", "win32"),
            patch.dict(sys.modules, {"win32gui": fake_win32gui}),
        ):
            self.assertTrue(vc._chrome_profile_chooser_visible())

        titles.pop(2)
        with (
            patch.object(vc.sys, "platform", "win32"),
            patch.dict(sys.modules, {"win32gui": fake_win32gui}),
        ):
            self.assertFalse(vc._chrome_profile_chooser_visible())

    async def test_profile_guard_forces_ask_schema_before_any_screen_action(self):
        requests = []
        actions = iter([
            {
                "action": "ask",
                "question": "Which Chrome profile should I use?",
                "options": ["Daniel", "Musambo", "reload", "Yusuf"],
                "reason": "Chrome is showing its profile chooser",
            },
            {"action": "done", "reason": "Google results are visible"},
        ])

        def chat(**kwargs):
            requests.append(kwargs)
            return {"message": {"content": json.dumps(next(actions))}}

        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(960, 540),
            monitor_bounds=((0, 0, 1920, 1080),),
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(types.SimpleNamespace(chat=chat))),
            patch.object(vc, "take_screenshot", return_value=frame),
            patch.object(vc, "_chrome_profile_chooser_visible", return_value=True),
            patch.object(vc, "_chrome_profile_chooser_in_front", return_value=True),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
            patch.object(vc.ws_manager, "send_status", new=AsyncMock()),
            patch.object(vc.ws_manager, "send_terminal_line", new=AsyncMock()),
        ):
            task = asyncio.create_task(
                vc.vision_loop(
                    "search Google for cat",
                    max_steps=2,
                    client_id="alpha",
                    task_id="guarded-profile-task",
                )
            )
            for _ in range(100):
                if ("alpha", "guarded-profile-task") in vc._pending_clarifications:
                    break
                await asyncio.sleep(0.01)

            self.assertTrue(
                vc.submit_vision_clarification(
                    "alpha", "guarded-profile-task", "Yusuf"
                )
            )
            self.assertEqual(await task, "Done: Google results are visible")

        self.assertIn("ONLY permitted action is ask", requests[0]["messages"][1]["content"])
        event_types = [call.args[0]["type"] for call in send.await_args_list]
        self.assertIn("vision_capture_start", event_types)
        self.assertIn("vision_capture_end", event_types)

    async def test_structured_browser_search_asks_immediately_then_opens_selected_profile(self):
        profiles = [
            ("Your Chrome", "Default"),
            ("Yusuf", "Profile 1"),
            ("yusuf", "Profile 2"),
            ("Daniel", "Profile 7"),
        ]
        with (
            patch.object(vc, "_chrome_profile_chooser_visible", return_value=True),
            patch.object(vc, "_chrome_profiles", return_value=profiles),
            patch.object(
                vc,
                "_perform_human_browser_search",
                new=AsyncMock(return_value=True),
            ) as perform_search,
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
            patch.object(vc.ws_manager, "send_status", new=AsyncMock()),
            patch.object(vc.ws_manager, "send_terminal_line", new=AsyncMock()),
        ):
            task = asyncio.create_task(
                vc.vision_loop(
                    "search Google for cat",
                    client_id="alpha",
                    task_id="direct-profile-task",
                    browser="chrome",
                    search_query="cat",
                )
            )
            for _ in range(100):
                if ("alpha", "direct-profile-task") in vc._pending_clarifications:
                    break
                await asyncio.sleep(0.01)

            self.assertTrue(
                vc.submit_vision_clarification(
                    "alpha", "direct-profile-task", "Yusuf"
                )
            )
            self.assertEqual(
                await task,
                "Done: Google search results for 'cat' are visibly loaded in Chrome",
            )

        perform_search.assert_awaited_once_with(
            browser="chrome",
            query="cat",
            profile_directory="Profile 1",
            cancel_event=ANY,
            on_step=None,
            first_step=2,
        )
        clarification = next(
            call.args[0]
            for call in send.await_args_list
            if call.args[0].get("type") == "clarification_request"
        )
        self.assertEqual(
            clarification["options"],
            ["Your Chrome", "Yusuf", "yusuf", "Daniel"],
        )
        event_types = [call.args[0]["type"] for call in send.await_args_list]
        self.assertNotIn("vision_capture_start", event_types)
        self.assertNotIn("vision_capture_end", event_types)

    async def test_human_browser_search_moves_clicks_types_and_submits(self):
        target = vc.BrowserWindowTarget(
            handle=42,
            title="Google - Google Chrome",
            bounds=(0, 0, 1920, 1040),
        )
        cancel_event = threading.Event()
        on_step = AsyncMock()
        with (
            patch.object(vc, "_launch_browser_for_human_search") as launch,
            patch.object(
                vc, "_wait_for_browser_window", new=AsyncMock(return_value=target)
            ),
            patch.object(vc, "_focus_browser_search_bar") as focus,
            patch.object(vc, "_type_humanly") as type_humanly,
            patch.object(vc, "_press_enter") as press_enter,
            patch.object(
                vc,
                "_wait_for_visible_browser_results",
                new=AsyncMock(return_value=True),
            ),
        ):
            result = await vc._perform_human_browser_search(
                browser="chrome",
                query="cat",
                profile_directory="Profile 1",
                cancel_event=cancel_event,
                on_step=on_step,
                first_step=2,
            )

        self.assertTrue(result)
        launch.assert_called_once_with("chrome", "Profile 1")
        focus.assert_called_once_with(target, cancel_event)
        type_humanly.assert_called_once_with("cat", cancel_event)
        press_enter.assert_called_once_with(cancel_event)
        self.assertEqual(
            [entry.args[1] for entry in on_step.await_args_list],
            ["click", "click", "type", "key"],
        )

    async def test_human_browser_search_recovers_without_title_error(self):
        target = vc.BrowserWindowTarget(
            handle=42,
            title="Google - Google Chrome",
            bounds=(0, 0, 1920, 1040),
        )
        cancel_event = threading.Event()
        with (
            patch.object(vc, "_launch_browser_for_human_search"),
            patch.object(
                vc, "_wait_for_browser_window", new=AsyncMock(return_value=target)
            ),
            patch.object(vc, "_top_browser_window", return_value=target),
            patch.object(vc, "_focus_browser_search_bar"),
            patch.object(vc, "_type_humanly") as type_humanly,
            patch.object(vc, "_press_enter"),
            patch.object(
                vc,
                "_wait_for_visible_browser_results",
                new=AsyncMock(side_effect=[False, False]),
            ),
        ):
            result = await vc._perform_human_browser_search(
                browser="chrome",
                query="cat",
                profile_directory=None,
                cancel_event=cancel_event,
                on_step=None,
                first_step=1,
            )

        self.assertFalse(result)
        self.assertEqual(
            type_humanly.call_args_list,
            [
                call("cat", cancel_event),
                call("https://www.google.com/search?q=cat", cancel_event),
            ],
        )

    async def test_structured_navigation_bypasses_the_vision_model(self):
        with (
            patch.object(vc, "_chrome_profile_chooser_visible", return_value=False),
            patch.object(
                vc,
                "_perform_human_browser_navigation",
                new=AsyncMock(return_value=True),
            ) as navigate,
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            result = await vc.vision_loop(
                "go to Facebook login",
                client_id="alpha",
                task_id="facebook-navigation",
                browser="chrome",
                navigate_url="https://www.facebook.com/login/",
                destination_label="Facebook login",
            )

        self.assertEqual(result, "Done: Facebook login is visibly loaded in Chrome")
        navigate.assert_awaited_once_with(
            browser="chrome",
            url="https://www.facebook.com/login/",
            destination_label="Facebook login",
            profile_directory=None,
            cancel_event=ANY,
            on_step=None,
            first_step=1,
        )

    async def test_human_navigation_clicks_types_address_and_submits(self):
        target = vc.BrowserWindowTarget(
            handle=42,
            title="Google - Google Chrome",
            bounds=(0, 0, 1920, 1040),
        )
        cancel_event = threading.Event()
        with (
            patch.object(vc, "_launch_browser_for_human_search") as launch,
            patch.object(
                vc, "_wait_for_browser_window", new=AsyncMock(return_value=target)
            ),
            patch.object(vc, "_focus_browser_search_bar") as focus,
            patch.object(vc, "_type_humanly") as type_humanly,
            patch.object(vc, "_press_enter") as press_enter,
            patch.object(
                vc,
                "_wait_for_visible_browser_destination",
                new=AsyncMock(return_value=True),
            ) as wait_for_destination,
        ):
            result = await vc._perform_human_browser_navigation(
                browser="chrome",
                url="https://www.facebook.com/login/",
                destination_label="Facebook login",
                profile_directory="Profile 1",
                cancel_event=cancel_event,
                on_step=None,
                first_step=2,
            )

        self.assertTrue(result)
        launch.assert_called_once_with("chrome", "Profile 1")
        focus.assert_called_once_with(target, cancel_event)
        type_humanly.assert_called_once_with(
            "https://www.facebook.com/login/",
            cancel_event,
        )
        press_enter.assert_called_once_with(cancel_event)
        wait_for_destination.assert_awaited_once_with(
            "chrome",
            "Facebook login",
            cancel_event,
            timeout=12,
        )

    async def test_profile_choice_pauses_and_resumes_the_same_vision_task(self):
        actions = iter([
            {
                "action": "ask",
                "question": "I found multiple Chrome profiles. Which one should I use?",
                "options": ["Yusuf", "Yaomin", "Muyideen"],
                "reason": "Chrome is waiting at its profile chooser",
            },
            {"action": "done", "reason": "searched Google for cat"},
        ])
        ollama = types.SimpleNamespace(
            chat=lambda **_kwargs: {
                "message": {"content": json.dumps(next(actions))}
            }
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
            patch.object(vc.ws_manager, "send_status", new=AsyncMock()) as status,
            patch.object(vc.ws_manager, "send_terminal_line", new=AsyncMock()),
        ):
            task = asyncio.create_task(
                vc.vision_loop(
                    "search Google for cat",
                    max_steps=2,
                    client_id="alpha",
                    task_id="profile-task",
                )
            )
            for _ in range(100):
                if ("alpha", "profile-task") in vc._pending_clarifications:
                    break
                await asyncio.sleep(0.01)

            self.assertTrue(
                vc.submit_vision_clarification("alpha", "profile-task", "Yusuf")
            )
            self.assertFalse(
                vc.submit_vision_clarification("alpha", "missing-task", "Yusuf")
            )
            self.assertEqual(await task, "Done: searched Google for cat")

        requests = [
            call.args[0]
            for call in send.await_args_list
            if call.args[0].get("type") == "clarification_request"
        ]
        self.assertEqual(requests[0]["options"], ["Yusuf", "Yaomin", "Muyideen"])
        self.assertIn("awaiting_input", [call.args[0] for call in status.await_args_list])
        self.assertIn("executing", [call.args[0] for call in status.await_args_list])

    async def test_model_request_carries_the_rules_and_the_task(self):
        captured_request = {}

        def chat(**kwargs):
            captured_request.update(kwargs)
            return {
                "message": {
                    "content": json.dumps(
                        {"action": "done", "reason": "already complete"}
                    )
                }
            }

        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(types.SimpleNamespace(chat=chat))),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            result = await vc.vision_loop("do it", max_steps=1, task_id="json")

        self.assertEqual(result, "Done: already complete")
        self.assertIn("handoff", captured_request["messages"][0]["content"])
        self.assertIn("Task: do it", captured_request["messages"][1]["content"])
        self.assertEqual(captured_request["messages"][0]["role"], "system")
        self.assertEqual(captured_request["messages"][1]["role"], "user")

    async def test_pyautogui_failsafe_terminates_the_session(self):
        ollama = _ollama_module(
            {"action": "click", "x": 10, "y": 10, "reason": "target"}
        )
        with (
            patch.object(vc, "ask_vision_sync", new=_as_model(ollama)),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(
                vc,
                "execute_action",
                side_effect=vc.pyautogui.FailSafeException("corner"),
            ),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            with self.assertRaisesRegex(RuntimeError, "fail-safe corner"):
                await vc.vision_loop("click it", max_steps=1, task_id="failsafe")

    def test_unknown_action_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported vision action"):
            vc.execute_action({"action": "launch_missiles"})


if __name__ == "__main__":
    unittest.main()
