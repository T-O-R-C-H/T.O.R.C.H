"""
TORCH WebSocket Connection Manager
Handles real-time bidirectional communication between frontend and backend.
"""

from fastapi import WebSocket
from typing import Dict, Optional
import json
import logging
import asyncio

logger = logging.getLogger("torch.websocket")


class ConnectionManager:
    """Manages WebSocket connections and message routing."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str = "main") -> None:
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections[client_id] = websocket
        logger.info(f"Client connected: {client_id}")

    async def disconnect(self, client_id: str = "main") -> None:
        """Remove a WebSocket connection."""
        async with self._lock:
            self.active_connections.pop(client_id, None)
        logger.info(f"Client disconnected: {client_id}")
        try:
            from agent.context import ConversationContext
            ConversationContext.clear_context(client_id)
        except Exception as e:
            logger.error(f"Failed to clear conversation context on disconnect for {client_id}: {e}")


    async def send_message(self, data: dict, client_id: str = "main") -> None:
        """Send a JSON message to a specific client."""
        ws = self.active_connections.get(client_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception as e:
                logger.error(f"Failed to send message to {client_id}: {e}")
                await self.disconnect(client_id)

    async def broadcast(self, data: dict) -> None:
        """Send a JSON message to all connected clients."""
        disconnected = []
        for client_id, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(client_id)
        for cid in disconnected:
            await self.disconnect(cid)

    async def send_status(self, status: str, client_id: str = "main") -> None:
        """Send agent status update."""
        await self.send_message({"type": "status", "status": status}, client_id)

    async def send_step_update(
        self,
        message_id: str,
        step_id: str,
        status: str,
        result: Optional[str] = None,
        error: Optional[str] = None,
        client_id: str = "main",
    ) -> None:
        """Send a step execution update."""
        data = {
            "type": "step_update",
            "messageId": message_id,
            "stepId": step_id,
            "status": status,
        }
        if result:
            data["result"] = result
        if error:
            data["error"] = error
        await self.send_message(data, client_id)

    async def send_agent_response(self, message: dict, client_id: str = "main") -> None:
        """Send a complete agent response message."""
        await self.send_message({"type": "agent_response", "message": message}, client_id)

    async def send_hitl_request(
        self,
        message_id: str,
        step_id: str,
        summary: str,
        client_id: str = "main",
    ) -> None:
        """Send a Human-In-The-Loop approval request."""
        await self.send_message(
            {
                "type": "hitl_request",
                "messageId": message_id,
                "stepId": step_id,
                "summary": summary,
            },
            client_id,
        )

    async def send_terminal_line(
        self,
        content: str,
        line_type: str = "info",
        client_id: str = "main",
    ) -> None:
        """Send a terminal log line."""
        import uuid
        from datetime import datetime

        await self.send_message(
            {
                "type": "terminal",
                "line": {
                    "id": str(uuid.uuid4()),
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "content": content,
                    "type": line_type,
                },
            },
            client_id,
        )

    async def send_overlay_event(
        self,
        status: Optional[str] = None,
        reply: Optional[str] = None,
        client_id: str = "main",
    ) -> None:
        """Send overlay state update."""
        data: dict = {"type": "overlay"}
        if status:
            data["status"] = status
        if reply:
            data["reply"] = reply
        await self.send_message(data, client_id)

    async def send_metrics(self, metrics: dict, client_id: str = "main") -> None:
        """Send updated metrics."""
        await self.send_message({"type": "metrics", "metrics": metrics}, client_id)


# Singleton
manager = ConnectionManager()
