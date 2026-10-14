import io
import wave
import numpy as np
from fastapi.testclient import TestClient
from offbeat.api import app

client = TestClient(app)
HEADER = {"X-Offbeat-Client": "local-ui", "Origin": "http://localhost:5173"}


def wav_blob(seconds=0.35):
    samples = np.zeros(int(22050 * seconds), dtype=np.int16)
    output = io.BytesIO()
    with wave.open(output, "wb") as dst:
        dst.setnchannels(1)
        dst.setsampwidth(2)
        dst.setframerate(22050)
        dst.writeframes(samples.tobytes())
    return output.getvalue()


def test_health():
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert data["cloud_enabled"] is False


def test_origin_gate():
    response = client.post("/v1/audio/analyze", headers={"Origin": "https://malicious.test"},
                           files={"file": ("test.wav", wav_blob(), "audio/wav")})
    assert response.status_code == 403


def test_no_header_is_rejected():
    response = client.post("/v1/audio/analyze", files={"file": ("test.wav", wav_blob(), "audio/wav")})
    assert response.status_code == 403


def test_analyze_silent_fixture():
    response = client.post("/v1/audio/analyze", headers=HEADER,
                           files={"file": ("test.wav", wav_blob(), "audio/wav")},
                           data={"source_kind": "solo_bass"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["schema_version"] == "offbeat.phrase.v1"
    assert data["source"]["kind"] == "solo_bass"
    assert all(frame["hz"] is None for frame in data["pitch_frames"])


def test_bad_content_kind_and_length():
    response = client.post("/v1/audio/analyze", headers=HEADER,
                           files={"file": ("test.txt", b"unsafe", "text/plain")})
    assert response.status_code == 415
    response = client.post("/v1/audio/analyze", headers=HEADER,
                           files={"file": ("empty.wav", b"", "audio/wav")})
    assert response.status_code == 422
    response = client.post("/v1/audio/analyze", headers=HEADER,
                           files={"file": ("test.wav", wav_blob(), "audio/wav")},
                           data={"source_kind": "other"})
    assert response.status_code == 400


def test_comparison_not_faked():
    response = client.post("/v1/compare", headers=HEADER, json={})
    assert response.status_code == 501


def test_decoder_disallows_network_protocols(monkeypatch):
    """No ffprobe/FFmpeg demuxer should be able to fetch remote media links."""
    import json
    from types import SimpleNamespace
    from offbeat.api import decode_audio
    import offbeat.api as api

    calls = []
    def fake_run(argv, **_kwargs):
        calls.append(argv)
        assert argv[argv.index("-protocol_whitelist") + 1] == "file,pipe"
        if argv[0] == "ffprobe":
            return SimpleNamespace(returncode=0, stdout=json.dumps({
                "streams": [{"sample_rate": "22050", "channels": 1}],
                "format": {"duration": "0.25"}
            }))
        return SimpleNamespace(
            returncode=0,
            stdout=np.zeros(5512, dtype="<f4").tobytes()
        )

    monkeypatch.setattr(api.subprocess, "run", fake_run)
    data, sample_rate, channels = decode_audio(b"not real audio; mocked decoder")
    assert data.size == 5512
    assert sample_rate == 22050 and channels == 1
    assert len(calls) == 2
