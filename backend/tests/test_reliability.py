import asyncio
import tempfile
import unittest
from pathlib import Path

from agent.executor import Executor
from tools.files import find_file, find_file_fuzzy
from websocket import ConnectionManager


class RecordingConnectionManager(ConnectionManager):
    def __init__(self):
        super().__init__()
        self.messages = []

    async def send_message(self, data, client_id="main"):
        self.messages.append(data)


class ReliabilityTests(unittest.TestCase):
    def test_find_file_rejects_empty_and_traversal_paths(self):
        with self.assertRaises(ValueError):
            find_file("report.pdf", "")
        with self.assertRaises(ValueError):
            find_file("report.pdf", "../")
        with self.assertRaises(ValueError):
            find_file("../report.pdf", "~")
        with self.assertRaises(ValueError):
            find_file_fuzzy("report.pdf", "../../")

    def test_find_file_normalizes_a_safe_path(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory, "report.pdf")
            report.write_text("test", encoding="utf-8")
            result = find_file("report.pdf", directory)
            self.assertIn(str(report.resolve()), result)

    def test_approval_is_only_accepted_once_when_waiting(self):
        executor = Executor()
        executor._approval_events["step-1"] = asyncio.Event()
        self.assertTrue(executor.submit_approval("step-1", "approve"))
        self.assertFalse(executor.submit_approval("step-1", "approve"))
        self.assertFalse(executor.submit_approval("missing", "approve"))
        self.assertFalse(executor.submit_approval("step-1", "invalid"))


class StreamingReliabilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_agent_response_is_appended_as_server_chunks(self):
        manager = RecordingConnectionManager()
        content = "A streamed response " * 10
        await manager.send_agent_response(
            {"id": "message-1", "content": content, "role": "torch"}
        )

        self.assertEqual(manager.messages[0]["type"], "agent_response")
        self.assertEqual(manager.messages[0]["message"]["content"], "")
        deltas = [
            message["delta"]
            for message in manager.messages
            if message["type"] == "content_delta"
        ]
        self.assertGreater(len(deltas), 1)
        self.assertEqual("".join(deltas), content)
        self.assertEqual(manager.messages[-1]["type"], "content_done")


if __name__ == "__main__":
    unittest.main()
