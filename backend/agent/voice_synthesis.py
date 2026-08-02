"""High-quality Gemini speech synthesis with a small in-memory cache."""

import base64
import io
import wave
from collections import OrderedDict

import requests

from config.settings import settings

_cache: OrderedDict[str, bytes] = OrderedDict()


def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return output.getvalue()


def synthesize_voice(text: str) -> bytes:
    clean_text = " ".join(text.split())[:1200]
    if not clean_text:
        raise ValueError("Speech text is empty")
    if clean_text in _cache:
        _cache.move_to_end(clean_text)
        return _cache[clean_text]

    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-3.1-flash-tts-preview:generateContent",
        headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
        json={
            "contents": [{
                "role": "user",
                "parts": [{
                    "text": "Speak this exact response as TORCH: warm, intelligent, friendly, "
                    "natural, and concise. Avoid announcer energy. " + clean_text
                }],
            }],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Achird"}}
                },
            },
        },
        timeout=(4, 18),
    )
    response.raise_for_status()
    inline_data = response.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
    pcm = base64.b64decode(inline_data["data"])
    wav = _pcm_to_wav(pcm)
    _cache[clean_text] = wav
    while len(_cache) > 12:
        _cache.popitem(last=False)
    return wav
