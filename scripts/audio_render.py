import wave
from pathlib import Path

import numpy as np

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]


def render_plan(plan: dict, focus_evidence: bool = False) -> np.ndarray:
    directory = ROOT / "apps/web/public/audio" / plan["kit_id"]
    buffers = {}
    pcm = np.zeros((round((plan["total_bars"] * 2.5 + 1) * RATE), 2))
    for note in plan["notes"]:
        if focus_evidence and note["kind"] == "accompaniment":
            continue
        key = f"{note['voice']}-{note['variant']}"
        if key not in buffers:
            with wave.open(str(directory / f"{key}.wav")) as source:
                buffers[key] = (
                    np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(float) / 32768
                )
        source = buffers[key]
        base = 36 if note["voice"] == "bass" else 60
        ratio = 2 ** ((note["midi"] - base) / 12) if note.get("midi") is not None else 1
        length = min(round(note["duration_ms"] * RATE / 1000), round(len(source) / ratio))
        buffer = np.interp(np.arange(length) * ratio, np.arange(len(source)), source)
        attack = min(round((0.015 if note.get("midi") is not None else 0.01) * RATE), length)
        buffer[:attack] *= np.linspace(0, 1, attack)
        fade = min(round((0.05 if note["kind"] == "cue" else 0.08) * RATE), length)
        buffer[-fade:] *= np.linspace(1, 0, fade)
        offset = round(note["tick"] / 768 * RATE)
        length = min(length, len(pcm) - offset)
        if length <= 0:
            raise ValueError("Note extends outside score")
        panning = np.array([np.sqrt((1 - note["pan"]) / 2), np.sqrt((1 + note["pan"]) / 2)])
        gain = 0 if note["kind"] == "pulse" else note["velocity"] * 0.45 * 0.3
        pcm[offset : offset + length] += buffer[:length, None] * panning * gain
    assert np.isfinite(pcm).all() and 0 < np.max(abs(pcm)) < 0.95
    return pcm


def write_wav(path: Path, pcm: np.ndarray):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes((pcm * 32767).astype("<i2").tobytes())
