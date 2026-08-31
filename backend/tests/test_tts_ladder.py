"""
Text to speech stays on the machine, and only the recap is spoken.

The previous implementation POSTed the text to Google's Gemini TTS endpoint,
so a summary of what TORCH had just done on the user's computer left the
machine before it was said out loud. Every rung of the ladder is now local:
Kokoro, the renderer's speechSynthesis, then the operating system's voice.
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
    for name in tts.KOKORO_FILES:
        path = os.path.join(tts.kokoro_dir(), name)
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


def test_kokoro_is_not_ready_before_its_voice_is_downloaded():
    assert tts.kokoro_ready() is False


def test_kokoro_is_ready_once_the_voice_is_on_disk():
    _write_voice()
    assert tts.kokoro_ready() is tts.kokoro_installed()


def test_a_partial_voice_download_does_not_count_as_ready():
    """
    Kokoro needs both the model and the voice bank. One of the two on disk is
    an interrupted download, and loading it would crash rather than speak.
    """
    first = next(iter(tts.KOKORO_FILES))
    path = os.path.join(tts.kokoro_dir(), first)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(b"x" * 16)

    assert tts.kokoro_ready() is False


def test_synthesise_without_a_voice_refuses_in_plain_language():
    with pytest.raises(UserFacingError) as excinfo:
        tts.synthesize("Your file was moved.")

    message = str(excinfo.value)
    assert "Traceback" not in message
    assert "kokoro" not in message.lower(), "engine names are not user-facing"


def test_synthesise_rejects_empty_text():
    with pytest.raises(UserFacingError):
        tts.synthesize("   ")


def test_the_first_rung_returning_503_is_the_normal_fallback_path(client, auth_headers):
    """
    No Kokoro voice is the common case. The renderer reads a 503 as "drop to
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

    assert "engine_installed" in body
    assert body["voice_ready"] is False
    assert body["download_bytes"] > 0


def test_checking_status_does_not_download(monkeypatch):
    import huggingface_hub

    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("reading status must not touch the network")

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    tts.status()
    tts.kokoro_ready()


def test_download_is_a_no_op_when_the_voice_is_present(monkeypatch):
    _write_voice()
    import huggingface_hub

    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("must not re-download an installed voice")

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    assert tts.kokoro_model.start()["state"] == "ready"


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


# ─── Chunking for Kokoro ───
#
# Kokoro degrades on long input, so text is split before synthesis. These pin
# the two things that matter: nothing is dropped, and no chunk exceeds the
# limit the model handles well.


def test_a_short_recap_is_one_chunk():
    """The normal case: a recap is a single sentence and must not be split."""
    from tools.tts import chunk_for_synthesis

    assert chunk_for_synthesis("Your file was moved to Documents.") == [
        "Your file was moved to Documents."
    ]


def test_empty_text_produces_no_chunks():
    from tools.tts import chunk_for_synthesis

    assert chunk_for_synthesis("") == []
    assert chunk_for_synthesis("   \n  ") == []


def test_short_sentences_are_grouped_rather_than_split_one_each():
    """One chunk per sentence would put an audible gap after every full stop."""
    from tools.tts import chunk_for_synthesis

    assert len(chunk_for_synthesis("One. Two. Three.")) == 1


def test_no_chunk_exceeds_the_token_limit():
    from tools.tts import chunk_for_synthesis, MAX_CHUNK_TOKENS, _estimate_tokens

    chunks = chunk_for_synthesis(" ".join(f"word{i}." for i in range(400)))

    assert chunks
    for chunk in chunks:
        assert _estimate_tokens(chunk) <= MAX_CHUNK_TOKENS


def test_a_single_oversized_sentence_is_still_split():
    """One run-on sentence must not be handed to the model whole."""
    from tools.tts import chunk_for_synthesis, MAX_CHUNK_TOKENS, _estimate_tokens

    sentence = " ".join("word" for _ in range(500)) + "."
    chunks = chunk_for_synthesis(sentence)

    assert len(chunks) > 1
    for chunk in chunks:
        assert _estimate_tokens(chunk) <= MAX_CHUNK_TOKENS


def test_chunking_never_loses_words():
    """Silently dropping the end of someone's text is worse than a bad break."""
    from tools.tts import chunk_for_synthesis

    words = [f"w{i}" for i in range(600)]
    chunks = chunk_for_synthesis(" ".join(words))

    assert " ".join(chunks).split() == words


def test_the_voice_is_one_of_the_natural_ones():
    from tools.tts import KOKORO_VOICE

    assert KOKORO_VOICE in {"af_sarah", "af_nova"}


def test_the_advertised_download_size_matches_the_real_files():
    """
    The figure goes in front of the user before they agree to the download.
    Measured from the release assets: 325.5 MB + 28.2 MB.
    """
    from tools.tts import KOKORO_DOWNLOAD_BYTES

    assert 340_000_000 <= KOKORO_DOWNLOAD_BYTES <= 370_000_000


def test_the_model_is_never_fetched_without_being_asked():
    """
    Nothing may reach the network except start(), and start() is only reached
    from an explicit yes in Settings.
    """
    import inspect
    from tools import tts

    source = inspect.getsource(tts)
    assert "urllib" not in source
    assert "requests" not in source
