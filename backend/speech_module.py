"""
AI Mock Interview Coach - Module 2 (Speech-to-Text) + Module 5 (Speech Analysis)
Owner: Alia

HOW TO USE (for the integrator):
    from speech_module import analyze_audio
    result = analyze_audio("answer.wav")   # returns a Python dict (JSON-ready)

Malaysian English / Manglish support:
    Uses Mesolitica's fine-tuned `malaysian-whisper-small-v3` (CTranslate2 int8)
    when converted in `backend/models/malaysian-whisper-small-v3-ct2`.
    Run `python convert_malaysian_whisper.py` once to prepare the local model.
"""

import json
import os
import re
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOCAL_MALAYSIAN_MODEL = BASE_DIR / "models" / "malaysian-whisper-small-v3-ct2"


def _default_model_size() -> str:
    env_model = os.getenv("WHISPER_MODEL", "").strip()
    if env_model:
        return env_model
    if (LOCAL_MALAYSIAN_MODEL / "model.bin").exists():
        return str(LOCAL_MALAYSIAN_MODEL)
    return "small"


# ---------------------------------------------------------------------------
# SETTINGS (tuned for Malaysian English, Manglish & technical interviews)
# ---------------------------------------------------------------------------
# Nudges Whisper to keep both English fillers ("um", "uh") and Malaysian
# particles ("lah", "kan") instead of dropping or rewriting them.
FILLER_PROMPT = (
    "Umm, so, uh, actually lah, during my internship at UTeM, I was, like, "
    "debugging the Python API and SQL database, you know, um, then kan, "
    "we fixed the server bug lah. Hmm, okay, so basically, let me explain."
)
FILLER_HOTWORDS = (
    "Umm, uh, ah, hmm, lah, leh, lor, kan, actually, basically, like, you know, "
    "API, SQL, Git, GitHub, Python, JavaScript, TypeScript, React, Next.js, "
    "database, backend, frontend, debugging, deployment, UTeM, FTMK, FYP"
)

CONFIG = {
    "model_size": _default_model_size(),
    "language": os.getenv("WHISPER_LANGUAGE", "en"),  # "en" or "auto" (BM+EN code-switch)
    "initial_prompt": FILLER_PROMPT,
    "hotwords": FILLER_HOTWORDS,
    "whisper_options": {
        "condition_on_previous_text": True,
        "vad_filter": True,
        "vad_parameters": {
            "threshold": 0.35,              # default 0.50 drops softer / distant speech
            "min_speech_duration_ms": 150,  # keeps brief fillers ("um", "lah") intact
            "min_silence_duration_ms": 600,
            "speech_pad_ms": 400,           # wider padding protects soft word starts/ends
        },
    },
    "sample_rate": 16000,            # Hz, the format Whisper prefers
    "long_pause_sec": 2.0,           # gap above this = long pause
    "natural_pause_sec": 0.5,        # gap below this = normal speech
    "wpm_min": 120,                  # ideal speaking rate range for interviews
    "wpm_max": 160,
    "single_fillers": {
        "um", "umm", "ummm", "ummp", "uh", "uhh", "ah", "er", "erm",
        "em", "emm", "ehm", "eh", "hmm", "hm", "mm", "mmm",
    },
    "manglish_fillers": {
        "lah", "la", "leh", "lor", "mah", "kan", "wei", "weh", "bro", "sis", "ya",
    },
    "phrase_fillers": [("you", "know"), ("i", "mean"), ("sort", "of"), ("kind", "of")],
    "soft_fillers": {"basically", "actually", "literally"},   # counted separately
}


# ---------------------------------------------------------------------------
# MODULE 2 - SPEECH TO TEXT AND DATA PROCESSING
# ---------------------------------------------------------------------------
def preprocess_audio(in_path: str) -> str:
    """Convert any audio file (wav, m4a, mp3, webm...) to 16 kHz mono WAV.
    Strips sub-80Hz fan/desk rumble via highpass without altering dB dynamics
    (preserving accurate silence vs. speech thresholds in detect_pauses_audio)."""
    import glob
    import shutil
    import subprocess

    fd, out_path = tempfile.mkstemp(suffix="_16k.wav")
    os.close(fd)

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        winget_pattern = os.path.expandvars(
            r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe"
        )
        matches = glob.glob(winget_pattern)
        if matches:
            ffmpeg = matches[0]
    if ffmpeg:
        try:
            result = subprocess.run(
                [
                    ffmpeg, "-loglevel", "error", "-y", "-i", in_path,
                    "-af", "highpass=f=80",
                    "-ar", str(CONFIG["sample_rate"]), "-ac", "1", out_path,
                ],
                capture_output=True, text=True, timeout=30,
            )
        except subprocess.TimeoutExpired as e:
            Path(out_path).unlink(missing_ok=True)
            raise RuntimeError("Audio conversion timed out. Please try a shorter or valid audio recording.") from e
        if result.returncode != 0:
            Path(out_path).unlink(missing_ok=True)
            raise RuntimeError("ffmpeg could not read the audio file. "
                               "The file may be damaged or not an audio recording.")
        return out_path

    # Fallback when ffmpeg is not installed: works for plain .wav files only.
    import librosa
    import soundfile as sf
    try:
        audio, sr = librosa.load(in_path, sr=CONFIG["sample_rate"], mono=True)
    except Exception as e:
        Path(out_path).unlink(missing_ok=True)
        raise RuntimeError(
            "Cannot read this audio file. Install ffmpeg (needed for .webm / .m4a / .mp3), "
            "or use a .wav file."
        ) from e
    sf.write(out_path, audio, sr)
    return out_path


