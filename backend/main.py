"""
Vokal.AI backend: Module 2 (Speech-to-Text) and Module 5 (Speech Analysis).

Run (from the backend/ folder):
    uvicorn main:app --reload --port 8000

The frontend sends one audio file per answer to POST /analyze-speech.
The reply is JSON. See README.md for the exact shape.
"""
import os
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import speech_module as sm

MAX_UPLOAD_BYTES = 25 * 1024 * 1024          # 25 MB, plenty for a few minutes of speech
_analysis_lock = threading.Lock()            # one analysis at a time (CPU-heavy, shared model)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load Whisper once at start-up so the first answer is not slow.
    # Set PRELOAD_MODEL=0 to skip (useful for tests).
    if os.getenv("PRELOAD_MODEL", "1") != "0":
        sm._get_model()
    yield


app = FastAPI(title="Vokal.AI Speech API (Module 2 and 5)", lifespan=lifespan)

# Only needed if the browser calls this server directly.
# When the frontend uses the Next.js proxy (/api/speech), CORS is not involved.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def ui_fields(result: dict) -> dict:
    """Shape the result like the frontend's PracticeSession type (lib/mockSessions.ts),
    so the Reports and Practice pages can use it without any conversion."""
    transcript = result["transcript"]
    sa = result["speech_analysis"]
    minutes = transcript["duration_sec"] / 60
    return {
        "wpm": sa["wpm"],
        "fillersPerMin": round(sa["filler_count"] / minutes, 1) if minutes > 0 else 0,
        "fillerCount": sa["filler_count"],
        "fillers": [f"{word} ×{n}" for word, n in sa["filler_breakdown"].items()],
        "manglishCount": sa.get("manglish_filler_count", 0),
        "manglishFillers": [f"{word} ×{n}" for word, n in sa.get("manglish_breakdown", {}).items()],
        "longPauses": sa["long_pause_count"],
        "fluencyScore": sa["fluency_score"],
        "durationSec": transcript["duration_sec"],
        "transcript": transcript["clean_text"],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": sm.get_model_display_name(),
        "device": sm.get_active_device(),
    }


# A normal "def" (not "async def") on purpose: FastAPI then runs it in a worker
# thread, so a slow transcription does not freeze the whole server.
@app.post("/analyze-speech")
def analyze_speech_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("en"),
):
    suffix = Path(audio.filename or "answer.webm").suffix or ".webm"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        size = 0
        with os.fdopen(fd, "wb") as out:
            while chunk := audio.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "Audio file is too large (limit 25 MB).")
                out.write(chunk)
        if size == 0:
            raise HTTPException(422, "The audio file is empty.")

        try:
            with _analysis_lock:
                lang = None if language == "auto" else language
                result = sm.analyze_audio(tmp_path, language=lang)
        except RuntimeError as e:                      # unreadable audio, missing ffmpeg
            raise HTTPException(422, str(e))

        if not result["transcript"]["words"]:
            raise HTTPException(422, "No speech detected. Check the microphone and try again.")

        return {
            "ui": ui_fields(result),
            "transcript": result["transcript"],
            "speech_analysis": result["speech_analysis"],
        }
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
