"""
What POST /api/settings is allowed to change.

The handler used to assign any attribute that happened to exist on the settings
object, which put auth_token, host, db_path and data_dir within reach of a
request body. It also assigned raw JSON values, so the string "false" landed in
a boolean field and read as true.
"""

import pytest
from fastapi.testclient import TestClient

import main
from config.settings import settings


@pytest.fixture(autouse=True)
def isolated_env_file(tmp_path, monkeypatch):
    """
    Redirect settings persistence at a throwaway file.

    These tests POST settings, and the handler rewrites the whole .env. Without
    this they edit the developer's real configuration.
    """
    monkeypatch.setattr(main, "_env_file_path", lambda: str(tmp_path / ".env"))


@pytest.fixture
def client():
    return TestClient(main.app)


# ─── Fields outside the allowlist are ignored ───


@pytest.mark.parametrize(
    "field,hostile_value",
    [
        ("auth_token", "attacker-chosen-token"),
        ("db_path", "C:/somewhere-else.db"),
        ("data_dir", "C:/somewhere-else"),
        ("host", "0.0.0.0"),
        ("port", 9999),
    ],
)
def test_protected_settings_cannot_be_written(client, auth_headers, field, hostile_value):
    original = getattr(settings, field)
    try:
        response = client.post("/api/settings", headers=auth_headers, json={field: hostile_value})
        assert response.status_code == 200
        assert getattr(settings, field) == original
    finally:
        setattr(settings, field, original)


def test_rebinding_the_backend_to_the_network_is_refused(client, auth_headers):
    """Loopback-only binding is a security boundary, not a preference."""
    original = settings.host
    try:
        client.post("/api/settings", headers=auth_headers, json={"host": "0.0.0.0"})
        assert settings.host == original
    finally:
        settings.host = original


def test_unknown_keys_are_ignored(client, auth_headers):
    response = client.post("/api/settings", headers=auth_headers, json={"not_a_setting": "x"})
    assert response.status_code == 200
    assert not hasattr(settings, "not_a_setting")


# ─── Values are coerced to the declared type ───


@pytest.mark.parametrize(
    "sent,expected",
    [("false", False), ("true", True), ("0", False), ("1", True), (False, False), (True, True)],
)
def test_boolean_settings_are_coerced(client, auth_headers, sent, expected):
    """'false' is a truthy string: assigning it raw left the permission on."""
    original = settings.allow_files
    try:
        client.post("/api/settings", headers=auth_headers, json={"allow_files": sent})
        assert settings.allow_files is expected
    finally:
        settings.allow_files = original


def test_numeric_settings_are_coerced(client, auth_headers):
    original = settings.screen_watch_interval
    try:
        client.post("/api/settings", headers=auth_headers, json={"screen_watch_interval": "45"})
        assert settings.screen_watch_interval == 45
    finally:
        settings.screen_watch_interval = original


def test_invalid_numeric_value_is_rejected(client, auth_headers):
    original = settings.screen_watch_interval
    try:
        response = client.post(
            "/api/settings", headers=auth_headers, json={"screen_watch_interval": "soon"}
        )
        assert response.status_code == 400
        assert settings.screen_watch_interval == original
    finally:
        settings.screen_watch_interval = original


# ─── Secrets ───


@pytest.mark.parametrize("secret", ["gemini_api_key", "gmail_app_password"])
def test_secrets_are_not_accepted_through_the_settings_api(client, auth_headers, secret):
    """
    Secrets live in the OS keystore and reach the backend as environment
    variables. Accepting them here would write them back to .env in plain text
    and undo the encrypted store.
    """
    original = getattr(settings, secret)
    try:
        response = client.post("/api/settings", headers=auth_headers, json={secret: "new-value"})
        assert response.status_code == 200
        assert getattr(settings, secret) == original
    finally:
        setattr(settings, secret, original)


def test_settings_file_never_receives_a_secret(client, auth_headers, tmp_path):
    client.post(
        "/api/settings",
        headers=auth_headers,
        json={"gemini_api_key": "should-not-be-written", "allow_files": True},
    )
    env_file = tmp_path / ".env"
    contents = env_file.read_text(encoding="utf-8") if env_file.exists() else ""
    assert "should-not-be-written" not in contents


def test_settings_endpoint_still_requires_auth(client):
    assert client.post("/api/settings", json={"allow_files": True}).status_code == 401