def _load_mono_rms(wav_path: str):
    """Read a 16 kHz WAV as mono float32 and compute frame RMS once."""
    import librosa
    import numpy as np
    import soundfile as sf

    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    rms = (
        librosa.feature.rms(y=audio, frame_length=1024, hop_length=256)[0]
        if len(audio) > 0
        else np.array([], dtype=np.float32)
    )
    return audio, sr, rms


def prepare_audio_for_whisper(wav_path: str, precomputed=None) -> str:
    """Boost quiet/distant microphone recordings to a clean target speech level for Whisper,
    leaving dead silence and already-loud close-mic clips untouched.
    Kept separate from preprocess_audio so detect_pauses_audio runs on the un-boosted WAV."""
    import numpy as np
    import soundfile as sf

    audio, sr, rms = precomputed if precomputed is not None else _load_mono_rms(wav_path)
    if len(audio) == 0:
        return wav_path

    rms_p95 = float(np.percentile(rms, 95)) if len(rms) > 0 else float(np.sqrt(np.mean(audio ** 2)))

    # Leave dead silence and already-loud close-mic audio untouched.
    if rms_p95 < 0.0015 or rms_p95 >= 0.12:
        return wav_path

    gain = min(0.15 / rms_p95, 15.0)
    boosted = audio * gain

    # Soft-clip limiter above knee so transient desk taps don't hard-clip or block speech gain.
    knee = 0.85
    ceiling = 0.96
    headroom = ceiling - knee
    abs_b = np.abs(boosted)
    over = abs_b > knee
    if np.any(over):
        boosted = boosted.copy()
        boosted[over] = np.sign(boosted[over]) * (
            knee + headroom * np.tanh((abs_b[over] - knee) / headroom)
        )

    fd, norm_path = tempfile.mkstemp(suffix="_norm.wav")
    os.close(fd)
    sf.write(norm_path, boosted.astype(np.float32), sr)
    return norm_path


_model_cache = {}
_active_device = "cpu"


def get_model_display_name() -> str:
    size = _resolve_model_size(None)
    if str(LOCAL_MALAYSIAN_MODEL) == size:
        return "malaysian-whisper-small-v3"
    return Path(size).name if Path(size).exists() else size


def get_active_device() -> str:
    return _active_device


def _resolve_model_size(model_size: str = None) -> str:
    if model_size:
        return model_size
    if CONFIG["model_size"] == "small" and (LOCAL_MALAYSIAN_MODEL / "model.bin").exists():
        return str(LOCAL_MALAYSIAN_MODEL)
    return CONFIG["model_size"]


def _get_model(model_size: str = None, force_cpu: bool = False):
    """Load a Whisper model once and reuse it (CPU int8 by default; set WHISPER_DEVICE=cuda to opt into GPU)."""
    global _active_device
    from faster_whisper import WhisperModel
    import ctranslate2

    size = _resolve_model_size(model_size)
    pref = "cpu" if force_cpu else os.getenv("WHISPER_DEVICE", "cpu").lower()

    use_cuda = pref == "cuda" and ctranslate2.get_cuda_device_count() > 0
    if use_cuda:
        key = (size, "cuda")
        if key not in _model_cache:
            try:
                _model_cache[key] = WhisperModel(size, device="cuda", compute_type="int8_float16")
            except Exception:
                if pref == "cuda":
                    raise
                use_cuda = False
        if use_cuda:
            _active_device = "cuda"
            return _model_cache[key], "cuda"

    key = (size, "cpu")
    if key not in _model_cache:
        _model_cache[key] = WhisperModel(size, device="cpu", compute_type="int8")
    _active_device = "cpu"
    return _model_cache[key], "cpu"


