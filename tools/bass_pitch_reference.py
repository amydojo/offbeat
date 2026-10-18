"""OFFBEAT / reference verifier — torchcrepe + librosa, offline.

python tools/bass_pitch_reference.py "Bass 4.m4a" --pair 94:196 -o result.json
pip install numpy librosa soundfile torch torchcrepe

No upload, model API or server needed. This is a research/desktop reference,
not the on-device browser estimator; scores are not proof of identical riffs.
"""
import argparse
import json
from pathlib import Path

import librosa
import numpy as np

SR = 16000
HOP = 160
FMIN, FMAX = 36.0, 390.0


def load_audio(path):
    audio, sr = librosa.load(path, sr=SR, mono=True)
    if not len(audio):
        raise ValueError("No audio in file")
    return np.asarray(audio, dtype=np.float32), sr


def estimate_pitch(segment, sr, backend):
    model_used = backend
    if backend in ("auto", "torchcrepe"):
        try:
            import torch
            import torchcrepe
            tensor = torch.tensor(segment, dtype=torch.float32)[None, :]
            frequency, periodicity = torchcrepe.predict(
                tensor, sr, HOP, FMIN, FMAX, model="tiny",
                batch_size=256, device="cpu", return_periodicity=True,
                decoder=torchcrepe.decode.viterbi)
            hz = frequency.detach().cpu().numpy().ravel()
            prob = periodicity.detach().cpu().numpy().ravel()
            hz[prob < .55] = np.nan
            return hz, prob, "torchcrepe-tiny"
        except ImportError:
            if backend == "torchcrepe":
                raise RuntimeError("torchcrepe is not installed. Run pip install torch torchcrepe")
            model_used = "librosa-yin-fallback"
    if backend == "yin":
        model_used = "librosa-yin-fallback"
    hz = librosa.yin(segment, fmin=FMIN, fmax=FMAX,
                     sr=sr, frame_length=2048, hop_length=HOP)
    rms = librosa.feature.rms(y=segment, frame_length=2048, hop_length=HOP)[0]
    n = min(len(hz), len(rms))
    hz = hz[:n]
    cutoff = max(.003, float(np.percentile(rms[:n], 25)) * 1.9)
    hz[rms[:n] < cutoff] = np.nan
    return hz, None, model_used


def phrase_features(y, sr, start, length, backend):
    start_frame = max(0, round(start * sr))
    segment = y[start_frame:min(len(y), start_frame + round(length * sr))]
    if len(segment) < sr * .7:
        return {"start": start, "notes": [], "backend": "too-short"}
    hz, periodicity, used = estimate_pitch(segment, sr, backend)
    onset_frames = librosa.onset.onset_detect(
        y=segment, sr=sr, hop_length=256, backtrack=False)
    times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=256)
    notes = []
    for t in times:
        index = int((t + .075) * sr / HOP)
        if index >= len(hz):
            continue
        candidates = hz[max(0, index - 2):min(len(hz), index + 3)]
        valid = candidates[np.isfinite(candidates)]
        if len(valid) < 2:
            continue
        frequency = float(np.median(valid))
        midi = 69 + 12 * np.log2(frequency / 440)
        conf = (float(np.nanmedian(periodicity[max(0, index - 2):index + 3]))
                if periodicity is not None else None)
        notes.append({
            "time": round(start + float(t), 3),
            "frequency_hz": round(frequency, 1),
            "midi_estimate": round(float(midi), 2),
            "confidence": round(conf, 3) if conf is not None else None
        })
    return {"start": start, "duration": length, "backend": used,
            "notes": notes, "notes_detected": len(notes)}


def relative_similarity(first, second):
    a = np.array([n["midi_estimate"] for n in first["notes"]], dtype=float)
    b = np.array([n["midi_estimate"] for n in second["notes"]], dtype=float)
    if min(len(a), len(b)) < 3:
        return {"available": False, "reason": "fewer-than-three-notes"}
    if min(len(a), len(b)) / max(len(a), len(b)) < .55:
        return {"available": False, "reason": "different-note-density"}
    positions = np.linspace(0, 1, 7)
    ia = np.interp(positions, np.linspace(0, 1, len(a)), a)
    ib = np.interp(positions, np.linspace(0, 1, len(b)), b)
    diff = np.abs((ia - ia[0]) - (ib - ib[0]))
    direction = np.mean(np.sign(np.diff(ia)) == np.sign(np.diff(ib)))
    score = float(.74 * np.exp(-np.minimum(diff, 12).mean() / 4) + .26 * direction)
    return {
        "available": True,
        "contour_similarity": round(score, 3),
        "mean_relative_semitone_error": round(float(diff.mean()), 2),
        "median_transposition_semitones": round(float(np.median(b) - np.median(a)), 1),
        "note_counts": [int(len(a)), int(len(b))],
        "confidence_note": ("YIN fallback has no calibrated periodicity confidence"
                            if first["backend"].endswith("fallback")
                            else "torchcrepe periodicity gated at 0.55")
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--pair", action="append",
                        help="Two source start times, seconds: 94:196")
    parser.add_argument("--pairs-json", type=Path,
                        help="JSON containing pairs [{a,b}]")
    parser.add_argument("--length", type=float, default=4.8)
    parser.add_argument("--backend",
                        choices=["auto", "torchcrepe", "yin"], default="auto")
    parser.add_argument("-o", "--output", type=Path,
                        default=Path("bass_pitch_analysis.json"))
    args = parser.parse_args()
    pairs = []
    for entry in args.pair or []:
        a, b = entry.split(":")
        pairs.append({"a": float(a), "b": float(b)})
    if args.pairs_json:
        obj = json.loads(args.pairs_json.read_text())
        pairs.extend(obj if isinstance(obj, list) else obj.get("pairs", []))
    if not pairs:
        parser.error("Provide --pair 94:196 or --pairs-json candidates.json")
    y, sr = load_audio(args.audio)
    output = {
        "audio": args.audio.name,
        "duration": round(len(y) / sr, 2),
        "sample_rate": sr,
        "method": "torchcrepe-or-explicit-yin-fallback",
        "pairs": []
    }
    for pair in pairs:
        a, b = float(pair["a"]), float(pair["b"])
        if min(a, b) < 0 or max(a, b) + args.length > len(y) / sr:
            raise ValueError(f"Pair out of recording range: {a}, {b}")
        fa = phrase_features(y, sr, a, args.length, args.backend)
        fb = phrase_features(y, sr, b, args.length, args.backend)
        output["pairs"].append({
            "a": a, "b": b, "first": fa, "second": fb,
            "comparison": relative_similarity(fa, fb)
        })
    args.output.write_text(json.dumps(output, indent=2))
    print(f"Wrote {args.output} | {len(output['pairs'])} pairs | backend "
          f"{output['pairs'][0]['first']['backend']}")


if __name__ == "__main__":
    main()
