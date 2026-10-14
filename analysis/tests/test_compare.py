"""Pure fixture tests don't require invoking a pretrained model or copyrighted recordings."""
import copy
import pytest
from fastapi.testclient import TestClient
from offbeat.compare import compare_phrases, ComparisonError
from offbeat.api import app

HTTP = TestClient(app)
HEAD = {"X-Offbeat-Client": "local-ui", "Origin": "http://localhost:5173"}


def phrase(analysis_id, tempo_factor=1, direction=1):
    # Same gesture at different tempos and shifted pitch roots, onsets + rests.
    return {
        "schema_version": "offbeat.phrase.v1",
        "analysis_id": analysis_id,
        "source": {"duration_s": 4 * tempo_factor},
        "quality_flags": ["pitch_confidence_uncalibrated"],
        "onsets": [{"t_s": t * tempo_factor, "strength": .8} for t in (.3, 1.1, 1.8, 3.1)],
        "rests": [{"start_s": 2.0 * tempo_factor, "end_s": 2.6 * tempo_factor}],
        "pitch_frames": [{"t_s": (i + 3) * .1 * tempo_factor, "hz": 80 * 2 ** (direction * i / 90),
                          "voiced": True, "confidence": .55} for i in range(31)],
    }


def test_tempo_rescaled_phrase_preserves_original_times():
    a, b = phrase("a"), phrase("b", 1.25)
    orig = copy.deepcopy((a, b))
    out = compare_phrases(a, b)
    assert out["schema_version"] == "offbeat.compare.v1"
    assert out["alignment"]["take_to_reference_scale"] == .8
    assert len(out["matched_onsets"]) == 4
    assert not out["unmatched_take_indices"]
    assert out["alignment"]["reference_duration_s"] == 4
    assert out["alignment"]["take_duration_s"] == 5
    assert (a, b) == orig


def test_opposite_pitch_directions_not_called_identical():
    result = compare_phrases(phrase("a", direction=1), phrase("b", direction=-1))
    assert any("reference rises" in s and "take falls" in s for s in result["descriptors"])


def test_sparse_attacks_produce_warning_without_fake_bpm():
    a, b = phrase("a"), phrase("b")
    a["onsets"], b["onsets"] = [], []
    result = compare_phrases(a, b)
    assert result["alignment"]["method"] == "duration"
    assert any("Too few attacks" in w for w in result["warnings"])
    assert "tempo_bpm" not in str(result)


def test_invalid_source_time_rejected():
    a = phrase("a")
    a["rests"][0]["end_s"] = 12
    with pytest.raises(ComparisonError):
        compare_phrases(a, phrase("b"))


def test_api_comparison_valid_and_rejects_malformed():
    good = HTTP.post("/v1/compare", json={"reference": phrase("a"), "take": phrase("b")}, headers=HEAD)
    assert good.status_code == 200, good.text
    assert good.json()["schema_version"] == "offbeat.compare.v1"
    bad = HTTP.post("/v1/compare", json={"reference": {}, "take": phrase("b")}, headers=HEAD)
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "COMPARE_INVALID"


def test_api_origin_rejects():
    response = HTTP.post("/v1/compare", json={"reference": phrase("a"), "take": phrase("b")},
                         headers={"X-Offbeat-Client": "local-ui", "Origin": "https://evil.example"})
    assert response.status_code == 403