_USE_DEFAULT = object()


def transcribe(wav_path: str, model_size: str = None, initial_prompt=_USE_DEFAULT,
               hotwords=_USE_DEFAULT, language=_USE_DEFAULT, **options) -> dict:
    """Run Whisper and return word-level timestamps plus raw/clean text.
    Pass language='auto' (or None) for mixed BM+English code-switching."""
    if initial_prompt is _USE_DEFAULT:
        initial_prompt = CONFIG["initial_prompt"]
    if hotwords is _USE_DEFAULT:
        hotwords = CONFIG["hotwords"]
    if language is _USE_DEFAULT:
        language = CONFIG["language"]
    if language == "auto":
        language = None

    settings = {"word_timestamps": True}
    if language:
        settings["language"] = language
    settings.update(CONFIG["whisper_options"])
    settings.update(options)
    if initial_prompt:
        settings["initial_prompt"] = initial_prompt
    if hotwords:
        settings["hotwords"] = hotwords

    model, device = _get_model(model_size)

    def _run(whisper_model, run_settings):
        segments, info = whisper_model.transcribe(wav_path, **run_settings)
        words = []
        for seg in segments:
            if not seg.words:
                continue
            for w in seg.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 2),
                    "end": round(w.end, 2),
                })
        return words, info.duration

    active_model = model
    try:
        words, duration = _run(active_model, settings)
    except Exception:
        # Runtime CUDA DLL failures (e.g. missing cublas64_12.dll on Windows) happen on first transcribe.
        if device == "cuda":
            _model_cache.pop((_resolve_model_size(model_size), "cuda"), None)
            active_model, _ = _get_model(model_size, force_cpu=True)
            words, duration = _run(active_model, settings)
        else:
            raise

    if not words and duration >= 0.5 and settings.get("vad_filter"):
        words, duration = _run(active_model, {**settings, "vad_filter": False})

    return build_transcript(words, duration=duration)


def _normalise(token: str) -> str:
    """Lowercase and strip punctuation so 'Um,' becomes 'um'."""
    return re.sub(r"[^a-z']", "", token.lower())


def build_transcript(words: list, duration: float = None) -> dict:
    """Create the structured output: words + raw text + clean text."""
    stripped_fillers = CONFIG["single_fillers"] | CONFIG["manglish_fillers"]
    raw_text = " ".join(w["word"] for w in words)
    clean_words = [w["word"] for w in words if _normalise(w["word"]) not in stripped_fillers]
    clean_text = " ".join(clean_words)
    if duration is None and words:
        duration = words[-1]["end"]
    return {
        "duration_sec": round(duration or 0, 2),
        "words": words,
        "raw_text": raw_text,      # keeps "um", "ah", "lah" -> used by Module 5
        "clean_text": clean_text,  # fillers removed -> send to Module 3
    }


# ---------------------------------------------------------------------------
# MODULE 5 - SPEECH ANALYSIS
# ---------------------------------------------------------------------------
def detect_fillers(words: list) -> dict:
    """Count filler words. Handles English fillers, Manglish particles, 'like', and two-word fillers."""
    counts = {}
    manglish_breakdown = {}
    positions = []   # index of each filler word
    n = len(words)
    skip_next = False

    def add(label, idx, is_manglish=False):
        counts[label] = counts.get(label, 0) + 1
        if is_manglish:
            manglish_breakdown[label] = manglish_breakdown.get(label, 0) + 1
        positions.append(idx)

    for i, w in enumerate(words):
        if skip_next:
            skip_next = False
            continue
        tok = _normalise(w["word"])

        # 1) simple fillers: um, uh, ah ...
        if tok in CONFIG["single_fillers"]:
            add(tok, i)
            continue

        # 2) Manglish / Malaysian informal particles: lah, leh, lor, kan ...
        if tok in CONFIG["manglish_fillers"]:
            add(tok, i, is_manglish=True)
            continue

        # 3) two-word fillers: you know, i mean ...
        if i + 1 < n:
            nxt = _normalise(words[i + 1]["word"])
            if (tok, nxt) in CONFIG["phrase_fillers"]:
                add(f"{tok} {nxt}", i)
                skip_next = True
                continue

        # 4) "like": only a filler when it is surrounded by pauses or commas
        if tok == "like":
            prev_comma = i > 0 and words[i - 1]["word"].endswith(",")
            self_comma = w["word"].endswith(",")
            gap_before = (w["start"] - words[i - 1]["end"]) if i > 0 else 0
            gap_after = (words[i + 1]["start"] - w["end"]) if i + 1 < n else 0
            if prev_comma or self_comma or gap_before > 0.3 or gap_after > 0.3:
                add("like", i)
            continue

        # 5) soft fillers (reported separately, not counted as hard fillers)
        if tok in CONFIG["soft_fillers"]:
            counts[tok] = counts.get(tok, 0) + 1

    hard_total = sum(v for k, v in counts.items() if k not in CONFIG["soft_fillers"])
    return {
        "total": hard_total,
        "breakdown": counts,
        "manglish_total": sum(manglish_breakdown.values()),
        "manglish_breakdown": manglish_breakdown,
    }


