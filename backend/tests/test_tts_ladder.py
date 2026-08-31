"""
Text to speech stays on the machine, and only the recap is spoken.

The previous implementation POSTed the text to Google's Gemini TTS endpoint,
so a summary of what TORCH had just done on the user's computer left the
machine before it was said out loud. Every rung of the ladder is now local:
Piper, the renderer's speechSynthesis, then the operating system's voice.
"""

import inspect
import os

import pytest
from fastapi.testclient import TestClient

import main
from errors.plain_language import UserFacingError
from tools import tts


@pytest.fixture(autouse=True)
def isolated_voice_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(tts.settings, "data_dir", str(tmp_path))
    tts.reset_for_tests()
    yield
    tts.reset_for_tests()


@pytest.fixture
def client():
    return TestClient(main.app)


def _write_voice() -> None:
    for name in tts.PIPER_FILES:
        path = os.path.join(tts.piper_dir(), name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as handle:
            handle.write(b"x" * 16)


# ─── Nothing speaks through the cloud ───


def test_no_network_speech_service_is_reachable_from_the_tts_module():
    source = inspect.getsource(tts)

    for cloud in ("generativelanguage", "googleapis", "requests.post", "elevenlabs"):
        assert cloud not in source


def test_the_old_cloud_synthesiser_is_no_longer_wired_up():
    """
    voice_synthesis.py still exists but must not be on the speech path.
    Leaving it wired would send the recap to Google.
    """
    endpoint = inspect.getsource(main.synthesize_companion_voice)

    assert "voice_synthesis" not in endpoint
    assert "tts" in endpoint


# ─── The ladder degrades rather than failing ───


def test_piper_is_not_ready_before_its_voice_is_downloaded():
    assert tts.piper_ready() is False


def test_piper_is_ready_once_the_voice_is_on_disk():
    _write_voice()
    assert tts.piper_ready() is tts.piper_installed()


def test_a_partial_voice_download_does_not_count_as_ready():
    path = os.path.join(tts.piper_dir(), tts.PIPER_FILES[0])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(b"x" * 16)

    assert tts.piper_ready() is False


def test_synthesise_without_a_voice_refuses_in_plain_language():
    with pytest.raises(UserFacingError) as excinfo:
        tts.synthesize("Your file was moved.")

    message = str(excinfo.value)
    assert "Traceback" not in message
    assert "piper" not in message.lower(), "engine names are not user-facing"


def test_synthesise_rejects_empty_text():
    with pytest.raises(UserFacingError):
        tts.synthesize("   ")


def test_the_first_rung_returning_503_is_the_normal_fallback_path(client, auth_headers):
    """
    No Piper voice is the common case. The renderer reads a 503 as "drop to
    speechSynthesis", so it must not be a 500.
    """
    response = client.post("/api/voice/synthesize", headers=auth_headers, json={"text": "Done."})

    assert response.status_code == 503
    assert "Traceback" not in response.json()["detail"]


def test_synthesise_requires_text(client, auth_headers):
    assert (
        client.post("/api/voice/synthesize", headers=auth_headers, json={"text": ""}).status_code
        == 400
    )


def test_every_voice_endpoint_requires_a_session_token(client):
    assert client.get("/api/voice/tts").status_code == 401
    assert client.post("/api/voice/tts/model").status_code == 401
    assert client.post("/api/voice/speak", json={"text": "hi"}).status_code == 401


# ─── The voice model is opt-in, like the speech one ───


def test_status_tells_the_ui_what_it_needs(client, auth_headers):
    body = client.get("/api/voice/tts", headers=auth_headers).json()

    assert "piper_installed" in body
    assert body["piper_ready"] is False
    assert body["download_bytes"] > 0


def test_checking_status_does_not_download(monkeypatch):
    import huggingface_hub

    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("reading status must not touch the network")

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    tts.status()
    tts.piper_ready()


def test_download_is_a_no_op_when_the_voice_is_present(monkeypatch):
    _write_voice()
    import huggingface_hub

    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("must not re-download an installed voice")

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    assert tts.piper_model.start()["state"] == "ready"


# ─── Only the recap is spoken ───


def test_plan_messages_are_never_marked_speakable():
    """
    Reading a step list aloud is the one thing E.3 rules out. The plan message
    is the step list, so it must not carry the flag.
    """
    source = inspect.getsource(main.process_command)

    plan_send = source[source.index('natural_response = "Got it. Here is my plan:"') :]
    plan_send = plan_send[: plan_send.index("send_agent_response")]

    assert '"speak"' not in plan_send


def test_the_final_recap_is_marked_speakable():
    source = inspect.getsource(main.process_command)

    assert source.count('"speak": True') + source.count('response_msg["speak"] = True') >= 4
