"""
The voice model is never fetched without being asked for.

faster-whisper downloads weights on first use by default. That is exactly the
behaviour this module has to suppress: a ~148 MB download starting on its own,
on someone's metered connection, because they pressed a microphone button.
"""

import inspect
import os

import pytest
from fastapi.testclient import TestClient

import main
from errors.plain_language import UserFacingError
from tools import stt


@pytest.fixture(autouse=True)
def isolated_model_dir(tmp_path, monkeypatch):
    """Point the model directory at a throwaway path and clear cached state."""
    monkeypatch.setattr(stt.settings, "data_dir", str(tmp_path))
    stt.reset_for_tests()
    yield
    stt.reset_for_tests()


@pytest.fixture
def client():
    return TestClient(main.app)


def _write_model(complete: bool = True) -> None:
    """Create files that look like a downloaded model."""
    os.makedirs(stt.model_dir(), exist_ok=True)
    names = stt._REQUIRED_ON_DISK if complete else ("model.bin",)
    for name in names:
        with open(os.path.join(stt.model_dir(), name), "wb") as handle:
            handle.write(b"x" * 16)


# ─── Nothing downloads on its own ───


def test_every_model_load_is_pinned_to_local_files():
    """
    faster-whisper fetches from the network unless told not to. If a load
    without local_files_only appears here, pressing the microphone starts a
    download nobody agreed to.
    """
    source = inspect.getsource(stt._load_model)

    assert "local_files_only=True" in source


def test_only_the_explicit_download_path_reaches_the_network():
    """snapshot_download is the one network call, and it lives in the worker."""
    module_source = inspect.getsource(stt)

    assert module_source.count("snapshot_download") == 2  # the import and the call
    assert "snapshot_download" in inspect.getsource(stt._download_worker)


def test_checking_availability_does_not_download(monkeypatch):
    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("checking availability must not touch the network")

    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    assert stt.local_stt_available() is False
    assert stt.model_present() is False
    stt.status()


def test_transcribing_without_the_model_refuses_rather_than_fetching(monkeypatch):
    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("transcription must not trigger a download")

    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    with pytest.raises(UserFacingError) as excinfo:
        stt.transcribe(b"RIFF....")

    assert "download" in str(excinfo.value).lower()


# ─── Presence is judged from the files on disk ───


def test_model_is_not_ready_before_it_is_downloaded():
    assert stt.model_present() is False


def test_model_is_ready_once_the_files_are_there():
    _write_model()
    assert stt.model_present() is True


def test_a_partial_download_does_not_count_as_ready():
    """An interrupted download leaves some files. Loading those would crash."""
    _write_model(complete=False)
    assert stt.model_present() is False


def test_an_empty_file_does_not_count_as_ready():
    os.makedirs(stt.model_dir(), exist_ok=True)
    for name in stt._REQUIRED_ON_DISK:
        open(os.path.join(stt.model_dir(), name), "wb").close()

    assert stt.model_present() is False


def test_state_reports_ready_after_a_restart():
    """Readiness comes from disk, not from a flag set earlier in the process."""
    _write_model()
    assert stt.download_state()["state"] == "ready"


# ─── The advertised size is the real one ───


def test_the_quoted_size_matches_the_model_actually_fetched():
    """
    The prompt tells the user how large the download is. Base is about
    148 MB — the 75 MB figure belongs to tiny, and quoting it would be a
    number the user could measure and find wrong.
    """
    assert stt.MODEL_REPO.endswith("base")
    assert 140_000_000 <= stt.MODEL_DOWNLOAD_BYTES <= 160_000_000


# ─── Endpoints ───


def test_capabilities_separates_missing_engine_from_missing_model(client, auth_headers):
    body = client.get("/api/voice/capabilities", headers=auth_headers).json()

    assert body["speech_to_text"] is False
    assert body["model_ready"] is False
    assert "engine_installed" in body
    assert body["download_bytes"] == stt.MODEL_DOWNLOAD_BYTES


def test_capabilities_turns_true_once_the_model_is_present(client, auth_headers):
    _write_model()
    body = client.get("/api/voice/capabilities", headers=auth_headers).json()

    assert body["model_ready"] is True
    assert body["speech_to_text"] is stt.engine_installed()


def test_model_status_requires_a_session_token(client):
    assert client.get("/api/voice/model").status_code == 401


def test_download_requires_a_session_token(client):
    assert client.post("/api/voice/model").status_code == 401


def test_download_is_a_no_op_when_the_model_is_already_there(client, auth_headers, monkeypatch):
    _write_model()

    def explode(*args, **kwargs):  # pragma: no cover
        raise AssertionError("must not re-download an installed model")

    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", explode)

    body = client.post("/api/voice/model", headers=auth_headers).json()

    assert body["state"] == "ready"


def test_download_reports_progress_the_ui_can_show(monkeypatch):
    """
    Called directly rather than through the endpoint: stubbing the worker is
    enough, and patching threading.Thread would replace it process-wide,
    taking asyncio's executor with it.
    """
    ran = {}
    monkeypatch.setattr(stt, "_download_worker", lambda: ran.setdefault("ran", True))

    body = stt.start_download()

    assert body["state"] == "downloading"
    assert body["downloaded_bytes"] == 0
    assert body["total_bytes"] == stt.MODEL_DOWNLOAD_BYTES


def test_a_second_request_does_not_start_a_second_download(monkeypatch):
    """Two presses of Yes must not fetch 148 MB twice."""
    calls = []
    monkeypatch.setattr(stt, "_download_worker", lambda: calls.append(1))

    stt.start_download()
    stt.start_download()

    # The state stays "downloading" and the worker was only ever handed out
    # once, whatever the second caller did.
    assert stt.download_state()["state"] == "downloading"
    assert len(calls) <= 1


def test_a_failed_download_is_reported_in_plain_language(monkeypatch):
    import huggingface_hub

    def fail(*args, **kwargs):
        raise OSError("connection reset by peer")

    monkeypatch.setattr(huggingface_hub, "snapshot_download", fail)

    stt._download_worker()
    state = stt.download_state()

    assert state["state"] == "error"
    assert "Traceback" not in state["error"]
    assert "connection reset by peer" not in state["error"]


def test_a_download_that_leaves_nothing_behind_is_an_error(monkeypatch):
    """Reporting success without the files would wedge the microphone."""
    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", lambda *a, **k: None)

    stt._download_worker()

    assert stt.download_state()["state"] == "error"