def detect_pauses(words: list) -> dict:
    """Find gaps between words and flag the long ones."""
    long_pauses = []
    natural = 0
    for i in range(len(words) - 1):
        gap = words[i + 1]["start"] - words[i]["end"]
        if gap >= CONFIG["long_pause_sec"]:
            long_pauses.append({
                "after_word": words[i]["word"],
                "at_sec": round(words[i]["end"], 2),
                "length_sec": round(gap, 2),
            })
        elif gap >= CONFIG["natural_pause_sec"]:
            natural += 1
    return {
        "long_pause_count": len(long_pauses),
        "longest_pause_sec": max((p["length_sec"] for p in long_pauses), default=0),
        "total_long_pause_sec": round(sum(p["length_sec"] for p in long_pauses), 2),
        "natural_pause_count": natural,
        "long_pauses": long_pauses,
    }


def detect_pauses_audio(wav_path: str, words: list = None, precomputed=None) -> dict:
    """
    Find long pauses directly from the audio signal (silence detection).
    This does not depend on Whisper timestamps, so it is more reliable.
    """
    import numpy as np
    import librosa

    sr = CONFIG["sample_rate"]
    hop = 256                                   # 16 ms per frame at 16 kHz
    if precomputed is not None:
        audio, pre_sr, rms = precomputed
        if pre_sr != sr:
            audio, _ = librosa.load(wav_path, sr=sr, mono=True)
            rms = librosa.feature.rms(y=audio, frame_length=1024, hop_length=hop)[0]
    else:
        audio, _ = librosa.load(wav_path, sr=sr, mono=True)
        rms = (
            librosa.feature.rms(y=audio, frame_length=1024, hop_length=hop)[0]
            if len(audio) >= sr
            else np.array([], dtype=np.float32)
        )
    if len(audio) < sr:                         # shorter than 1 second
        return detect_pauses(words or [])
    db = 20 * np.log10(np.maximum(rms, 1e-8))
    noise_db = np.percentile(db, 10)
    speech_db = np.percentile(db, 95)
    threshold = max(noise_db + 10, speech_db - 35)
    voiced = db > threshold

    # Ignore very short sound blips (clicks, taps). Anything under 0.1 s is not speech.
    min_frames = int(0.1 * sr / hop)
    runs, i = [], 0
    while i < len(voiced):
        if voiced[i]:
            j = i
            while j < len(voiced) and voiced[j]:
                j += 1
            if j - i >= min_frames:
                runs.append((i, j))
            i = j
        else:
            i += 1

    frame_sec = hop / sr
    long_pauses, natural = [], 0
    for k in range(len(runs) - 1):
        gap_start = runs[k][1] * frame_sec
        gap = (runs[k + 1][0] - runs[k][1]) * frame_sec
        if gap >= CONFIG["long_pause_sec"]:
            after_word = ""
            if words:
                before = [w for w in words if w["end"] <= gap_start + 0.3]
                after_word = before[-1]["word"] if before else ""
            long_pauses.append({
                "after_word": after_word,
                "at_sec": round(float(gap_start), 2),
                "length_sec": round(float(gap), 2),
            })
        elif gap >= CONFIG["natural_pause_sec"]:
            natural += 1

    return {
        "long_pause_count": len(long_pauses),
        "longest_pause_sec": max((p["length_sec"] for p in long_pauses), default=0),
        "total_long_pause_sec": round(sum(p["length_sec"] for p in long_pauses), 2),
        "natural_pause_count": natural,
        "long_pauses": long_pauses,
    }


def speaking_rate(words: list) -> float:
    """Words per minute, using the time from first to last word."""
    if len(words) < 2:
        return 0.0
    excluded = CONFIG["single_fillers"] | CONFIG["manglish_fillers"]
    minutes = (words[-1]["end"] - words[0]["start"]) / 60
    spoken = [w for w in words if _normalise(w["word"]) not in excluded]
    return round(len(spoken) / minutes, 1) if minutes > 0 else 0.0


