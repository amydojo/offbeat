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
