"""
TORCH Tools — the wake word.

Listening for a phrase means holding the microphone open, so this module is
written to be defensible about it:

  * Detection runs entirely on this machine. openWakeWord scores 80ms frames
    against a small local model. Nothing is uploaded, and no audio is written
    to disk.
  * Audio is never retained. Each frame is scored and dropped; there is no
    ring buffer holding what was said before the wake word.
  * It is off unless the user turns it on, and it stops the moment they turn
    it off. The previous wake word in this project streamed every phrase to
    Google's speech API to test whether it was the trigger; that one was
    deleted and this replaces it.

Only the phrase itself is matched here. Whatever the user says afterwards is
captured by the renderer and transcribed by faster-whisper, which is also
local.
"""

import logging
import os
import threading
from typing import Callable, List, Optional

import numpy as np

from config.settings import settings

logger = logging.getLogger("torch.tools.wakeword")

# openWakeWord expects 16 kHz mono, and scores in 80ms frames.
SAMPLE_RATE = 16000
FRAME_SAMPLES = 1280

# Above this score the phrase counts as heard. openWakeWord's own guidance is
# 0.5; this sits higher because a false wake is worse than a missed one - it
# starts recording the room unasked.
DEFAULT_THRESHOLD = 0.6

# After a detection, ignore further hits for this long. One spoken phrase
# spans several frames and would otherwise fire repeatedly.
COOLDOWN_SECONDS = 2.0


def models_dir() -> str:
    return os.path.join(settings.data_dir, "models", "wakeword")


def custom_model_path() -> Optional[str]:
    """
    A model trained for TORCH's own phrase, if one has been provided.

    openWakeWord ships pretrained models for other phrases (hey jarvis, alexa)
    but none for "Hey TORCH", and neither does Porcupine. Dropping a trained
    .onnx or .tflite in here is what makes the real phrase work; without it
    the configured fallback phrase is used instead.
    """
    directory = models_dir()
    if not os.path.isdir(directory):
        return None
    for name in sorted(os.listdir(directory)):
        if name.lower().endswith((".onnx", ".tflite")) and "melspectrogram" not in name:
            if "embedding" not in name.lower():
                return os.path.join(directory, name)
    return None


def engine_installed() -> bool:
    try:
        import openwakeword  # noqa: F401

        return True
    except ImportError:
        return False


def _pretrained_available() -> List[str]:
    """Pretrained phrases openWakeWord has already downloaded."""
    try:
        import openwakeword

        base = os.path.join(os.path.dirname(openwakeword.__file__), "resources", "models")
        if not os.path.isdir(base):
            return []
        return sorted(
            os.path.splitext(f)[0]
            for f in os.listdir(base)
            if f.endswith(".onnx") and "melspectrogram" not in f and "embedding" not in f
        )
    except Exception:
        return []


def status() -> dict:
    """What the renderer needs to decide whether the feature can be offered."""
    custom = custom_model_path()
    return {
        "engine_installed": engine_installed(),
        "custom_model": os.path.basename(custom) if custom else None,
        "pretrained": _pretrained_available(),
        "ready": engine_installed() and (custom is not None or bool(_pretrained_available())),
        "listening": _listener.is_listening() if _listener else False,
    }


class WakeWordListener:
    """
    Holds the microphone and calls back when the phrase is heard.

    Runs on its own thread so a slow frame never blocks the event loop, and
    stops cleanly: the stream is closed in a finally, so an exception cannot
    leave the microphone open.
    """

    def __init__(self) -> None:
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._on_wake: Optional[Callable[[], None]] = None
        self._lock = threading.Lock()

    def is_listening(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self, on_wake: Callable[[], None]) -> dict:
        with self._lock:
            if self.is_listening():
                return {"listening": True, "already": True}
            if not engine_installed():
                raise RuntimeError("The wake word isn't available in this build of TORCH.")

            self._on_wake = on_wake
            self._stop.clear()
            self._thread = threading.Thread(
                target=self._run, name="torch-wakeword", daemon=True
            )
            self._thread.start()
            logger.info("Wake word listening started")
            return {"listening": True}

    def stop(self) -> dict:
        with self._lock:
            self._stop.set()
            thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=2)
        with self._lock:
            self._thread = None
        logger.info("Wake word listening stopped")
        return {"listening": False}

    def _build_model(self):
        from openwakeword.model import Model

        custom = custom_model_path()
        if custom:
            logger.info("Wake word using custom model: %s", os.path.basename(custom))
            return Model(wakeword_models=[custom], inference_framework="onnx")

        pretrained = _pretrained_available()
        if not pretrained:
            raise RuntimeError(
                "No wake word model is installed. Download one in Settings."
            )
        logger.info("Wake word using pretrained phrase: %s", pretrained[0])
        return Model(wakeword_models=[pretrained[0]], inference_framework="onnx")

    def _run(self) -> None:
        import time

        import sounddevice as sd

        stream = None
        try:
            model = self._build_model()
            stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=FRAME_SAMPLES,
            )
            stream.start()
            last_fired = 0.0

            while not self._stop.is_set():
                frame, overflowed = stream.read(FRAME_SAMPLES)
                if overflowed:
                    # A dropped frame is not worth reporting; the next one is
                    # 80ms away.
                    continue

                scores = model.predict(np.frombuffer(frame, dtype=np.int16))
                # The frame is scored and dropped here. Nothing keeps it.
                best = max(scores.values()) if scores else 0.0

                now = time.time()
                if best >= DEFAULT_THRESHOLD and (now - last_fired) > COOLDOWN_SECONDS:
                    last_fired = now
                    logger.info("Wake word heard (score %.2f)", best)
                    callback = self._on_wake
                    if callback:
                        try:
                            callback()
                        except Exception:
                            logger.exception("Wake word callback failed")
        except Exception as exc:
            logger.error("Wake word listener stopped: %s", exc)
        finally:
            # The microphone must not stay open because something threw.
            if stream is not None:
                try:
                    stream.stop()
                    stream.close()
                except Exception:
                    logger.warning("Could not close the wake word stream", exc_info=True)


_listener = WakeWordListener()


def start_listening(on_wake: Callable[[], None]) -> dict:
    return _listener.start(on_wake)


def stop_listening() -> dict:
    return _listener.stop()


def is_listening() -> bool:
    return _listener.is_listening()
