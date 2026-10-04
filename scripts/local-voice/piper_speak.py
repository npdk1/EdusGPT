"""Reads a lesson's narration on this machine, with Piper.

The web app speaks Vietnamese narration through a hosted voice service. That is
one network call per slide and it needs a machine that can reach the internet;
a teacher preparing lessons on a laptop with no signal gets nothing.

This script is the other half of that story: a voice model that runs locally,
loaded once and asked for every sentence of a scene in a single process. Node
spawns it (`src/lib/server/tts-local.ts`), hands it a list of sentences, and gets
back one WAV file plus how long each sentence turned out to be — which is all the
word timings need to be built from.

Usage:

    python piper_speak.py --model <voice.onnx> --input sentences.json \
        --out narration.wav --align align.json

It is deliberately a plain script with no EdusGPT imports: whatever breaks in a
Python environment is one file to read, not a dependency graph.
"""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesise sentences with Piper.")
    parser.add_argument("--model", required=True, help="Path to the .onnx voice model.")
    parser.add_argument(
        "--input",
        required=True,
        help='JSON file holding an array of sentences, or "-" to read stdin.',
    )
    parser.add_argument("--out", required=True, help="Where to write the WAV file.")
    parser.add_argument(
        "--align",
        default="",
        help="Where to write the per-sentence durations, as JSON.",
    )
    # Slower than 1.0 is a slower speaker. The app maps its voice names onto this
    # one number, because Piper has one Vietnamese voice rather than a dozen, and
    # a different tempo is the only thing a caller can still ask for.
    parser.add_argument("--length-scale", type=float, default=1.0)
    parser.add_argument("--volume", type=float, default=1.0)
    parser.add_argument(
        "--cuda",
        action="store_true",
        help="Run the model on the GPU. Falls back to the CPU when it is not there.",
    )
    return parser.parse_args()


def read_sentences(source: str) -> list[str]:
    # `utf-8-sig` rather than `utf-8`: a BOM is invisible in a text editor and
    # makes json.loads fail on a file that looks perfectly valid. Accepting it
    # costs nothing and saves a confusing error for whoever wrote the file.
    raw = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8-sig")
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("Input must be a JSON array of sentences.")
    return [str(item) for item in parsed if str(item).strip()]


def main() -> int:
    args = parse_args()

    from piper import PiperVoice, SynthesisConfig

    sentences = read_sentences(args.input)
    if not sentences:
        # Still write both files: an empty lesson is a valid answer, and a missing
        # file on the Node side reads as a crash rather than as silence.
        write_wave(args.out, [], 22050)
        write_align(args.align, 22050, [])
        print(json.dumps({"ok": True, "sampleRate": 22050, "sentences": []}))
        return 0

    voice = PiperVoice.load(args.model, use_cuda=args.cuda)
    config = SynthesisConfig(
        length_scale=args.length_scale,
        volume=args.volume,
        # The model file carries its own defaults for these two; passing them as
        # None is what keeps a voice from sounding different on a machine that
        # happens to have a newer Piper than the one it was trained with.
        noise_scale=None,
        noise_w_scale=None,
    )

    pieces: list[bytes] = []
    durations: list[dict] = []
    sample_rate = int(voice.config.sample_rate)
    for index, sentence in enumerate(sentences):
        spoken = 0
        for chunk in voice.synthesize(sentence, config):
            pieces.append(chunk.audio_int16_bytes)
            spoken += len(chunk.audio_int16_bytes) // 2
        # A sentence that produced nothing (an empty string, a line of symbols
        # espeak has no letters for) must still occupy its slot, or every later
        # sentence's timings slide up by one.
        durations.append(
            {"index": index, "samples": spoken, "seconds": round(spoken / sample_rate, 4)}
        )

    write_wave(args.out, pieces, sample_rate)
    write_align(args.align, sample_rate, durations)
    print(
        json.dumps(
            {
                "ok": True,
                "sampleRate": sample_rate,
                "sentences": durations,
                "cuda": bool(args.cuda),
            }
        )
    )
    return 0


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
        json.dumps({"sampleRate": sample_rate, "sentences": durations}),
        encoding="utf-8",
    )


if __name__ == "__main__":
    sys.exit(main())
