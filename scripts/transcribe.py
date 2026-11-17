"""Turn an audio/video file into timed text, on this Mac (free). Used by the Research Desk helper.
Usage: python transcribe.py <file> [language]   → JSON {language, segments:[{t,d,text}]} on stdout."""
import json, os, sys
import av
import numpy as np
from faster_whisper import WhisperModel


def load_audio(path, rate=16000):
    # Decode with PyAV directly (works with current PyAV versions), mono 16 kHz float32.
    with av.open(path) as container:
        resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=rate)
        chunks = []
        for frame in container.decode(audio=0):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):
            chunks.append(out.to_ndarray().reshape(-1))
    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
    return audio.astype(np.float32) / 32768.0


path = sys.argv[1]
lang = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ("", "auto") else None
model = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
segments, info = model.transcribe(load_audio(path), language=lang, vad_filter=True, beam_size=1)
out = [{"t": round(s.start, 2), "d": round(s.end - s.start, 2), "text": s.text.strip()} for s in segments if s.text.strip()]
print(json.dumps({"language": info.language, "segments": out}, ensure_ascii=False))
