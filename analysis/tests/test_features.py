import hashlib
import numpy as np
from offbeat.features import analyze_samples, SAMPLE_RATE


def analyze(y):
    return analyze_samples(
        np.array(y, dtype=np.float32), SAMPLE_RATE,
        source_sha256=hashlib.sha256(np.array(y, dtype="<f4").tobytes()).hexdigest(),
        source_kind="solo_bass", input_sample_rate=SAMPLE_RATE,
        input_channels=1, mime_type="audio/wav",
    )


def test_silence_is_not_a_note():
    result = analyze(np.zeros(SAMPLE_RATE, dtype=np.float32))
    assert result["schema_version"] == "offbeat.phrase.v1"
    assert result["source"]["duration_s"] == 1.0
    assert all(not frame["voiced"] and frame["hz"] is None for frame in result["pitch_frames"])
    assert "near_silent" in result["quality_flags"]


def test_low_e_bass_is_representation_and_provenance():
    t = np.arange(SAMPLE_RATE * 2) / SAMPLE_RATE
    y = 0.3 * np.sin(2 * np.pi * 41.203 * t)
    result = analyze(y)
    pitched = [f["hz"] for f in result["pitch_frames"] if f["voiced"]]
    assert len(pitched) > 30
    assert np.median(pitched) >= 39
    assert np.median(pitched) <= 44
    assert result["processing"]["pitch_adapter"] == "baseline_yin"
    assert len(result["source"]["sha256"]) == 64


def test_rest_gaps_do_not_get_fabricated_pitch():
    t = np.arange(SAMPLE_RATE) / SAMPLE_RATE
    audio = np.concatenate([0.3 * np.sin(2*np.pi*80*t),
                            np.zeros(SAMPLE_RATE, dtype=np.float32),
                            0.3 * np.sin(2*np.pi*92*t)])
    result = analyze(audio)
    assert any(x["start_s"] <= 1.2 and x["end_s"] >= 1.8 for x in result["rests"])
    assert any(not f["voiced"] for f in result["pitch_frames"])
