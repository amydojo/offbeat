"""Evidence-backed, tempo-aware phrase comparison. No overall 'accuracy' grade.

Alignment has one honest degree of freedom (offset + scale). It cannot warp
unrelated phrases into a match or modify either source's original seconds.
"""
from __future__ import annotations

import math

VERSION = "offbeat.compare.v1"


class ComparisonError(ValueError):
    pass


def _validate(phrase):
    if not isinstance(phrase, dict) or phrase.get("schema_version") != "offbeat.phrase.v1":
        raise ComparisonError("Both inputs must use offbeat.phrase.v1.")
    source = phrase.get("source", {})
    duration = source.get("duration_s", 0)
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 0 < duration <= 60:
        raise ComparisonError("Invalid source duration.")
    if not isinstance(phrase.get("analysis_id"), str) or not phrase["analysis_id"]:
        raise ComparisonError("Missing analysis identity.")
    for key, cap in (("onsets", 2000), ("pitch_frames", 12000), ("rests", 1000)):
        items = phrase.get(key)
        if not isinstance(items, list) or len(items) > cap:
            raise ComparisonError("Invalid or oversized feature array.")
        prev = -1.0
        for item in items:
            t = item.get("t_s", item.get("start_s")) if isinstance(item, dict) else None
            if not isinstance(t, (int, float)) or not math.isfinite(t) or not 0 <= t <= duration:
                raise ComparisonError("Feature timestamp falls outside its source.")
            if t < prev:
                raise ComparisonError("Features must be ordered by original time.")
            prev = t
            if key == "rests":
                end = item.get("end_s")
                if not isinstance(end, (int, float)) or not math.isfinite(end) or not t < end <= duration:
                    raise ComparisonError("Rest interval must be within source.")
            if key == "pitch_frames":
                hz = item.get("hz")
                if hz is not None and (not isinstance(hz, (int, float)) or not math.isfinite(hz) or hz <= 0):
                    raise ComparisonError("Invalid pitch frame.")
    return duration


def _anchors(phrase, mode):
    duration = phrase["source"]["duration_s"]
    attacks = [x["t_s"] for x in phrase["onsets"] if x.get("strength", 0) >= .2]
    if mode == "onsets" and len(attacks) >= 2 and attacks[-1] - attacks[0] > .15:
        return attacks[0], attacks[-1], "onset_span"
    return 0.0, duration, "duration"


def _relative_contour(phrase):
    valid = [f for f in phrase["pitch_frames"] if f.get("voiced")
             and f.get("hz") is not None and f.get("confidence", 0) >= .45]
    if not valid:
        return []
    hz = sorted(f["hz"] for f in valid)
    median = hz[len(hz) // 2]
    return [(f["t_s"], 12 * math.log2(f["hz"] / median)) for f in valid]


def _describe(contour):
    if len(contour) < 8:
        return None
    # Medians at early/late thirds, more robust than individual transient estimates.
    n = len(contour)
    left = sorted(v for _, v in contour[:max(2, n // 3)])
    right = sorted(v for _, v in contour[-max(2, n // 3):])
    d = right[len(right) // 2] - left[len(left) // 2]
    return "rises" if d > 1.6 else "falls" if d < -1.6 else "stays near its starting register"


def compare_phrases(reference, take, mode="onsets"):
    rd, td = _validate(reference), _validate(take)
    if mode not in ("onsets", "duration"):
        raise ComparisonError("Choose duration or onsets alignment.")
    r0, r1, rmethod = _anchors(reference, mode)
    t0, t1, tmethod = _anchors(take, mode)
    reference_span = r1 - r0
    take_span = t1 - t0
    ratio = reference_span / take_span
    if not 0.5 <= ratio <= 2:
        # Match can still be displayed, but the extreme stretch is not trustworthy.
        warning = "The phrases differ greatly in length; normalized alignment may be misleading."
    else:
        warning = None

    def take_at_reference(t):
        return t0 + (t - r0) / ratio

    take_onsets = take["onsets"]
    used = set()
    matched = []
    unmatched_reference = []
    tolerance = max(.09, min(.24, reference_span * .045))
    for i, attack in enumerate(reference["onsets"]):
        projected = take_at_reference(attack["t_s"])
        options = [(abs(candidate["t_s"] - projected) * ratio, j)
                   for j, candidate in enumerate(take_onsets) if j not in used]
        if not options:
            unmatched_reference.append(i)
            continue
        error, j = min(options)
        if error > tolerance:
            unmatched_reference.append(i)
            continue
        used.add(j)
        matched.append({
            "reference_index": i, "take_index": j,
            "reference_time_s": attack["t_s"],
            "take_time_s": take_onsets[j]["t_s"],
            "offset_on_reference_seconds": round((take_onsets[j]["t_s"] - projected) * ratio, 4),
        })

    rc = _relative_contour(reference)
    tc = _relative_contour(take)
    rdesc, tdesc = _describe(rc), _describe(tc)
    description = []
    if rdesc and tdesc:
        if rdesc == tdesc:
            description.append("Both phrases " + rdesc + ".")
        else:
            description.append("The reference " + rdesc + "; your take " + tdesc + ".")
    if reference["rests"] and take["rests"]:
        description.append("Both recordings contain audible spaces between gestures.")
    if not description:
        description.append("Try isolating cleaner, pitched phrases for a clearer comparison.")

    # Limit words that imply certainty: matched attacks are *temporal* correspondence,
    # not proof of identical melody, expressive intent, or tempo correctness.
    warnings = []
    if warning:
        warnings.append(warning)
    if not rc or not tc:
        warnings.append("Pitch-contour comparison is unavailable for one or both recordings.")
    if len(reference["onsets"]) < 2 or len(take["onsets"]) < 2:
        warnings.append("Too few attacks for a reliable rhythmic comparison; manually set a segment.")
    if "pitch_confidence_uncalibrated" in reference.get("quality_flags", []) or "pitch_confidence_uncalibrated" in take.get("quality_flags", []):
        warnings.append("Pitch confidence uses an uncalibrated baseline detector.")

    return {
        "schema_version": VERSION,
        "reference_analysis_id": reference["analysis_id"],
        "take_analysis_id": take["analysis_id"],
        "alignment": {
            "mode": mode,
            "method": rmethod if rmethod == tmethod else "mixed_span_fallback",
            "reference_anchor_start_s": r0,
            "reference_anchor_end_s": r1,
            "take_anchor_start_s": t0,
            "take_anchor_end_s": t1,
            "take_to_reference_scale": round(ratio, 6),
            "reference_duration_s": rd,
            "take_duration_s": td,
        },
        "matched_onsets": matched,
        "unmatched_reference_indices": unmatched_reference,
        "unmatched_take_indices": [j for j in range(len(take_onsets)) if j not in used],
        "coverage": {
            "reference_voiced_fraction": round(len(rc) / max(1, len(reference["pitch_frames"])), 4),
            "take_voiced_fraction": round(len(tc) / max(1, len(take["pitch_frames"])), 4),
        },
        "descriptors": description,
        "warnings": warnings,
    }
