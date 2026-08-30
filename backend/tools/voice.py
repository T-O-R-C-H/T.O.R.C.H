"""
TORCH Tools — Voice (Whisper + pyttsx3)
Speech-to-text via OpenAI Whisper (local) and text-to-speech via pyttsx3.
"""

import logging
import threading
from typing import Optional

from errors.plain_language import UserFacingError

logger = logging.getLogger("torch.tools.voice")

# TTS engine (lazy-loaded, must be on main thread for some platforms)
_tts_engine = None
_tts_lock = threading.Lock()


def speak(text: str) -> str:
    """Speak text aloud using pyttsx3."""
    global _tts_engine
    try:
        import pyttsx3

        with _tts_lock:
            if _tts_engine is None:
                _tts_engine = pyttsx3.init()
                _tts_engine.setProperty("rate", 175)
                _tts_engine.setProperty("volume", 0.9)

            _tts_engine.say(text)
            _tts_engine.runAndWait()

        return f"Spoke: {text[:100]}"
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return f"Speech failed: {e}"


def local_stt_available() -> bool:
    """
    Whether speech can be transcribed on this machine.

    Callers use this to decide whether to offer voice at all. Offering a
    microphone that cannot transcribe locally is how audio ends up somewhere
    the user did not agree to send it.
    """
    try:
        import whisper  # noqa: F401

        return True
    except ImportError:
        return False


def transcribe_audio(wav_bytes: bytes) -> str:
    """
    Transcribe a 16-bit PCM WAV entirely on this machine.

    There is deliberately no cloud fallback. `listen()` used to drop to
    Google's Web Speech API whenever the local model was unavailable — which
    was always, because the whisper package is not installed — so every voice
    command was quietly uploaded to a third party while the app described
    itself as local-first. Failing here is the honest outcome: it is reported
    plainly and the user can choose to install the local model.
    """
    import io

    import speech_recognition as sr

    from config.settings import settings

    if not local_stt_available():
        raise UserFacingError(
            "Voice typing needs the offline speech model, which isn't installed yet. "
            "Everything stays on your computer once it is."
        )

    recognizer = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
        audio = recognizer.record(source)

    try:
        text = recognizer.recognize_whisper(
            audio, model=settings.whisper_model_size or "base", language="english"
        )
    except sr.UnknownValueError:
        return ""
    except Exception as exc:
        logger.error(f"Local transcription failed: {exc}")
        raise UserFacingError("TORCH couldn't make out any speech in that recording.") from exc

    return (text or "").strip()


def listen(duration: int = 5) -> str:
    """
    Capture one turn from the system microphone and transcribe it locally.

    Kept for the companion voice path. The renderer captures its own audio
    (so it can show a real level meter) and calls transcribe_audio instead.
    """
    try:
        import speech_recognition as sr

        recognizer = sr.Recognizer()
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            logger.info("Listening for speech...")
            audio = recognizer.listen(source, timeout=duration, phrase_time_limit=15)

        if not local_stt_available():
            return "Listen failed: the offline speech model isn't installed."

        try:
            from config.settings import settings

            text = recognizer.recognize_whisper(
                audio, model=settings.whisper_model_size or "base", language="english"
            )
            logger.info("Transcribed one voice turn")
            return text
        except sr.UnknownValueError:
            return ""

    except Exception as e:
        logger.error(f"Listen failed: {e}")
        return f"Listen failed: {e}"


# Wake word is deliberately not implemented.
#
# The previous WakeWordDetector held the microphone open continuously and sent
# every captured phrase to Google's Web Speech API to check whether it was the
# wake word — so an always-listening feature streamed the room to a third
# party. It was never instantiated anywhere, so nothing used it, but leaving
# it in the module meant one wire-up away from shipping that.
#
# Bringing it back needs an engine that matches the phrase entirely on this
# machine (openWakeWord, Porcupine, Vosk). Until one is chosen and packaged,
# there is no wake word rather than a wake word that uploads audio.
