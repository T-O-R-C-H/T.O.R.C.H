"""
TORCH Tools — Text to speech.

The quality ladder is Piper, then the browser's speechSynthesis, then
pyttsx3. Every rung runs on this machine. The previous implementation posted
the text to Google's Gemini TTS endpoint, so whatever TORCH was about to say
aloud — which is a summary of what it just did on the user's computer — left
the machine first.

This module owns the two rungs that live in Python. speechSynthesis is the
renderer's rung and sits between them, because it is always available with no
setup while Piper needs a 63 MB voice downloaded first.
"""

import io
import logging
import os
import threading
import wave

from config.settings import settings
from errors.plain_language import UserFacingError
from tools.model_download import ModelDownload

logger = logging.getLogger("torch.tools.tts")

# A small, natural English voice. "medium" is the quality tier, not the size:
# it weighs the same as "low" and sounds considerably better.
PIPER_VOICE = "en_US-amy-medium"
_VOICE_PATH = "en/en_US/amy/medium"

PIPER_FILES = (f"{_VOICE_PATH}/{PIPER_VOICE}.onnx", f"{_VOICE_PATH}/{PIPER_VOICE}.onnx.json")
PIPER_DOWNLOAD_BYTES = 63_500_000


def piper_dir() -> str:
    return os.path.join(settings.data_dir, "models", "piper")


piper_model = ModelDownload(
    repo_id="rhasspy/piper-voices",
    target_dir_factory=piper_dir,
    allow_patterns=PIPER_FILES,
    # snapshot_download preserves the repo's directory layout.
    required_files=PIPER_FILES,
    total_bytes=PIPER_DOWNLOAD_BYTES,
    label="Piper voice",
)

_voice = None
_voice_lock = threading.Lock()


def piper_installed() -> bool:
    """Whether the Piper engine is in this build."""
    try:
        import piper  # noqa: F401

        return True
    except ImportError:
        return False


def piper_ready() -> bool:
    """Whether Piper can speak right now, with no further downloads."""
    return piper_installed() and piper_model.present()


def _load_voice():
    global _voice
    with _voice_lock:
        if _voice is None:
            from piper import PiperVoice

            model_path = os.path.join(piper_dir(), PIPER_FILES[0])
            config_path = os.path.join(piper_dir(), PIPER_FILES[1])
            _voice = PiperVoice.load(model_path, config_path=config_path)
        return _voice


def synthesize(text: str) -> bytes:
    """
    Render speech to a WAV with Piper, on this machine.

    Raises rather than reaching for a network voice: the caller falls to the
    next rung of the ladder, which is also local.
    """
    clean = " ".join(text.split())
    if not clean:
        raise UserFacingError("There was nothing to say.")
    if not piper_ready():
        raise UserFacingError("The natural voice isn't downloaded yet.")

    try:
        voice = _load_voice()
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            voice.synthesize_wav(clean, wav_file)
        return buffer.getvalue()
    except UserFacingError:
        raise
    except Exception as exc:
        logger.error("Piper synthesis failed: %s", exc)
        raise UserFacingError("TORCH couldn't speak that just now.") from exc


def speak_with_system_voice(text: str) -> None:
    """
    The last rung: the operating system's own voice, via pyttsx3.

    Used only when Piper has no voice downloaded and the renderer's
    speechSynthesis is unavailable too.
    """
    from tools.voice import speak

    result = speak(text)
    if result.startswith("Speech failed"):
        raise UserFacingError("TORCH couldn't speak that just now.")


def status() -> dict:
    """What the renderer needs to pick a rung and to render Settings."""
    return {
        "piper_installed": piper_installed(),
        "piper_ready": piper_ready(),
        "download_bytes": PIPER_DOWNLOAD_BYTES,
        **piper_model.state(),
    }


def reset_for_tests() -> None:
    global _voice
    with _voice_lock:
        _voice = None
    piper_model.reset()
