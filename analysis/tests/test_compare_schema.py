import json
from pathlib import Path
import jsonschema
from test_compare import phrase
from offbeat.compare import compare_phrases


def test_comparison_schema_parity():
    schema = json.loads(
        (Path(__file__).resolve().parents[2] / "contracts" / "compare.v1.schema.json").read_text()
    )
    result = compare_phrases(phrase("r"), phrase("t", 1.25))
    jsonschema.Draft202012Validator(schema).validate(result)


def test_comparison_does_not_grade_or_report_bpm():
    output = compare_phrases(phrase("r"), phrase("t"))
    assert not any("score" in x.lower() or "accuracy" in x.lower() for x in output)
    assert "tempo_bpm" not in output
