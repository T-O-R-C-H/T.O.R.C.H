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


def _vision_returning(action):
    """A stand-in for the vision call that always answers with one action."""
    return lambda *_args, **_kwargs: {"message": {"content": json.dumps(action)}}


class VisionControlTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Vision refuses to start without a configured key.
        key_patch = patch.object(vc.settings, "gemini_api_key", "test-key")
        key_patch.start()
        self.addCleanup(key_patch.stop)
        vc._active_sessions.clear()
        vc._pending_clarifications.clear()
        settle_patch = patch.object(vc, "CAPTURE_OVERLAY_SETTLE_SECONDS", 0)
        settle_patch.start()
        self.addCleanup(settle_patch.stop)
        browser_chooser_patch = patch.object(vc, "BROWSER_CHOOSER_SETTLE_SECONDS", 0)
        browser_chooser_patch.start()
        self.addCleanup(browser_chooser_patch.stop)
        browser_window_patch = patch.object(vc, "BROWSER_WINDOW_SETTLE_SECONDS", 0)
        browser_window_patch.start()
        self.addCleanup(browser_window_patch.stop)

    async def test_failed_action_raises_and_always_emits_end(self):
        vision = _vision_returning({"action": "failed", "reason": "button missing"})
        with (
            patch.object(vc, "_vision_action", vision),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()) as send,
        ):
            with self.assertRaisesRegex(RuntimeError, "button missing"):
                await vc.vision_loop("do it", client_id="alpha", task_id="task-1")

        self.assertEqual(send.await_args_list[-1].args[0]["type"], "vision_control_end")
        self.assertNotIn("alpha", vc._active_sessions)

    async def test_max_steps_raises_instead_of_returning_success(self):
        vision = _vision_returning({"action": "wait", "reason": "still loading"})
        with (
            patch.object(vc, "_vision_action", vision),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action"),
            patch.object(vc, "STEP_PAUSE", 0),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            with self.assertRaisesRegex(RuntimeError, "maximum of 1 steps"):
                await vc.vision_loop("do it", max_steps=1, task_id="task-2")

    async def test_rejected_pointer_action_is_not_executed_and_can_recover(self):
        actions = iter(
            [
                {"action": "click", "x": 5000, "y": 10, "reason": "bad target"},
                {"action": "done", "reason": "recovered safely"},
            ]
        )
        vision = lambda *_args, **_kwargs: {
            "message": {"content": json.dumps(next(actions))}
        }
        with (
            patch.object(vc, "_vision_action", vision),
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

        def vision(*_args, **_kwargs):
            started.set()
            release.wait(timeout=2)
            return {"message": {"content": json.dumps({"action": "click", "x": 2, "y": 3})}}
        execute = Mock()
        with (
            patch.object(vc, "_vision_action", vision),
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

    async def test_stop_cancels_a_vision_request_in_flight(self):
        """
        A stop pressed while the model is thinking must cancel the request
        rather than let its action land afterwards.
        """
        started = threading.Event()
        release = threading.Event()

        def vision(*_args, **_kwargs):
            started.set()
            release.wait(timeout=2)
            return {"message": {"content": json.dumps({"action": "click", "x": 2, "y": 3})}}

        with (
            patch.object(vc, "_vision_action", vision),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc, "execute_action") as execute,
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            task = asyncio.create_task(
                vc.vision_loop("click it", client_id="alpha", task_id="async-task")
            )
            await asyncio.to_thread(started.wait, 2)
            self.assertEqual(vc.cancel_vision_control("alpha", "async-task"), 1)
            release.set()
            with self.assertRaises(RuntimeError):
                await asyncio.wait_for(task, timeout=5)

        execute.assert_not_called()

    async def test_cancellation_is_scoped_to_client_and_task(self):
        release = threading.Event()
        started_count = 0
        started_lock = threading.Lock()

        def vision(*_args, **_kwargs):
            nonlocal started_count
            with started_lock:
                started_count += 1
            release.wait(timeout=2)
            return {"message": {"content": json.dumps({"action": "done", "reason": "complete"})}}

        with (
            patch.object(vc, "_vision_action", vision),
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

    def test_ollama_error_translation_stays_actionable(self):
        translated = translate_error("connection refused by Ollama for qwen2.5vl:7b")
        self.assertIn("Ollama", translated["what_happened"])
        self.assertIn("ollama pull qwen2.5vl:7b", translated["what_to_do"])

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
            call.kwargs.get("label")
            for call in updates.await_args_list
            if call.kwargs.get("label")
        ]
        self.assertIn("Clicking the search box", streamed_labels)
        self.assertIn("Submitting the search", streamed_labels)
        self.assertEqual(steps[0]["status"], "done")

    def test_vision_control_has_plain_step_phrasing(self):
        self.assertIn("screen", get_plain_phrase("vision_control", {}, "active"))
        self.assertIn("Completed", get_plain_phrase("vision_control", {}, "done"))

    def test_actions_map_screenshot_coordinates_to_virtual_desktop(self):
        with (
            patch.object(vc, "virtual_screen_bounds", return_value=(-1920, 120, 3840, 1080)),
            patch.object(vc.pyautogui, "moveTo") as move,
            patch.object(vc.pyautogui, "click") as click,
        ):
            vc.execute_action({"action": "click", "x": 200, "y": 300})
        move.assert_called_once_with(
            -1720,
            420,
            duration=0.65,
            tween=vc.pyautogui.easeInOutQuad,
        )
        click.assert_called_once_with(-1720, 420)

    def test_browser_focus_visibly_clicks_then_guarantees_address_bar_focus(self):
        target = vc.BrowserWindowTarget(
            handle=42,
            title="Google - Google Chrome",
            bounds=(200, 160, 1320, 860),
        )
        cancel_event = threading.Event()
        with (
            patch.object(vc.pyautogui, "moveTo") as move,
            patch.object(vc.pyautogui, "click") as click,
            patch.object(vc.pyautogui, "hotkey") as hotkey,
            patch.object(vc.time, "sleep"),
        ):
            vc._focus_browser_search_bar(target, cancel_event)

        move.assert_called_once_with(
            517,
            237,
            duration=0.8,
            tween=vc.pyautogui.easeInOutQuad,
        )
        click.assert_called_once_with(517, 237)
        self.assertEqual(
            hotkey.call_args_list,
            [call("ctrl", "l"), call("ctrl", "a")],
        )

    def test_positive_scroll_amount_means_down(self):
        with (
            patch.object(vc, "virtual_screen_bounds", return_value=(0, 0, 1920, 1080)),
            patch.object(vc.pyautogui, "scroll") as scroll,
        ):
            vc.execute_action({"action": "scroll", "x": 10, "y": 20, "amount": 4})
        scroll.assert_called_once_with(-4, x=10, y=20)

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
            vc._validate_action({"action": "type", "text": "hello\nworld"})
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

        def vision(prompt, screenshot_b64, profile_choice_needed):
            requests.append(
                {"prompt": prompt, "profile_choice_needed": profile_choice_needed}
            )
            return {"message": {"content": json.dumps(next(actions))}}

        frame = vc.ScreenFrame(
            image="image",
            capture_bounds=(0, 0, 1920, 1080),
            model_size=(960, 540),
            monitor_bounds=((0, 0, 1920, 1080),),
        )
        with (
            patch.object(vc, "_vision_action", vision),
            patch.object(vc, "take_screenshot", return_value=frame),
            patch.object(vc, "_chrome_profile_chooser_visible", return_value=True),
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

        # The schema is no longer a separate request field; the guard rides
        # in the prompt and the flag says which schema applies.
        self.assertTrue(requests[0]["profile_choice_needed"])
        self.assertFalse(requests[1]["profile_choice_needed"])
        self.assertIn("ONLY permitted action is ask", requests[0]["prompt"])
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
        vision = lambda *_args, **_kwargs: {
            "message": {"content": json.dumps(next(actions))}
        }
        with (
            patch.object(vc, "_vision_action", vision),
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

    async def test_the_vision_prompt_carries_the_system_rules_and_the_screenshot(self):
        """
        The system prompt used to travel as a separate message role. It is now
        part of one prompt string, so the rules have to still be in there -
        without them the model has no schema to answer in.
        """
        captured = {}

        def vision(prompt, screenshot_b64, profile_choice_needed):
            captured["prompt"] = prompt
            captured["screenshot"] = screenshot_b64
            return {
                "message": {
                    "content": json.dumps(
                        {"action": "done", "reason": "already complete"}
                    )
                }
            }

        with (
            patch.object(vc, "_vision_action", vision),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            result = await vc.vision_loop("do it", max_steps=1, task_id="json")

        self.assertEqual(result, "Done: already complete")
        self.assertIn(vc.SYSTEM_PROMPT, captured["prompt"])
        self.assertIn("do it", captured["prompt"])
        self.assertEqual(captured["screenshot"], "image")

    async def test_vision_refuses_without_a_configured_key(self):
        """Screen control needs the AI service; say so rather than hanging."""
        with (
            patch.object(vc.settings, "gemini_api_key", ""),
            patch.object(vc, "take_screenshot", return_value="image"),
            patch.object(vc.ws_manager, "send_message", new=AsyncMock()),
        ):
            with self.assertRaisesRegex(RuntimeError, "AI connection key"):
                await vc.vision_loop("do it", max_steps=1, task_id="nokey")

    async def test_a_step_cannot_hang_for_minutes(self):
        """
        The local model was given four minutes per step, and with a
        twenty-five step loop one task could sit "analyzing" for over an hour.
        """
        self.assertLessEqual(vc.MODEL_ACTION_TIMEOUT_SECONDS, 60)

    async def test_pyautogui_failsafe_terminates_the_session(self):
        vision = _vision_returning(
            {"action": "click", "x": 10, "y": 10, "reason": "target"}
        )
        with (
            patch.object(vc, "_vision_action", vision),
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
