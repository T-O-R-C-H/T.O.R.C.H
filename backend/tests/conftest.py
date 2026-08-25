"""Shared fixtures for the TORCH backend test suite."""

import pytest

from config.settings import settings
from memory.storage import TorchDatabase

TEST_TOKEN = "test-session-token"


@pytest.fixture
def auth_token(monkeypatch):
    """
    Pin the session token to a known value.

    auth.py reads settings.auth_token on every check rather than caching it at
    import time, so patching the attribute is enough.
    """
    monkeypatch.setattr(settings, "auth_token", TEST_TOKEN)
    return TEST_TOKEN


@pytest.fixture
def auth_headers(auth_token):
    """Authorization header carrying a valid session token."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def temp_db(tmp_path):
    """
    Isolated database on a throwaway file.

    memory.storage exposes a module-level singleton bound to the real data
    directory, so tests build their own instance instead of importing it.
    A file rather than ":memory:" because every query opens a fresh
    connection, and in-memory databases are not shared between connections.
    """
    return TorchDatabase(db_path=str(tmp_path / "test-torch.db"))
