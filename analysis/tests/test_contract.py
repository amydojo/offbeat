import hashlib
import json
from pathlib import Path
import numpy as np
import jsonschema
from offbeat.features import analyze_samples, SAMPLE_RATE


SCHEMA = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "phrase.v1.schema.json").read_text()
)


def test_schema_matches_real_silent_analysis():
    samples = np.zeros(SAMPLE_RATE, dtype=np.float32)
    result = analyze_samples(
        samples, SAMPLE_RATE,
        source_sha256=hashlib.sha256(samples.tobytes()).hexdigest(),
        source_kind="solo_bass", input_sample_rate=SAMPLE_RATE,
        input_channels=1, mime_type="audio/wav",
    )
    jsonschema.Draft202012Validator(SCHEMA, format_checker=jsonschema.FormatChecker()).validate(result)
    assert all(p["hz"] is None for p in result["pitch_frames"])


def test_schema_rejects_invalid_confidence():
    samples = np.zeros(SAMPLE_RATE // 2, dtype=np.float32)
    result = analyze_samples(
        samples, SAMPLE_RATE,
        source_sha256=hashlib.sha256(samples.tobytes()).hexdigest(),
        source_kind="solo_bass", input_sample_rate=SAMPLE_RATE,
        input_channels=1, mime_type="audio/wav",
    )
    result["pitch_frames"][0]["confidence"] = 8.5
    try:
        jsonschema.Draft202012Validator(SCHEMA).validate(result)
        raise AssertionError("Schema should reject out-of-range pitch confidence.")
    except jsonschema.ValidationError:
        pass
