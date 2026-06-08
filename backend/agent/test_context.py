import sys
import os
import unittest
from unittest.mock import MagicMock, AsyncMock

# Add backend directory to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

from agent.context import ConversationContext
from agent.providers.gemini_provider import GeminiProvider


class TestConversationContext(unittest.TestCase):
    def setUp(self):
        # Clear contexts before each test
        ConversationContext._contexts.clear()

    def test_add_and_retrieve_context(self):
        client_id = "client_1"
        self.assertEqual(len(ConversationContext.get_context(client_id)), 0)

        # Add an exchange
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command="Find Sales.pdf",
            reply_summary="On it. Searching for Sales.pdf in Documents.",
            step_results=[
                {"tool": "find_file", "label": "Searching for Sales.pdf in Documents", "status": "done", "result": "C:\\Users\\John\\Documents\\Sales.pdf"}
            ]
        )

        ctx = ConversationContext.get_context(client_id)
        self.assertEqual(len(ctx), 1)
        self.assertEqual(ctx[0]["user_command"], "Find Sales.pdf")
        self.assertEqual(ctx[0]["reply_summary"], "On it. Searching for Sales.pdf in Documents.")
        self.assertEqual(len(ctx[0]["step_results"]), 1)
        self.assertEqual(ctx[0]["step_results"][0]["result"], "C:\\Users\\John\\Documents\\Sales.pdf")

    def test_rolling_window_limit(self):
        client_id = "client_1"
        for i in range(12):
            ConversationContext.add_exchange(
                client_id=client_id,
                user_command=f"Command {i}",
                reply_summary=f"Reply {i}",
                step_results=[{"tool": "test", "label": "test", "status": "done", "result": f"res_{i}"}]
            )

        ctx = ConversationContext.get_context(client_id)
        # Verify it keeps exactly the last 10
        self.assertEqual(len(ctx), 10)
        self.assertEqual(ctx[0]["user_command"], "Command 2")
        self.assertEqual(ctx[-1]["user_command"], "Command 11")

    def test_separate_contexts_per_client(self):
        client_1 = "client_1"
        client_2 = "client_2"

        ConversationContext.add_exchange(
            client_id=client_1,
            user_command="Command Client 1",
            reply_summary="Reply 1",
            step_results=[]
        )

        ConversationContext.add_exchange(
            client_id=client_2,
            user_command="Command Client 2",
            reply_summary="Reply 2",
            step_results=[]
        )

        ctx_1 = ConversationContext.get_context(client_1)
        ctx_2 = ConversationContext.get_context(client_2)

        self.assertEqual(len(ctx_1), 1)
        self.assertEqual(ctx_1[0]["user_command"], "Command Client 1")

        self.assertEqual(len(ctx_2), 1)
        self.assertEqual(ctx_2[0]["user_command"], "Command Client 2")

    def test_clear_context(self):
        client_id = "client_1"
        ConversationContext.add_exchange(
            client_id=client_id,
            user_command="Find Sales.pdf",
            reply_summary="On it.",
            step_results=[]
        )

        self.assertEqual(len(ConversationContext.get_context(client_id)), 1)
        ConversationContext.clear_context(client_id)
        self.assertEqual(len(ConversationContext.get_context(client_id)), 0)


class TestGeminiProviderContextFormatting(unittest.IsolatedAsyncioTestCase):
    async def test_context_formatting(self):
        provider = GeminiProvider(api_key="dummy_key")
        # Mock the genai Client generate_content call
        provider.client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '[]'
        provider.client.models.generate_content = MagicMock(return_value=mock_response)

        context = [
            {
                "user_command": "Find Sales.pdf",
                "reply_summary": "On it. Searching for Sales.pdf.",
                "step_results": [
                    {"tool": "find_file", "label": "Searching for Sales.pdf in Documents", "status": "done", "result": "C:\\Users\\John\\Documents\\Sales.pdf"},
                    {"tool": "read_pdf", "label": "Reading", "status": "failed", "error": "File encrypted"}
                ]
            }
        ]

        await provider.plan_command("Email it to John", context=context)

        # Get the arguments passed to generate_content
        provider.client.models.generate_content.assert_called_once()
        kwargs = provider.client.models.generate_content.call_args[1]
        contents = kwargs["contents"]

        # Assert context is formatted correctly into the generated content string
        self.assertIn("Conversation context:", contents)
        self.assertIn("User command: Find Sales.pdf", contents)
        self.assertIn("TORCH response: On it. Searching for Sales.pdf.", contents)
        self.assertIn("Execution steps & outcomes:", contents)
        self.assertIn("Step 0: Searching for Sales.pdf in Documents (tool: find_file) -> done, result: C:\\Users\\John\\Documents\\Sales.pdf", contents)
        self.assertIn("Step 1: Reading (tool: read_pdf) -> failed, error: File encrypted", contents)
        self.assertIn("User command: Email it to John", contents)


if __name__ == "__main__":
    unittest.main()

