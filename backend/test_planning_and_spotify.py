import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import main as backend_main
from agent.brain import plan_command
from agent.executor import Executor
from agent.planner import validate_plan
from agent.providers.claude_provider import ClaudeProvider
from agent.providers.gemini_provider import GeminiProvider
from agent.providers.openai_provider import OpenAIProvider


EXPECTED_SPOTIFY_PLAN = [
    {
        "tool": "open_app",
        "label": "Opening Chrome",
        "args": {"name": "chrome"},
        "requires_approval": False,
    },
    {
        "tool": "vision_control",
        "label": "Finding and playing your track on Spotify",
        "args": {
            "task": (
                "Navigate to open.spotify.com, search for Doja by Central Cee, "
                "and play the track"
            )
        },
        "requires_approval": False,
    },
]


class SpotifyPlanningTests(unittest.IsolatedAsyncioTestCase):
    async def test_spotify_request_is_deterministic_before_provider_routing(self):
        with patch("agent.brain.get_provider") as get_provider:
            result = await plan_command("Play Doja by Central Cee on Spotify")

        self.assertEqual(result, EXPECTED_SPOTIFY_PLAN)
        get_provider.assert_not_called()

    async def test_appended_desktop_context_is_not_part_of_spotify_query(self):
        command = (
            "Could you please play Doja by Central Cee on Spotify?\n\n"
            "Active desktop: Chrome - Settings\n"
            "LIVE CONNECTION STATUS: screen capture ready"
        )
        with patch("agent.brain.get_provider") as get_provider:
            result = await plan_command(command, model="trial")

        self.assertEqual(result, EXPECTED_SPOTIFY_PLAN)
        get_provider.assert_not_called()

    def test_validation_preserves_canonical_spotify_labels(self):
        validated = validate_plan(EXPECTED_SPOTIFY_PLAN)
        self.assertEqual(
            [step["label"] for step in validated],
            [
                "Opening Chrome",
                "Finding and playing your track on Spotify",
            ],
        )
        self.assertFalse(validated[1]["requires_approval"])


class VisionControlApprovalTests(unittest.TestCase):
    @staticmethod
    def _validate_task(task):
        return validate_plan([{
            "tool": "vision_control",
            "label": "Using vision control",
            "args": {"task": task},
            "requires_approval": False,
        }])[0]

    def test_consequential_vision_tasks_force_approval(self):
        risky_tasks = (
            "Click Buy now and complete the payment",
            "Send the message to the client",
            "Post this update to the company account",
            "Upload the signed document",
            "Delete the file permanently",
            "Uninstall the application",
            "Open PowerShell and run Set-ExecutionPolicy RemoteSigned",
            "Edit the registry using regedit",
            "Turn off Windows Defender in Security settings",
        )

        for task in risky_tasks:
            with self.subTest(task=task):
                self.assertTrue(self._validate_task(task)["requires_approval"])

    def test_benign_navigation_and_read_only_tasks_remain_approval_free(self):
        benign_tasks = (
            "Navigate to open.spotify.com, search for Doja by Central Cee, and play the track",
            "Navigate to open.spotify.com, search for Pay Me, and play the track",
            "Navigate to example.com and search for the weather",
            "Scroll through the post to read it",
            "Open payment history and read the latest entry",
            "Open Windows Security settings and describe what is visible",
        )

        for task in benign_tasks:
            with self.subTest(task=task):
                self.assertFalse(self._validate_task(task)["requires_approval"])


class ProviderThreadingTests(unittest.IsolatedAsyncioTestCase):
    async def _assert_planning_uses_worker_thread(self, provider, response):
        call = MagicMock(return_value=response)
        if isinstance(provider, GeminiProvider):
            provider.client = SimpleNamespace(
                models=SimpleNamespace(generate_content=call)
            )
        elif isinstance(provider, OpenAIProvider):
            provider.client = SimpleNamespace(
                chat=SimpleNamespace(
                    completions=SimpleNamespace(create=call)
                )
            )
        else:
            provider.client = SimpleNamespace(messages=SimpleNamespace(create=call))

        real_to_thread = asyncio.to_thread
        with patch("asyncio.to_thread", new=AsyncMock(side_effect=real_to_thread)) as to_thread:
            await provider.plan_command("say hello")

        to_thread.assert_awaited_once()
        self.assertIs(to_thread.await_args.args[0], call)

    async def _assert_generation_uses_worker_thread(self, provider, response):
        call = MagicMock(return_value=response)
        if isinstance(provider, GeminiProvider):
            provider.client = SimpleNamespace(
                models=SimpleNamespace(generate_content=call)
            )
        elif isinstance(provider, OpenAIProvider):
            provider.client = SimpleNamespace(
                chat=SimpleNamespace(
                    completions=SimpleNamespace(create=call)
                )
            )
        else:
            provider.client = SimpleNamespace(messages=SimpleNamespace(create=call))

        real_to_thread = asyncio.to_thread
        with patch("asyncio.to_thread", new=AsyncMock(side_effect=real_to_thread)) as to_thread:
            await provider.generate_text("hello")

        to_thread.assert_awaited_once()
        self.assertIs(to_thread.await_args.args[0], call)

    async def test_all_sync_sdk_calls_use_worker_threads(self):
        gemini = GeminiProvider.__new__(GeminiProvider)
        gemini.api_key = "test"
        await self._assert_planning_uses_worker_thread(
            gemini,
            SimpleNamespace(text="[]"),
        )
        await self._assert_generation_uses_worker_thread(
            gemini,
            SimpleNamespace(text="hello"),
        )

        openai = OpenAIProvider.__new__(OpenAIProvider)
        openai.api_key = "test"
        openai.model = "gpt-4o"
        openai_response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="[]"))]
        )
        await self._assert_planning_uses_worker_thread(openai, openai_response)
        openai_text_response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="hello"))]
        )
        await self._assert_generation_uses_worker_thread(openai, openai_text_response)

        claude = ClaudeProvider.__new__(ClaudeProvider)
        claude.api_key = "test"
        claude.model = "claude-sonnet-4-6"
        await self._assert_planning_uses_worker_thread(
            claude,
            SimpleNamespace(content=[SimpleNamespace(text="[]")]),
        )
        await self._assert_generation_uses_worker_thread(
            claude,
            SimpleNamespace(content=[SimpleNamespace(text="hello")]),
        )


class PlanningCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def _start_slow_pipeline(self, channel):
        started = asyncio.Event()
        release = asyncio.Event()

        async def slow_plan(*_args, **_kwargs):
            started.set()
            await release.wait()
            return [
                {
                    "tool": "open_app",
                    "label": "Opening Chrome",
                    "args": {"name": "chrome"},
                    "requires_approval": False,
                }
            ]

        fresh_executor = Executor()
        execute_plan = AsyncMock(return_value=[])
        fresh_executor.execute_plan = execute_plan
        send_status = AsyncMock()
        send_overlay_event = AsyncMock()
        send_agent_response = AsyncMock()

        patches = (
            patch.object(backend_main, "executor", fresh_executor),
            patch.object(backend_main, "plan_command", new=slow_plan),
            patch.object(backend_main.ws_manager, "send_status", new=send_status),
            patch.object(
                backend_main.ws_manager,
                "send_terminal_line",
                new=AsyncMock(),
            ),
            patch.object(
                backend_main.ws_manager,
                "send_overlay_event",
                new=send_overlay_event,
            ),
            patch.object(
                backend_main.ws_manager,
                "send_agent_response",
                new=send_agent_response,
            ),
        )

        for active_patch in patches:
            active_patch.start()
            self.addCleanup(active_patch.stop)

        planning_id = f"{channel}-plan"
        if channel == "command":
            task = asyncio.create_task(
                backend_main.process_command(
                    "Open Chrome",
                    "alpha",
                    planning_id=planning_id,
                )
            )
        else:
            task = asyncio.create_task(
                backend_main.process_overlay_command(
                    "Open Chrome",
                    "alpha",
                    planning_id=planning_id,
                )
            )

        await asyncio.wait_for(started.wait(), timeout=1)
        return (
            task,
            release,
            send_status,
            send_overlay_event,
            send_agent_response,
            execute_plan,
        )

    async def test_stop_during_main_planning_is_immediate_and_discards_plan(self):
        (
            task,
            release,
            send_status,
            _send_overlay_event,
            send_agent_response,
            execute_plan,
        ) = await self._start_slow_pipeline("command")

        await backend_main.handle_ws_message({"type": "stop_task"}, "alpha")
        self.assertEqual(send_status.await_args.args, ("idle", "alpha"))

        release.set()
        await asyncio.wait_for(task, timeout=1)

        send_agent_response.assert_not_awaited()
        execute_plan.assert_not_awaited()
        statuses = [call.args[0] for call in send_status.await_args_list]
        self.assertNotIn("executing", statuses)

    async def test_stop_before_scheduled_pipeline_never_reenters_processing(self):
        fresh_executor = Executor()
        fresh_executor.begin_planning("alpha", "queued-plan", "command")
        self.assertEqual(fresh_executor.stop_task("alpha"), {"command"})
        send_status = AsyncMock()
        planner = AsyncMock(return_value=[])

        with (
            patch.object(backend_main, "executor", fresh_executor),
            patch.object(backend_main, "plan_command", new=planner),
            patch.object(
                backend_main.ws_manager,
                "send_status",
                new=send_status,
            ),
        ):
            await backend_main.process_command(
                "Open Chrome",
                "alpha",
                planning_id="queued-plan",
            )

        planner.assert_not_awaited()
        self.assertEqual(
            [call.args[0] for call in send_status.await_args_list],
            ["idle"],
        )

    async def test_stop_during_overlay_planning_sends_ack_and_discards_plan(self):
        (
            task,
            release,
            _send_status,
            send_overlay_event,
            send_agent_response,
            execute_plan,
        ) = await self._start_slow_pipeline("overlay")

        await backend_main.handle_ws_message({"type": "stop_task"}, "alpha")
        self.assertIn(
            unittest.mock.call(status="idle", reply="Stopped.", client_id="alpha"),
            send_overlay_event.await_args_list,
        )

        release.set()
        await asyncio.wait_for(task, timeout=1)

        send_agent_response.assert_not_awaited()
        execute_plan.assert_not_awaited()
        speaking_calls = [
            call for call in send_overlay_event.await_args_list
            if call.kwargs.get("status") == "speaking"
        ]
        self.assertEqual(speaking_calls, [])

    def test_planning_cancellation_is_request_and_client_scoped(self):
        scoped_executor = Executor()
        scoped_executor.begin_planning("alpha", "one", "command")
        scoped_executor.begin_planning("alpha", "two", "overlay")
        scoped_executor.begin_planning("beta", "three", "command")

        self.assertEqual(
            scoped_executor.stop_task("alpha"),
            {"command", "overlay"},
        )
        self.assertTrue(
            scoped_executor.consume_pending_cancellation("alpha", "one")
        )
        self.assertTrue(
            scoped_executor.consume_pending_cancellation("alpha", "two")
        )
        self.assertFalse(
            scoped_executor.consume_pending_cancellation("beta", "three")
        )


if __name__ == "__main__":
    unittest.main()
