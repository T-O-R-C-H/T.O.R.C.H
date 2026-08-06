import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi import WebSocketDisconnect

import main as backend_main


class _FailingWebSocket:
    def __init__(self, error):
        self.error = error

    async def receive_text(self):
        raise self.error


class WebSocketDisconnectTests(unittest.IsolatedAsyncioTestCase):
    async def _exercise_disconnect(self, error):
        cleanup_events = []

        def stop_task(client_id):
            cleanup_events.append(("stop", client_id))

        async def disconnect(client_id):
            cleanup_events.append(("disconnect", client_id))

        with (
            patch.object(backend_main.uuid, "uuid4", return_value="alpha001-client"),
            patch.object(backend_main.ws_manager, "connect", new=AsyncMock()),
            patch.object(backend_main.ws_manager, "send_terminal_line", new=AsyncMock()),
            patch.object(backend_main.ws_manager, "send_metrics", new=AsyncMock()),
            patch.object(backend_main, "get_current_metrics", new=AsyncMock(return_value={})),
            patch.object(backend_main.executor, "stop_task", new=Mock(side_effect=stop_task)),
            patch.object(
                backend_main.ws_manager,
                "disconnect",
                new=AsyncMock(side_effect=disconnect),
            ),
        ):
            await backend_main.websocket_endpoint(_FailingWebSocket(error))

        return cleanup_events

    async def test_websocket_disconnect_stops_client_before_removing_connection(self):
        events = await self._exercise_disconnect(WebSocketDisconnect())
        self.assertEqual(events, [("stop", "alpha001"), ("disconnect", "alpha001")])

    async def test_websocket_error_uses_the_same_scoped_cleanup(self):
        events = await self._exercise_disconnect(RuntimeError("socket failed"))
        self.assertEqual(events, [("stop", "alpha001"), ("disconnect", "alpha001")])


if __name__ == "__main__":
    unittest.main()
