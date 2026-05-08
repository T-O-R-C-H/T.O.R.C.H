"""
TORCH Tools — Voice (Whisper + pyttsx3)
Speech-to-text via OpenAI Whisper (local) and text-to-speech via pyttsx3.
"""

import logging
import threading
from typing import Optional, Callable

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


def listen(duration: int = 5) -> str:
    """Listen for speech and transcribe using Whisper (SpeechRecognition)."""
    try:
        import speech_recognition as sr

        recognizer = sr.Recognizer()
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            logger.info("Listening for speech...")
            audio = recognizer.listen(source, timeout=duration, phrase_time_limit=15)

        # Use Whisper for transcription (local, free)
        try:
            text = recognizer.recognize_whisper(audio, model="base", language="english")
            logger.info(f"Transcribed: {text}")
            return text
        except sr.UnknownValueError:
            return ""
        except Exception:
            # Fallback to Google Web Speech API
            try:
                text = recognizer.recognize_google(audio)
                return text
            except:
                return ""

    except Exception as e:
        logger.error(f"Listen failed: {e}")
        return f"Listen failed: {e}"


class WakeWordDetector:
    """Background wake word detection for 'Hey TORCH'."""

    def __init__(self, callback: Optional[Callable] = None):
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._callback = callback

    def start(self) -> None:
        """Start wake word detection in background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.info("Wake word detection started")

    def stop(self) -> None:
        """Stop wake word detection."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
        logger.info("Wake word detection stopped")

    def _listen_loop(self) -> None:
        """Continuous listening loop for wake word."""
        try:
            import speech_recognition as sr

            recognizer = sr.Recognizer()
            recognizer.energy_threshold = 300
            recognizer.dynamic_energy_threshold = True

            with sr.Microphone() as source:
                recognizer.adjust_for_ambient_noise(source, duration=1)

                while self._running:
                    try:
                        audio = recognizer.listen(source, timeout=2, phrase_time_limit=3)
                        try:
                            text = recognizer.recognize_google(audio).lower()
                            if "hey torch" in text or "torch" in text:
                                logger.info(f"Wake word detected: '{text}'")
                                if self._callback:
                                    self._callback()
                        except sr.UnknownValueError:
                            pass
                        except sr.RequestError:
                            pass
                    except sr.WaitTimeoutError:
                        continue
                    except Exception as e:
                        logger.error(f"Wake word loop error: {e}")
                        continue

        except Exception as e:
            logger.error(f"Wake word detector failed to start: {e}")
