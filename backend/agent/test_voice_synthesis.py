import io
import wave

from agent.voice_synthesis import _pcm_to_wav


def test_pcm_is_wrapped_as_playable_mono_wav():
    pcm = b"\x00\x00\x10\x00" * 120
    wav_bytes = _pcm_to_wav(pcm)

    with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
        assert wav.getnchannels() == 1
        assert wav.getsampwidth() == 2
        assert wav.getframerate() == 24000
        assert wav.readframes(wav.getnframes()) == pcm
