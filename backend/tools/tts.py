"""
TORCH Tools — Text to speech.

The quality ladder is Kokoro, then the browser's speechSynthesis, then
pyttsx3. Every rung runs on this machine. An earlier implementation posted
the text to Google's Gemini TTS endpoint, so whatever TORCH was about to say
aloud — a summary of what it had just done on the user's computer — left the
machine first.

This module owns the two rungs that live in Python. speechSynthesis is the
renderer's rung and sits between them, because it is always available with no
setup while Kokoro needs a ~354 MB model downloaded first.
"""

import io
import logging
import os
import re
import threading
import wave

import numpy as np

from config.settings import settings
from errors.plain_language import UserFacingError
from tools.model_download import UrlModelDownload

logger = logging.getLogger("torch.tools.tts")

# Kokoro's published model files. Hosted as release assets rather than on the
# Hugging Face Hub, which is why this uses the URL downloader.
KOKORO_RELEASE = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
)
KOKORO_FILES = {
    "kokoro-v1.0.onnx": KOKORO_RELEASE + "kokoro-v1.0.onnx",
    "voices-v1.0.bin": KOKORO_RELEASE + "voices-v1.0.bin",
}

# Measured from the release assets: 325.5 MB + 28.2 MB. An approximate figure
# in front of the user is fine; a wrong one is not.
KOKORO_DOWNLOAD_BYTES = 354_000_000

# A warm, natural American voice. Kokoro ships several; this one reads a short
# recap sentence without the clipped delivery the lighter voices have.
KOKORO_VOICE = "af_sarah"

# Kokoro degrades on long inputs, so text is split on sentence boundaries and
# each chunk is synthesised separately. Roughly a token per word plus slack for
# punctuation: a recap is normally one sentence and never reaches this.
MAX_CHUNK_TOKENS = 200


def kokoro_dir() -> str:
    return os.path.join(settings.data_dir, "models", "kokoro")


kokoro_model = UrlModelDownload(
    files=KOKORO_FILES,
    target_dir_factory=kokoro_dir,
    total_bytes=KOKORO_DOWNLOAD_BYTES,
    label="Kokoro voice",
)

_voice = None
_voice_lock = threading.Lock()


def kokoro_installed() -> bool:
    """Whether the Kokoro engine is in this build."""
    try:
        import kokoro_onnx  # noqa: F401

        return True
    except ImportError:
        return False


def kokoro_ready() -> bool:
    """Whether Kokoro can speak right now, with no further downloads."""
    return kokoro_installed() and kokoro_model.present()


def _estimate_tokens(text: str) -> int:
    """Rough token count. Words plus punctuation is close enough to chunk on."""
    return len(re.findall(r"\w+|[^\w\s]", text))


def chunk_for_synthesis(text: str, max_tokens: int = MAX_CHUNK_TOKENS) -> list[str]:
    """
    Split text into pieces Kokoro handles well.

    Sentence boundaries first, because a chunk that ends mid-clause is audible
    as a wrong breath. A single sentence longer than the limit is split on
    commas, and failing that on words — those are last resorts, but silently
    truncating someone's text would be worse.
    """
    cleaned = " ".join((text or "").split())
    if not cleaned:
        return []

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
    chunks: list[str] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for sentence in sentences:
        if _estimate_tokens(sentence) > max_tokens:
            flush()
            chunks.extend(_split_oversized(sentence, max_tokens))
            continue
        candidate = f"{current} {sentence}".strip()
        if _estimate_tokens(candidate) > max_tokens:
            flush()
            current = sentence
        else:
            current = candidate

    flush()
    return chunks


def _split_oversized(sentence: str, max_tokens: int) -> list[str]:
    """One sentence that is too long on its own: break on commas, then words."""
    pieces: list[str] = []
    current = ""
    for part in re.split(r"(?<=,)\s+", sentence):
        candidate = f"{current} {part}".strip()
        if _estimate_tokens(candidate) > max_tokens and current:
            pieces.append(current.strip())
            current = part
        else:
            current = candidate
    if current.strip():
        pieces.append(current.strip())

    final: list[str] = []
    for piece in pieces:
        if _estimate_tokens(piece) <= max_tokens:
            final.append(piece)
            continue
        words = piece.split()
        buffer: list[str] = []
        for word in words:
            buffer.append(word)
            if _estimate_tokens(" ".join(buffer)) >= max_tokens:
                final.append(" ".join(buffer))
                buffer = []
        if buffer:
            final.append(" ".join(buffer))
    return final


def _load_voice():
    global _voice
    with _voice_lock:
        if _voice is None:
            from kokoro_onnx import Kokoro

            _voice = Kokoro(
                os.path.join(kokoro_dir(), "kokoro-v1.0.onnx"),
                os.path.join(kokoro_dir(), "voices-v1.0.bin"),
            )
        return _voice


def _pcm_to_wav(samples: "np.ndarray", sample_rate: int) -> bytes:
    """16-bit PCM WAV, which is what the renderer's <audio> expects."""
    clipped = np.clip(samples, -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())
    return buffer.getvalue()


def synthesize(text: str) -> bytes:
    """
    Render speech to a WAV with Kokoro, on this machine.

    Raises rather than reaching for a network voice: the caller falls to the
    next rung of the ladder, which is also local.
    """
    chunks = chunk_for_synthesis(text)
    if not chunks:
        raise UserFacingError("There was nothing to say.")
    if not kokoro_ready():
        raise UserFacingError("The natural voice isn't downloaded yet.")

    try:
        voice = _load_voice()
        pieces = []
        rate = 24000
        for chunk in chunks:
            samples, rate = voice.create(chunk, voice=KOKORO_VOICE, speed=1.0, lang="en-us")
            pieces.append(np.asarray(samples, dtype=np.float32))
        joined = pieces[0] if len(pieces) == 1 else np.concatenate(pieces)
        return _pcm_to_wav(joined, rate)
    except UserFacingError:
        raise
    except Exception as exc:
        logger.error("Kokoro synthesis failed: %s", exc)
        raise UserFacingError("TORCH couldn't speak that just now.") from exc


def speak_with_system_voice(text: str) -> None:
    """
    The last rung: the operating system's own voice, via pyttsx3.

    Used only when Kokoro has no model downloaded and the renderer's
    speechSynthesis is unavailable too.
    """
    from tools.voice import speak

    result = speak(text)
    if result.startswith("Speech failed"):
        raise UserFacingError("TORCH couldn't speak that just now.")


def status() -> dict:
    """What the renderer needs to pick a rung and to render Settings."""
    return {
        "engine_installed": kokoro_installed(),
        "voice_ready": kokoro_ready(),
        "voice": KOKORO_VOICE,
        "download_bytes": KOKORO_DOWNLOAD_BYTES,
        **kokoro_model.state(),
    }


def reset_for_tests() -> None:
    global _voice
    with _voice_lock:
        _voice = None
    kokoro_model.reset()
