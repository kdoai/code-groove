import json
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100


def main():
    timing = json.loads((ROOT / "artifacts/demo-timing.json").read_text())
    pcm = np.zeros((RATE * 180, 2))
    buffers = {}
    for path in (ROOT / "apps/web/public/audio/paper-studio-v1").glob("*.wav"):
        with wave.open(str(path), "rb") as source:
            buffers[path.stem] = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2") / 32768
    for segment in timing["segments"]:
        name = segment["sample"]
        source = (
            ROOT / f"fixtures/recorded-live/{name.removeprefix('recorded-')}.json"
            if name.startswith("recorded-")
            else ROOT / f"fixtures/{name}.json"
        )
        plan = json.loads(source.read_text(encoding="utf-8"))["score"]["scenes"][0][segment["mode"]]
        loop_seconds = plan["total_bars"] * 2.5
        start, end = segment["start"] + 0.03, segment["end"]
        cursor = start
        while cursor < end:
            for note in plan["notes"]:
                position = cursor + note["tick"] / 768
                if position >= end:
                    continue
                audio = buffers[f"{note['voice']}-{note['variant']}"]
                duration = min(len(audio), round(note["duration_ms"] * RATE / 1000))
                offset = round(position * RATE)
                duration = min(duration, round(end * RATE) - offset, len(pcm) - offset)
                if duration <= 0:
                    continue
                pan = np.sqrt(np.array([(1 - note["pan"]) / 2, (1 + note["pan"]) / 2]))
                pcm[offset : offset + duration] += (
                    audio[:duration, None] * pan * note["velocity"] * 0.45 * 0.3
                )
            cursor += loop_seconds
    assert np.isfinite(pcm).all() and np.max(np.abs(pcm)) < 0.95
    with wave.open(str(ROOT / "artifacts/demo-audio.wav"), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes((pcm * 32767).astype("<i2").tobytes())
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-i",
        "artifacts/demo-browser.webm",
        "-i",
        "artifacts/demo-audio.wav",
        "-vf",
        "pad=1280:816:0:0:color=0x202636,subtitles=docs/demo-subtitles.srt:force_style='FontName=Yu Gothic,FontSize=17,MarginV=12,Outline=0'",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-t",
        "180",
        "artifacts/code-groove-demo.mp4",
    ]
    subprocess.run(command, cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    print("Created 180s demo with subtitles and the same PCM score material; no narration or YouTube upload.")


if __name__ == "__main__":
    main()
