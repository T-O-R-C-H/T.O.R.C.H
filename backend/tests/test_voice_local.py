"""
Voice stays on the machine.

`listen()` dropped to Google's Web Speech API whenever the local model was
unavailable — which was always, because the whisper package is not installed.
Every voice command was therefore uploaded to a third party while the app
described itself as local-first, and nothing said so.
"""

import inspect
import io
import math
import struct
import wave

import pytest
from fastapi.testclient import TestClient

import main
from errors.plain_language import UserFacingError
from tools import stt, voice


def _wav_bytes(seconds: float = 0.5, rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        frames = int(seconds * rate)
        handle.writeframes(
            b"".join(struct.pack("<h", int(8000 * math.sin(i / 10))) for i in range(frames))
        )
    return buffer.getvalue()


@pytest.fixture
def client():
    return TestClient(main.app)


# ─── No cloud fallback anywhere in the voice path ───


def test_no_cloud_recogniser_is_reachable_from_the_voice_module():
    """
    recognize_google uploads the recording. If it reappears in this module,
    voice has stopped being local regardless of what the docs claim.
    """
    source = inspect.getsource(voice)

    assert "recognize_google" not in source


def test_transcribe_refuses_rather_than_falling_back(monkeypatch):
    # Patched on the engine, which is where availability is now decided.
    monkeypatch.setattr(stt, "model_present", lambda: False)

    with pytest.raises(UserFacingError) as excinfo:
        voice.transcribe_audio(_wav_bytes())

    message = str(excinfo.value)
    assert "Traceback" not in message
    # The user is told what is missing, in words that mean something to them,
    # and is not left thinking the recording went somewhere.
    assert "download" in message.lower()
    assert "whisper" not in message.lower(), "model names are not user-facing"


def test_listen_reports_the_missing_model_instead_of_uploading(monkeypatch):
    monkeypatch.setattr(stt, "model_present", lambda: False)

    class _FakeMic:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    class _FakeRecognizer:
        def adjust_for_ambient_noise(self, *args, **kwargs):
            return None

        def listen(self, *args, **kwargs):
            return object()

        def recognize_google(self, *args, **kwargs):  # pragma: no cover
            raise AssertionError("voice must never reach a cloud recogniser")

    import speech_recognition as sr

    monkeypatch.setattr(sr, "Recognizer", lambda: _FakeRecognizer())
    monkeypatch.setattr(sr, "Microphone", lambda *a, **k: _FakeMic())

    result = voice.listen(1)

    assert "isn't installed" in result


# ─── The capability gate ───


def test_capabilities_reports_whether_speech_is_available(client, auth_headers):
    response = client.get("/api/voice/capabilities", headers=auth_headers)

    assert response.status_code == 200
    assert isinstance(response.json()["speech_to_text"], bool)


def test_capabilities_matches_what_is_installed(client, auth_headers, monkeypatch):
    """The renderer hides the microphone on this answer, so it must be true."""
    monkeypatch.setattr(stt, "model_present", lambda: False)
    assert client.get("/api/voice/capabilities", headers=auth_headers).json()[
        "speech_to_text"
    ] is False

    monkeypatch.setattr(stt, "engine_installed", lambda: True)
    monkeypatch.setattr(stt, "model_present", lambda: True)
    assert client.get("/api/voice/capabilities", headers=auth_headers).json()[
        "speech_to_text"
    ] is True


def test_capabilities_requires_a_session_token(client):
    assert client.get("/api/voice/capabilities").status_code == 401


# ─── The transcribe endpoint ───


def test_transcribe_requires_a_session_token(client):
    assert client.post("/api/voice/transcribe", content=_wav_bytes()).status_code == 401


def test_transcribe_rejects_an_empty_body(client, auth_headers):
    response = client.post("/api/voice/transcribe", headers=auth_headers, content=b"")

    assert response.status_code == 400


def test_transcribe_rejects_an_oversized_upload(client, auth_headers):
    oversized = b"\x00" * (main.MAX_AUDIO_UPLOAD_BYTES + 1)

    response = client.post("/api/voice/transcribe", headers=auth_headers, content=oversized)

    assert response.status_code == 413


def test_transcribe_reports_a_missing_model_in_plain_language(client, auth_headers, monkeypatch):
    monkeypatch.setattr(stt, "model_present", lambda: False)

    response = client.post("/api/voice/transcribe", headers=auth_headers, content=_wav_bytes())

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert "Traceback" not in detail
    assert "whisper" not in detail.lower(), "model names are not user-facing"


def test_transcribe_returns_the_text_when_a_model_is_present(client, auth_headers, monkeypatch):
    monkeypatch.setattr(voice, "transcribe_audio", lambda payload: "open my downloads folder")

    response = client.post("/api/voice/transcribe", headers=auth_headers, content=_wav_bytes())

    assert response.status_code == 200
    assert response.json()["transcript"] == "open my downloads folder"