def fluency_score(filler_rate: float, long_pauses: int, wpm: float) -> dict:
    """Combine everything into one 0-100 score (simple, explainable formula)."""
    filler_penalty = min(40, filler_rate * 4)     # 10 fillers per 100 words = -40
    pause_penalty = min(30, long_pauses * 6)      # each long pause = -6
    if CONFIG["wpm_min"] <= wpm <= CONFIG["wpm_max"]:
        wpm_penalty = 0
    else:
        distance = min(abs(wpm - CONFIG["wpm_min"]), abs(wpm - CONFIG["wpm_max"]))
        wpm_penalty = min(30, distance * 0.5)
    score = max(0, round(100 - filler_penalty - pause_penalty - wpm_penalty))
    return {
        "score": score,
        "penalties": {
            "filler": round(filler_penalty, 1),
            "pause": round(pause_penalty, 1),
            "speaking_rate": round(wpm_penalty, 1),
        },
    }


def analyze_speech(transcript: dict, audio_pauses: dict = None) -> dict:
    """Module 5 entry point. Takes the Module 2 output and returns metrics."""
    words = transcript["words"]
    total_words = max(len(words), 1)

    fillers = detect_fillers(words)
    pauses = audio_pauses if audio_pauses else detect_pauses(words)
    wpm = speaking_rate(words)
    filler_rate = round(fillers["total"] / total_words * 100, 1)
    fluency = fluency_score(filler_rate, pauses["long_pause_count"], wpm)

    return {
        "filler_count": fillers["total"],
        "filler_rate_per_100_words": filler_rate,
        "filler_breakdown": fillers["breakdown"],
        "manglish_filler_count": fillers["manglish_total"],
        "manglish_breakdown": fillers["manglish_breakdown"],
        "long_pause_count": pauses["long_pause_count"],
        "longest_pause_sec": pauses["longest_pause_sec"],
        "total_long_pause_sec": pauses["total_long_pause_sec"],
        "long_pauses": pauses["long_pauses"],
        "wpm": wpm,
        "wpm_status": ("too slow" if wpm < CONFIG["wpm_min"]
                       else "too fast" if wpm > CONFIG["wpm_max"] else "good"),
        "fluency_score": fluency["score"],
        "fluency_penalties": fluency["penalties"],
    }


# ---------------------------------------------------------------------------
# MAIN ENTRY POINT (this is the function the group will call)
# ---------------------------------------------------------------------------
def analyze_audio(audio_path: str, language=_USE_DEFAULT) -> dict:
    """
    Full pipeline: audio file -> transcript (Module 2) -> speech metrics (Module 5).
    """
    wav = preprocess_audio(audio_path)
    whisper_wav = wav
    try:
        precomputed = _load_mono_rms(wav)
        whisper_wav = prepare_audio_for_whisper(wav, precomputed=precomputed)
        transcript = transcribe(whisper_wav, language=language)
        audio_pauses = detect_pauses_audio(wav, transcript["words"], precomputed=precomputed)
        analysis = analyze_speech(transcript, audio_pauses)
    finally:
        for tmp in {wav, whisper_wav}:
            try:
                Path(tmp).unlink()          # remove temporary 16 kHz copies
            except OSError:
                pass
    return {"transcript": transcript, "speech_analysis": analysis}


# ---------------------------------------------------------------------------
# TEST WITHOUT AUDIO (checks Module 5 logic using fake word timestamps)
# ---------------------------------------------------------------------------
def _demo_without_audio():
    fake = [
        ("So", 0.0, 0.3), ("um,", 0.5, 0.8), ("actually", 0.8, 1.1), ("lah,", 1.1, 1.3),
        ("I", 1.3, 1.4), ("led", 1.4, 1.6), ("a", 1.6, 1.7), ("team", 1.7, 2.0),
        ("and", 4.4, 4.6),   # 2.4s pause before "and"
        ("it", 4.6, 4.7), ("was,", 4.7, 5.0), ("like,", 5.1, 5.4),
        ("really", 5.4, 5.8), ("hard", 5.8, 6.1), ("you", 6.2, 6.3), ("know,", 6.3, 6.5),
        ("kan", 6.5, 6.8), ("but", 6.8, 7.0), ("I", 7.0, 7.1), ("like", 7.1, 7.3),
        ("teamwork", 7.3, 7.9), ("lah.", 7.9, 8.2),
    ]
    words = [{"word": w, "start": s, "end": e} for w, s, e in fake]
    transcript = build_transcript(words)
    print(json.dumps({
        "clean_text": transcript["clean_text"],
        "speech_analysis": analyze_speech(transcript),
    }, indent=2))


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(json.dumps(analyze_audio(sys.argv[1]), indent=2))
    else:
        _demo_without_audio()
