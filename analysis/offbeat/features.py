"""Deterministic DSP baseline. Unknown pitch is a gap, never an invented note."""
from __future__ import annotations

import hashlib
import json
import time
from uuid import uuid4

import librosa
import numpy as np

SCHEMA_VERSION = "offbeat.phrase.v1"
SAMPLE_RATE = 22050
HOP_ONSET = 256
HOP_PITCH = 512


def _intervals_from_silence(rms: np.ndarray, hop: int, sr: int, threshold: float, total: float):
    silent = rms < threshold
    intervals = []
    start = None
    for i, is_silent in enumerate(silent):
        if is_silent and start is None:
            start = i * hop / sr
        if start is not None and (not is_silent or i == len(silent) - 1):
            end = (i if not is_silent else i + 1) * hop / sr
            end = min(end, total)
            if end - start >= 0.12:
                intervals.append({"start_s": round(start, 4), "end_s": round(end, 4)})
            start = None
    return intervals


def analyze_samples(
    samples: np.ndarray,
    sample_rate: int,
    *,
    source_sha256: str,
    source_kind: str,
    input_sample_rate: int,
    input_channels: int,
    mime_type: str,
) -> dict:
    started = time.perf_counter()
    y = np.asarray(samples, dtype=np.float32)
    if y.ndim != 1 or y.size == 0 or not np.all(np.isfinite(y)):
        raise ValueError("Decoded audio must be a finite nonempty mono waveform.")
    duration = len(y) / sample_rate
    if duration > 60.01:
        raise ValueError("Recordings longer than 60 seconds are not supported.")
    peak = float(np.max(np.abs(y)))
    warnings = []
    flags = []
    if peak >= 0.999:
        flags.append("clipped")
        warnings.append("Some audio reaches the clipping limit.")
    if peak < 0.003:
        flags.append("near_silent")
        warnings.append("The recording is nearly silent; no reliable musical features may be available.")

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP_PITCH, center=True)[0]
    rest_threshold = max(float(np.percentile(rms, 75)) * 0.18, 0.003)
    rests = _intervals_from_silence(rms, HOP_PITCH, sample_rate, rest_threshold, duration)

    # Sparse peaks should not be confused with a stable tempo or musical intention.
    envelope = librosa.onset.onset_strength(y=y, sr=sample_rate, hop_length=HOP_ONSET)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=envelope, sr=sample_rate, hop_length=HOP_ONSET, backtrack=False
    )
    max_env = float(np.max(envelope)) if len(envelope) else 0.0
    onsets = [
        {"t_s": round(min(float(librosa.frames_to_time(int(frame), sr=sample_rate, hop_length=HOP_ONSET)), duration), 4),
         "strength": round(min(1.0, float(envelope[int(frame)]) / max_env), 4) if max_env else 0.0}
        for frame in onset_frames if int(frame) < len(envelope)
    ]

    # YIN is a baseline, not a calibrated pitch-confidence model. We label that fact.
    pitch = librosa.yin(y, fmin=36.0, fmax=650.0, sr=sample_rate, frame_length=2048, hop_length=HOP_PITCH)
    n = min(len(pitch), len(rms))
    pitch_frames = []
    voiced_count = 0
    for frame in range(n):
        t_s = frame * HOP_PITCH / sample_rate
        if t_s > duration:
            break
        hz = float(pitch[frame])
        voiced = bool(rms[frame] >= rest_threshold and np.isfinite(hz) and 36.0 <= hz <= 650.0)
        if voiced:
            voiced_count += 1
        pitch_frames.append({
            "t_s": round(t_s, 4),
            "hz": round(hz, 3) if voiced else None,
            "confidence": 0.55 if voiced else 0.0,
            "voiced": voiced,
        })
    flags.append("pitch_confidence_uncalibrated")
    if voiced_count < max(3, len(pitch_frames) * 0.15):
        flags.append("limited_pitch_coverage")
        warnings.append("Not enough reliable pitched sound for a full contour.")

    # Phrase breaks from substantial rests. They are suggestions, not authoritative bars.
    phrases = []
    cursor = 0.0
    for rest in rests:
        if rest["start_s"] - cursor >= 0.2:
            phrases.append({"start_s": round(cursor, 4), "end_s": rest["start_s"], "method": "rest_boundary"})
        cursor = rest["end_s"]
    if duration - cursor >= 0.2:
        phrases.append({"start_s": round(cursor, 4), "end_s": round(duration, 4), "method": "rest_boundary"})

    config = {"sr": sample_rate, "hop_onset": HOP_ONSET, "hop_pitch": HOP_PITCH,
              "fmin": 36, "fmax": 650, "rest_floor": 0.003}
    config_hash = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    return {
        "schema_version": SCHEMA_VERSION,
        "analysis_id": str(uuid4()),
        "source": {
            "sha256": source_sha256, "kind": source_kind,
            "duration_s": round(duration, 4), "sample_rate_hz": input_sample_rate,
            "channel_count": input_channels, "mime_type": mime_type,
        },
        "processing": {
            "analysis_sample_rate_hz": sample_rate, "timebase": "source_start_seconds",
            "analyzer_version": "0.1.0", "pitch_adapter": "baseline_yin",
            "pitch_model_version": f"librosa-{librosa.__version__}", "onset_adapter": "librosa",
            "config_hash": config_hash, "duration_ms": int((time.perf_counter() - started) * 1000),
        },
        "pitch_frames": pitch_frames, "onsets": onsets, "rests": rests,
        "phrases": phrases, "quality_flags": flags, "warnings": warnings,
    }
