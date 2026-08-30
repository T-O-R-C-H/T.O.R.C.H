"""
TORCH Tools — Local speech-to-text (faster-whisper).

Transcription runs entirely on this machine. There is no cloud recogniser
anywhere in this module, and there must never be one: the previous
implementation fell back to Google's Web Speech API whenever the local model
was missing, so every voice command was uploaded while the app called itself
local-first.

The model weights are a separate ~148 MB download, and they are **never**
fetched implicitly. faster-whisper will happily download on first use, so
every load here passes local_files_only and the only code that reaches the
network is start_download(), which the user has to ask for.
"""

import logging
import os
import threading
from typing import Any, Dict

from config.settings import settings
from errors.plain_language import UserFacingError

logger = logging.getLogger("torch.tools.stt")

# Only the base model, deliberately. Anything larger is a much bigger download
# on someone's metered connection and is not offered automatically.
MODEL_REPO = "Systran/faster-whisper-base"

# Enough to run the model; the repo also holds files we do not need.
MODEL_FILES = (
    "model.bin",
    "config.json",
    "tokenizer.json",
    "vocabulary.txt",
    "preprocessor_config.json",
)

# What model.bin plus the tokenizer actually weigh, for the download prompt.
# Measured from the repository manifest — an approximate figure shown to the
# user is fine, a wrong one is not.
MODEL_DOWNLOAD_BYTES = 148_000_000

# Files that must all be present before the model counts as installed. A
# partial download left by an interrupted attempt must not read as ready.
_REQUIRED_ON_DISK = ("model.bin", "config.json", "tokenizer.json")

_download_lock = threading.Lock()
_download_state: Dict[str, Any] = {
    "state": "idle",  # idle | downloading | ready | error
    "downloaded_bytes": 0,
    "total_bytes": MODEL_DOWNLOAD_BYTES,
    "error": None,
}

_model = None
_model_lock = threading.Lock()


def model_dir() -> str:
    """Where the weights live. Inside TORCH's data directory, not a shared cache."""
    return os.path.join(settings.data_dir, "models", "faster-whisper-base")


def engine_installed() -> bool:
    """Whether the speech engine itself is available."""
    try:
        import faster_whisper  # noqa: F401

        return True
    except ImportError:
        return False


def model_present() -> bool:
    """Whether the weights are already on disk, without touching the network."""
    directory = model_dir()
    return all(
        os.path.isfile(os.path.join(directory, name)) and os.path.getsize(
            os.path.join(directory, name)
        )
        > 0
        for name in _REQUIRED_ON_DISK
    )


def download_state() -> Dict[str, Any]:
    """A snapshot of the download, for the progress indicator."""
    with _download_lock:
        state = dict(_download_state)
    # Recompute readiness from disk rather than trusting the flag: the app may
    # have been restarted since the download finished.
    if state["state"] in ("idle", "ready") and model_present():
        state["state"] = "ready"
        state["downloaded_bytes"] = state["total_bytes"]
    return state


def _set_state(**changes: Any) -> None:
    with _download_lock:
        _download_state.update(changes)


def _progress_tqdm():
    """
    A tqdm stand-in that reports bytes instead of drawing a bar.

    huggingface_hub opens one bar per file, so progress is accumulated across
    all of them rather than read from any single bar.
    """
    from tqdm import tqdm as _tqdm

    class ProgressTqdm(_tqdm):
        def update(self, n=1):  # type: ignore[override]
            result = super().update(n)
            with _download_lock:
                _download_state["downloaded_bytes"] += n or 0
            return result

    return ProgressTqdm


def _download_worker() -> None:
    from huggingface_hub import snapshot_download

    try:
        os.makedirs(model_dir(), exist_ok=True)
        snapshot_download(
            repo_id=MODEL_REPO,
            local_dir=model_dir(),
            allow_patterns=list(MODEL_FILES),
            tqdm_class=_progress_tqdm(),
            max_workers=2,
        )
        if not model_present():
            raise RuntimeError("download finished but the model files are missing")
        _set_state(state="ready", downloaded_bytes=MODEL_DOWNLOAD_BYTES, error=None)
        logger.info("Voice model ready at %s", model_dir())
    except Exception as exc:
        logger.error("Voice model download failed: %s", exc)
        _set_state(
            state="error",
            error="The download didn't finish. Check your connection and try again.",
        )


def start_download() -> Dict[str, Any]:
    """
    Begin fetching the weights.

    The only network call in this module, and it happens only because the user
    answered yes to the prompt.
    """
    if not engine_installed():
        raise UserFacingError("Voice typing isn't available in this build of TORCH.")

    with _download_lock:
        if _download_state["state"] == "downloading":
            return dict(_download_state)
        if model_present():
            _download_state.update(
                state="ready", downloaded_bytes=MODEL_DOWNLOAD_BYTES, error=None
            )
            return dict(_download_state)
        _download_state.update(
            state="downloading", downloaded_bytes=0, total_bytes=MODEL_DOWNLOAD_BYTES, error=None
        )

    threading.Thread(target=_download_worker, daemon=True, name="voice-model-download").start()
    return download_state()


def _load_model():
    """Load the model from disk. Never downloads."""
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            _model = WhisperModel(
                model_dir(),
                device="cpu",
                # int8 keeps a CPU transcription quick and the memory small;
                # TORCH is a desktop assistant, not a batch transcriber.
                compute_type="int8",
                local_files_only=True,
            )
        return _model


def transcribe(wav_bytes: bytes) -> str:
    """
    Transcribe 16-bit PCM WAV on this machine.

    Raises a plain-language error rather than reaching for a cloud service if
    anything is missing.
    """
    import io

    if not engine_installed():
        raise UserFacingError("Voice typing isn't available in this build of TORCH.")
    if not model_present():
        raise UserFacingError(
            "TORCH needs to download a small voice model before it can write down speech."
        )

    try:
        model = _load_model()
        segments, _info = model.transcribe(io.BytesIO(wav_bytes), language="en", beam_size=1)
        return " ".join(segment.text.strip() for segment in segments).strip()
    except UserFacingError:
        raise
    except Exception as exc:
        logger.error("Local transcription failed: %s", exc)
        raise UserFacingError("TORCH couldn't make out any speech in that recording.") from exc


def reset_for_tests() -> None:
    """Clear cached state between tests."""
    global _model
    with _model_lock:
        _model = None
    _set_state(state="idle", downloaded_bytes=0, total_bytes=MODEL_DOWNLOAD_BYTES, error=None)


def status() -> Dict[str, Any]:
    """Everything the renderer needs to decide whether to offer the microphone."""
    return {
        "engine_installed": engine_installed(),
        "model_ready": model_present(),
        "download_bytes": MODEL_DOWNLOAD_BYTES,
        **download_state(),
    }


def local_stt_available() -> bool:
    """Whether speech can be transcribed right now, with no further downloads."""
    return engine_installed() and model_present()
