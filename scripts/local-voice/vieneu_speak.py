"""Reads a lesson's narration on this machine, with VieNeu-TTS.

VieNeu is a Vietnamese TTS built here, and it is the one that sounds like a
person: 48 kHz audio, a choice of preset speakers, and emotion cues written
straight into the text (`[cười]`, `[thở dài]`). It comes in two sizes and the
app picks between them:

    v3 Nano   282 MB, 24 kHz, loads in about 3 s, RTF 0.11-0.22 on a laptop CPU
    v3 Turbo  the reference model, 48 kHz, 25 speakers, RTF ~0.5 on CPU and
              ~0.02 on a GPU when PyTorch is installed alongside

Node spawns this (`src/lib/server/local-voices.ts`), hands it a list of
sentences, and gets back one WAV file plus how long each sentence took — which
is everything the app's word timings need.

Usage:

    python vieneu_speak.py --mode nano --voice "Hải Đăng" \
        --input sentences.json --out narration.wav --align align.json

Like `piper_speak.py`, this file imports nothing from EdusGPT: whatever breaks
in a Python environment is one file to read, not a dependency graph.
"""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path

# The two backbones, and the sample rate each one speaks at.
MODES = {"nano": 24000, "turbo": 48000}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesise sentences with VieNeu-TTS.")
    parser.add_argument(
        "--mode",
        default="nano",
        choices=sorted(MODES),
        help="v3 Nano (small, fast) or v3 Turbo (48 kHz, 25 speakers).",
    )
    parser.add_argument("--voice", default="", help="Preset speaker name, e.g. Hải Đăng.")
    parser.add_argument(
        "--input",
        required=True,
        help='JSON file holding an array of sentences, or "-" to read stdin.',
    )
    parser.add_argument("--out", required=True, help="Where to write the WAV file.")
    parser.add_argument("--align", default="", help="Where to write the sentence durations.")
    parser.add_argument("--speed", type=float, default=1.0, help="1.0 is the model's own pace.")
    return parser.parse_args()


def read_sentences(source: str) -> list[str]:
    # `utf-8-sig`: a BOM is invisible in an editor and makes json.loads fail on a
    # file that looks perfectly valid.
    raw = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8-sig")
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("Input must be a JSON array of sentences.")
    return [str(item) for item in parsed if str(item).strip()]


def to_pcm16(audio) -> bytes:
    """Whatever the model handed back, as little-endian 16-bit mono PCM."""
    try:
        import numpy as np
    except ImportError as error:  # pragma: no cover - vieneu always brings numpy
        raise SystemExit("Thieu numpy: cai lai vieneu trong venv.") from error

    samples = np.asarray(audio)
    if samples.ndim > 1:
        # (1, n) or (n, 1) → n. A stereo pair would be averaged; none of the
        # backbones produce one, and averaging is better than crashing.
        samples = samples.mean(axis=1) if samples.shape[0] < samples.shape[-1] else samples.mean(axis=0)
    if samples.dtype == np.int16:
        return samples.astype("<i2").tobytes()
    if samples.dtype == np.int32:
        return (samples.astype(np.float32) / 2147483648.0).clip(-1, 1).mul(32767).astype("<i2").tobytes()
    # float in [-1, 1]; anything past that is clipping, and the clip is kinder
    # than a wrap-around that turns loud syllables into noise.
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


def make_engine(mode: str, threads: int | None):
    from vieneu import Vieneu

    try:
        return Vieneu(mode=f"v3{mode}", threads=threads)
    except TypeError:
        # Older builds take no thread count; the default is a good enough answer.
        return Vieneu(mode=f"v3{mode}")


def choose_voice(engine, requested: str) -> str:
    """The requested preset if it exists, else the model's own default."""
    try:
        voices = engine.list_preset_voices()
    except Exception:
        voices = []
    names = []
    for item in voices:
        # The SDK returns (label, id) pairs; an older build returns plain names.
        names.append(str(item[1] if isinstance(item, (tuple, list)) and len(item) > 1 else item))
    if not requested or requested in names:
        return requested
    if names:
        print(f"khong tim thay giong '{requested}', dung '{names[0]}'", file=sys.stderr)
        return names[0]
    return requested


def infer(engine, sentence: str, voice: str, speed: float):
    kwargs = {"voice": voice} if voice else {}
    if speed and abs(speed - 1.0) > 1e-3:
        kwargs["speed"] = speed
    try:
        return engine.infer(sentence, **kwargs)
    except TypeError:
        # Not every backbone takes `speed`; the sentence still has to be read.
        if not kwargs:
            raise
        return engine.infer(sentence, voice=voice) if voice else engine.infer(sentence)


def main() -> int:
    args = parse_args()
    sample_rate = MODES[args.mode]

    sentences = read_sentences(args.input)
    if not sentences:
        write_wave(args.out, [], sample_rate)
        write_align(args.align, sample_rate, [])
        print(json.dumps({"ok": True, "sampleRate": sample_rate, "sentences": []}))
        return 0

    engine = make_engine(args.mode, None)
    voice = choose_voice(engine, args.voice)

    pieces: list[bytes] = []
    durations: list[dict] = []
    for index, sentence in enumerate(sentences):
        pcm = to_pcm16(infer(engine, sentence, voice, args.speed))
        pieces.append(pcm)
        spoken = len(pcm) // 2
        durations.append(
            {"index": index, "samples": spoken, "seconds": round(spoken / sample_rate, 4)}
        )

    write_wave(args.out, pieces, sample_rate)
    write_align(args.align, sample_rate, durations)
    print(
        json.dumps(
            {"ok": True, "sampleRate": sample_rate, "sentences": durations, "mode": args.mode},
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
