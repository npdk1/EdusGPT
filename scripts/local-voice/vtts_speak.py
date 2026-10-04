"""Reads a lesson's narration on this machine, with v-tts.

v-tts is a small Vietnamese TTS — 74.8M parameters, CPU only, about four times
faster than real time on an ordinary processor. It has five speakers rather than
dozens, which is the point: it is a second opinion on a machine that already has
Piper, and it costs a few hundred megabytes instead of a few gigabytes.

    NF   nữ Bắc      SF   nữ Nam
    NM1  nam Bắc      SM   nam Nam      NM2  nam Bắc (thứ hai)

The model downloads itself from Hugging Face the first time it speaks, then
lives in the machine's own cache directory.

Node spawns this (`src/lib/server/local-voices.ts`), hands it a list of
sentences, and gets back one WAV file plus how long each sentence took — the
same contract as `piper_speak.py` and `vieneu_speak.py`, so the app needs no
special case per engine.

Usage:

    python vtts_speak.py --speaker NF --input sentences.json \
        --out narration.wav --align align.json
"""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesise sentences with v-tts.")
    parser.add_argument("--speaker", default="NF", help="NF, SF, NM1, SM or NM2.")
    parser.add_argument(
        "--input",
        required=True,
        help='JSON file holding an array of sentences, or "-" to read stdin.',
    )
    parser.add_argument("--out", required=True, help="Where to write the WAV file.")
    parser.add_argument("--align", default="", help="Where to write the sentence durations.")
    return parser.parse_args()


def read_sentences(source: str) -> list[str]:
    raw = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8-sig")
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("Input must be a JSON array of sentences.")
    return [str(item) for item in parsed if str(item).strip()]


def to_pcm16(audio) -> bytes:
    import numpy as np

    samples = np.asarray(audio)
    if samples.ndim > 1:
        samples = samples.mean(axis=1) if samples.shape[0] < samples.shape[-1] else samples.mean(axis=0)
    if samples.dtype == np.int16:
        return samples.astype("<i2").tobytes()
    if samples.dtype == np.int32:
        return (samples.astype(np.float32) / 2147483648.0).clip(-1, 1).mul(32767).astype("<i2").tobytes()
    return (samples.astype(np.float32).clip(-1.0, 1.0) * 32767.0).astype("<i2").tobytes()


def write_wave(target: str, pieces: list[bytes], sample_rate: int) -> None:
    path = Path(target)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(b"".join(pieces))


def write_align(target: str, sample_rate: int, durations: list[dict]) -> None:
    if not target:
        return
    path = Path(target)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"sampleRate": sample_rate, "sentences": durations}, ensure_ascii=False),
        encoding="utf-8",
    )


def synth_one(engine, sentence: str, speaker: str, sample_rate: int) -> tuple[bytes, int]:
    """`synthesize` gives (audio, rate); `speak` only gives a file. Prefer the first."""
    try:
        result = engine.synthesize(sentence, speaker=speaker)
    except TypeError:
        result = engine.synthesize(sentence, speaker)
    if isinstance(result, tuple) and len(result) == 2:
        audio, rate = result
        try:
            rate = int(rate)
        except (TypeError, ValueError):
            rate = sample_rate
    else:
        audio, rate = result, sample_rate
    return to_pcm16(audio), rate


def main() -> int:
    args = parse_args()

    from v_tts import TTS

    sentences = read_sentences(args.input)
    engine = TTS()

    if not sentences:
        rate = getattr(engine, "sample_rate", 24000) or 24000
        write_wave(args.out, [], int(rate))
        write_align(args.align, int(rate), [])
        print(json.dumps({"ok": True, "sampleRate": int(rate), "sentences": []}))
        return 0

    try:
        speakers = engine.list_speakers()
        names = [str(item) for item in speakers]
    except Exception:
        names = []
    speaker = args.speaker
    if names and speaker not in names:
        print(f"khong tim thay giong '{speaker}', dung '{names[0]}'", file=sys.stderr)
        speaker = names[0]

    pieces: list[bytes] = []
    durations: list[dict] = []
    sample_rate = 24000
    for index, sentence in enumerate(sentences):
        pcm, rate = synth_one(engine, sentence, speaker, sample_rate)
        sample_rate = rate
        pieces.append(pcm)
        spoken = len(pcm) // 2
        durations.append(
            {"index": index, "samples": spoken, "seconds": round(spoken / sample_rate, 4)}
        )

    write_wave(args.out, pieces, sample_rate)
    write_align(args.align, sample_rate, durations)
    print(
        json.dumps({"ok": True, "sampleRate": sample_rate, "sentences": durations}, ensure_ascii=False)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
