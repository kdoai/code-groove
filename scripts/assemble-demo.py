import json
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from audio_render import render_plan

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100


def main():
    timing = json.loads((ROOT / "artifacts/demo-timing.json").read_text())
    pcm = np.zeros((RATE * 180, 2))
    for segment in timing["segments"]:
        name = segment["sample"]
        path = ROOT / f"fixtures/recorded-live/{name.removeprefix('recorded-')}.json"
        plan = json.loads(path.read_text(encoding="utf-8"))["score"]["scenes"][0][segment["mode"]]
        rendered = render_plan(plan, segment.get("focusEvidence", False))
        start = round(segment["start"] * RATE)
        offset = round(segment.get("offset", 0) * RATE)
        length = min(
            round((segment["end"] - segment["start"]) * RATE), len(rendered) - offset, len(pcm) - start
        )
        if length <= 0:
            raise ValueError("Invalid captured playback segment")
        pcm[start : start + length] += rendered[offset : offset + length]
    assert np.isfinite(pcm).all() and np.max(np.abs(pcm)) < 0.95
    with wave.open(str(ROOT / "artifacts/demo-audio.wav"), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes((pcm * 32767).astype("<i2").tobytes())
    captions = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1280",
        "PlayResY: 816",
        "[V4+ Styles]",
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
        "Style: Default,Yu Gothic,22,&H00FFFFFF,&H000000FF,&H00202636,&H00202636,0,0,0,0,100,100,0,0,1,0,0,2,24,24,18,1",
        "[Events]",
        "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ]
    for block in (ROOT / "docs/demo-subtitles.srt").read_text(encoding="utf-8").strip().split("\n\n"):
        lines = block.splitlines()
        start_time, end_time = lines[1].split(" --> ")
        start_time, end_time = (value[1:].replace(",", ".")[:-1] for value in (start_time, end_time))
        caption = r"\N".join(lines[2:])
        captions.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{caption}")
    (ROOT / "artifacts/demo-captions.ass").write_text("\n".join(captions), encoding="utf-8")
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-i",
        "artifacts/demo-browser.webm",
        "-i",
        "artifacts/demo-audio.wav",
        "-vf",
        "pad=1280:816:0:0:color=0x202636,subtitles=artifacts/demo-captions.ass",
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
