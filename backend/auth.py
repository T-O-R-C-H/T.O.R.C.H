"""
TORCH Session Auth
Validates the session token Electron generates at launch and hands to this
process via TORCH_AUTH_TOKEN. Every REST route and the WebSocket handshake
check it, so a stray process on the machine (or the LAN) cannot drive the agent.
"""

import hmac
import logging

from fastapi import HTTPException, WebSocket
from starlette.requests import HTTPConnection

from config.settings import settings

logger = logging.getLogger("torch.auth")


def _token_matches(candidate: str) -> bool:
    """Constant-time compare against the configured session token."""
    expected = settings.auth_token
    if not candidate or not expected:
        return False
    return hmac.compare_digest(candidate, expected)


def verify_token(conn: HTTPConnection) -> None:
    """
    App-wide dependency: reject any connection without a valid session token.

    This runs for WebSocket routes as well as HTTP ones, so it accepts the
    token two ways. HTTP callers must use the Authorization header — keeping
    tokens out of URLs and access logs. Browsers cannot set headers on a
    WebSocket handshake, so those may fall back to a ?token= query parameter.
    """
    candidate = (conn.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    if not candidate and conn.scope.get("type") == "websocket":
        candidate = conn.query_params.get("token", "")

    if not _token_matches(candidate):
        raise HTTPException(status_code=401, detail="Unauthorized")


def verify_ws_token(websocket: WebSocket) -> bool:
    """
    Check the token a WebSocket client passes as ?token=.

    Browsers cannot set headers on a WebSocket handshake, so the token travels
    as a query parameter. This is checked before accept() so an unauthorized
    client never reaches the message loop.
    """
    return _token_matches(websocket.query_params.get("token", ""))
