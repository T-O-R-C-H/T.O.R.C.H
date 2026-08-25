"""
Session auth covering both transports.

TORCH can delete files, send mail and run terminal commands, so an
unauthenticated caller reaching either the REST API or the WebSocket is a
remote-control hole. These tests pin that shut.
"""

import pytest
from fastapi.testclient import TestClient

import main
from auth import verify_ws_token
from conftest import TEST_TOKEN


@pytest.fixture
def client():
    return TestClient(main.app)


# ─── REST ───


def test_rest_rejects_missing_token(client, auth_token):
    assert client.get("/api/status").status_code == 401


def test_rest_rejects_wrong_token(client, auth_token):
    response = client.get("/api/status", headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401


def test_rest_accepts_bare_token_without_bearer_prefix(client, auth_token):
    """
    The "Bearer " prefix is optional — knowing the secret is what authorises.

    Documented deliberately: parsing is lenient about the prefix but never
    about the token value itself.
    """
    response = client.get("/api/status", headers={"Authorization": TEST_TOKEN})
    assert response.status_code == 200


def test_rest_accepts_valid_token(client, auth_headers):
    assert client.get("/api/status", headers=auth_headers).status_code == 200


def test_rest_ignores_query_param_token(client, auth_token):
    """HTTP must use the header: tokens in URLs leak into logs and history."""
    response = client.get(f"/api/status?token={TEST_TOKEN}")
    assert response.status_code == 401


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("post", "/api/settings", {"json": {}}),  # rewrites .env, holds API keys
        ("delete", "/api/history", {}),           # wipes task history
        ("get", "/api/email/inbox", {}),          # reads the user's mail
        ("post", "/api/voice/listen", {}),        # opens the microphone
    ],
)
def test_sensitive_routes_require_auth(client, auth_token, method, path, kwargs):
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 401


# ─── WebSocket ───


def test_ws_rejects_missing_token(client, auth_token):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws"):
            pass


def test_ws_rejects_wrong_token(client, auth_token):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws?token=wrong"):
            pass


def test_ws_accepts_valid_token(client, auth_token):
    """The happy path must still work — a broken handshake bricks the app."""
    with client.websocket_connect(f"/ws?token={TEST_TOKEN}") as ws:
        assert ws.receive_json().get("type")


# ─── Token comparison ───


class _FakeWebSocket:
    def __init__(self, token=None):
        self.query_params = {"token": token} if token is not None else {}


@pytest.mark.parametrize(
    "token,expected",
    [(TEST_TOKEN, True), ("wrong", False), ("", False), (None, False)],
)
def test_verify_ws_token(auth_token, token, expected):
    assert verify_ws_token(_FakeWebSocket(token)) is expected


def test_empty_configured_token_rejects_everything(monkeypatch):
    """A blank configured token must never mean 'allow all'."""
    from config.settings import settings

    monkeypatch.setattr(settings, "auth_token", "")
    assert verify_ws_token(_FakeWebSocket("")) is False
    assert verify_ws_token(_FakeWebSocket("anything")) is False
