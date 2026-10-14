"""Loopback-only API: no cloud processing, retained uploads or user-selected paths."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .features import SAMPLE_RATE, SCHEMA_VERSION, analyze_samples
from .compare import compare_phrases, ComparisonError

MAX_BYTES = 25 * 1024 * 1024
MAX_SECONDS = 60
VALID_KINDS = {"solo_bass", "humming", "separated_stem", "mixed_reference"}
ALLOWED_ORIGINS = {
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
}
app = FastAPI(title="OFFBEAT Local Listening Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=sorted(ALLOWED_ORIGINS), allow_credentials=False,
    allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Offbeat-Client"],
)


def failure(status: int, code: str, message: str, retryable: bool = False):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "retryable": retryable, "details": {}}},
    )


@app.middleware("http")
async def enforce_origin(request: Request, call_next):
    if request.method != "OPTIONS":
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return failure(403, "ORIGIN_DENIED", "This local client origin is not allowed.")
        if request.url.path.startswith("/v1/") and request.headers.get("x-offbeat-client") != "local-ui":
            return failure(403, "CLIENT_HEADER_REQUIRED", "Local analysis requires the Offbeat client header.")
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok", "schema_version": SCHEMA_VERSION,
            "adapters": {"pitch": ["baseline_yin"], "onsets": ["librosa"]},
            "cloud_enabled": False}


def decode_audio(data: bytes) -> tuple[np.ndarray, int, int]:
    # All commands receive fixed arguments; the untrusted filename is never interpolated.
    with tempfile.TemporaryDirectory(prefix="offbeat-") as work:
        path = Path(work) / "upload.bin"
        path.write_bytes(data)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries",
             "format=duration:stream=sample_rate,channels", "-of", "json", str(path)],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if probe.returncode != 0:
            raise ValueError("This audio cannot be decoded.")
        metadata = json.loads(probe.stdout)
        streams = [s for s in metadata.get("streams", []) if s.get("sample_rate")]
        if not streams:
            raise ValueError("This file has no supported audio track.")
        sr = int(streams[0]["sample_rate"])
        channels = int(streams[0].get("channels", 1))
        duration = metadata.get("format", {}).get("duration")
        if duration and float(duration) > MAX_SECONDS:
            raise OverflowError("Audio exceeds the 60-second analysis limit.")
        encoded = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", str(path), "-map", "0:a:0",
             "-t", "60.05", "-ac", "1", "-ar", str(SAMPLE_RATE),
             "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"],
            capture_output=True, timeout=25, check=False,
        )
        if encoded.returncode != 0:
            raise ValueError("The audio decoder could not read this file.")
        y = np.frombuffer(encoded.stdout, dtype="<f4").copy()
        if not len(y):
            raise ValueError("No decoded audio samples were found.")
        if len(y) / SAMPLE_RATE > MAX_SECONDS:
            raise OverflowError("Audio exceeds the 60-second analysis limit.")
        return y, sr, channels


@app.post("/v1/audio/analyze")
async def analyze(
    file: UploadFile = File(...),
    source_kind: str = Form("solo_bass"),
    x_offbeat_client: str | None = Header(default=None),
):
    if source_kind not in VALID_KINDS:
        return failure(400, "INVALID_KIND", "Choose a supported source type.")
    if file.content_type and not (file.content_type.startswith("audio/") or file.content_type == "application/octet-stream"):
        return failure(415, "INVALID_MEDIA", "Please select a supported audio recording.")
    content = await file.read(MAX_BYTES + 1)
    if not content:
        return failure(422, "AUDIO_EMPTY", "The uploaded recording is empty.")
    if len(content) > MAX_BYTES:
        return failure(413, "AUDIO_TOO_LARGE", "Please choose audio under 25 MB.")
    try:
        waveform, sr, channels = decode_audio(content)
        return analyze_samples(
            waveform, SAMPLE_RATE, source_sha256=hashlib.sha256(content).hexdigest(),
            source_kind=source_kind, input_sample_rate=sr,
            input_channels=channels, mime_type=file.content_type or "application/octet-stream",
        )
    except OverflowError:
        return failure(413, "AUDIO_TOO_LONG", "Choose a recording under 60 seconds.")
    except (ValueError, json.JSONDecodeError):
        return failure(422, "DECODE_FAILED", "This recording could not be decoded.", True)
    except subprocess.TimeoutExpired:
        return failure(504, "DECODE_TIMEOUT", "Audio decoding timed out; try a shorter clip.", True)
    except FileNotFoundError:
        return failure(503, "DECODER_MISSING", "Install FFmpeg to analyze this recording.")
    except Exception:
        # Never return details that could include raw file content or local paths.
        return failure(500, "ANALYSIS_FAILED", "Audio analysis failed. Try a shorter, cleaner recording.", True)


@app.post("/v1/compare")
async def compare(request: Request):
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ComparisonError("Comparison request must be an object.")
        return compare_phrases(
            payload.get("reference"), payload.get("take"),
            mode=payload.get("mode", "onsets"),
        )
    except (ComparisonError, TypeError, KeyError, AttributeError) as exc:
        return failure(422, "COMPARE_INVALID", str(exc))
    except (ValueError, json.JSONDecodeError):
        return failure(400, "INVALID_JSON", "Provide a valid JSON comparison request.")
