"""
AI Mock Interview Coach - Module 2 (Speech-to-Text) + Module 5 (Speech Analysis)
Owner: Alia

HOW TO USE (for the integrator):
    from speech_module import analyze_audio
    result = analyze_audio("answer.wav")   # returns a Python dict (JSON-ready)

INSTALL (Google Colab):
    !pip install faster-whisper librosa soundfile
    !apt-get install -y ffmpeg

The Whisper model is PRE-TRAINED. No training is needed. It is downloaded
once on the first run and then reused.
"""

import json
import re
import tempfile
from pathlib import Path

# ---------------------------------------------------------------------------
# SETTINGS (tune these and justify them in the report)
# ---------------------------------------------------------------------------
# Trick: this text nudges Whisper to KEEP "um" and "uh" instead of deleting them.
# Chosen with compare_configs.py (setting G): on 2 recordings with fillers recall went
# from 29% to 71% with precision 100%, and a clean recording gave 0 false fillers.
FILLER_PROMPT = ("Umm, so, uh, I was, like, thinking... you know, um, it is, uh, hard to say. "
                 "Hmm, okay, so, umm, let me, uh, explain.")
FILLER_HOTWORDS = "Umm, uh, hmm, like, you know"

CONFIG = {
    "model_size": "small.en",         # tiny.en / base.en / small.en (bigger = slower, more accurate)
    # --- Whisper decoding settings (use compare_configs.py to choose the best ones) ---
    "initial_prompt": FILLER_PROMPT,  # None = no prompt. NOTE: only reaches the FIRST 30 s of audio.
    "hotwords": FILLER_HOTWORDS,      # text added to EVERY 30 s window, e.g. "Umm, uh, like, you know"
    "whisper_options": {"condition_on_previous_text": True},   # extra faster-whisper options
    "sample_rate": 16000,            # Hz, the format Whisper prefers
    "long_pause_sec": 2.0,           # gap above this = long pause
    "natural_pause_sec": 0.5,        # gap below this = normal speech
    "wpm_min": 120,                  # ideal speaking rate range for interviews
    "wpm_max": 160,
    "single_fillers": {"um", "umm", "ummm", "ummp", "uh", "uhh", "ah", "er", "erm",
                       "em", "emm", "ehm", "eh", "hmm", "hm", "mm", "mmm"},
    "phrase_fillers": [("you", "know"), ("i", "mean"), ("sort", "of"), ("kind", "of")],
    "soft_fillers": {"basically", "actually", "literally"},   # counted separately
}


# ---------------------------------------------------------------------------
# MODULE 2 - SPEECH TO TEXT AND DATA PROCESSING
# ---------------------------------------------------------------------------
def preprocess_audio(in_path: str) -> str:
    """Convert any audio file (wav, m4a, mp3, webm...) to 16 kHz mono WAV.
    Returns the new file path.

    ffmpeg does the conversion because librosa alone cannot open .webm or .m4a.
    A unique temp file name is used, so two requests at the same time do not clash."""
    import shutil
    import subprocess

    fd, out_path = tempfile.mkstemp(suffix="_16k.wav")
    import os
    os.close(fd)

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        result = subprocess.run(
            [ffmpeg, "-loglevel", "error", "-y", "-i", in_path,
             "-ar", str(CONFIG["sample_rate"]), "-ac", "1", out_path],
            capture_output=True, text=True,
        )
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


_model_cache = {}


def _get_model(model_size: str = None):
    """Load a Whisper model once and reuse it. model_size can also be a Hugging Face
    model name, for example "nyrahealth/faster_CrisperWhisper"."""
    size = model_size or CONFIG["model_size"]
    if size not in _model_cache:
        from faster_whisper import WhisperModel
        _model_cache[size] = WhisperModel(size, device="cpu", compute_type="int8")
    return _model_cache[size]


_USE_DEFAULT = object()


def transcribe(wav_path: str, model_size: str = None, initial_prompt=_USE_DEFAULT,
               hotwords=_USE_DEFAULT, **options) -> dict:
    """Run Whisper and return word-level timestamps plus raw/clean text.

    With no extra arguments it uses the settings in CONFIG. The extra arguments exist
    so compare_configs.py can test other settings on the same recording.
    Pass initial_prompt=None to switch the prompt off. Other keyword arguments go
    straight to faster-whisper (for example beam_size=1)."""
    model = _get_model(model_size)
    if initial_prompt is _USE_DEFAULT:
        initial_prompt = CONFIG["initial_prompt"]
    if hotwords is _USE_DEFAULT:
        hotwords = CONFIG["hotwords"]

    settings = {"language": "en", "word_timestamps": True}
    settings.update(CONFIG["whisper_options"])
    settings.update(options)
    if initial_prompt:
        settings["initial_prompt"] = initial_prompt
    if hotwords:
        settings["hotwords"] = hotwords

    segments, info = model.transcribe(wav_path, **settings)

    words = []
    for seg in segments:
        for w in seg.words:
            words.append({
                "word": w.word.strip(),
                "start": round(w.start, 2),
                "end": round(w.end, 2),
            })

    return build_transcript(words, duration=info.duration)


def _normalise(token: str) -> str:
    """Lowercase and strip punctuation so 'Um,' becomes 'um'."""
    return re.sub(r"[^a-z']", "", token.lower())


def build_transcript(words: list, duration: float = None) -> dict:
    """Create the structured output: words + raw text + clean text."""
    fillers = CONFIG["single_fillers"]
    raw_text = " ".join(w["word"] for w in words)
    clean_words = [w["word"] for w in words if _normalise(w["word"]) not in fillers]
    clean_text = " ".join(clean_words)
    if duration is None and words:
        duration = words[-1]["end"]
    return {
        "duration_sec": round(duration or 0, 2),
        "words": words,
        "raw_text": raw_text,      # keeps "um", "ah" -> used by Module 5
        "clean_text": clean_text,  # fillers removed -> send to Module 3
    }


# ---------------------------------------------------------------------------
# MODULE 5 - SPEECH ANALYSIS
# ---------------------------------------------------------------------------
def detect_fillers(words: list) -> dict:
    """Count filler words. Handles 'like' and two-word fillers."""
    counts = {}
    positions = []   # index of each filler word
    n = len(words)
    skip_next = False

    def add(label, idx):
        counts[label] = counts.get(label, 0) + 1
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

        # 2) two-word fillers: you know, i mean ...
        if i + 1 < n:
            nxt = _normalise(words[i + 1]["word"])
            if (tok, nxt) in CONFIG["phrase_fillers"]:
                add(f"{tok} {nxt}", i)
                skip_next = True
                continue

        # 3) "like": only a filler when it is surrounded by pauses or commas
        if tok == "like":
            prev_comma = i > 0 and words[i - 1]["word"].endswith(",")
            self_comma = w["word"].endswith(",")
            gap_before = (w["start"] - words[i - 1]["end"]) if i > 0 else 0
            gap_after = (words[i + 1]["start"] - w["end"]) if i + 1 < n else 0
            if prev_comma or self_comma or gap_before > 0.3 or gap_after > 0.3:
                add("like", i)
            continue

        # 4) soft fillers (reported separately, not counted as hard fillers)
        if tok in CONFIG["soft_fillers"]:
            counts[tok] = counts.get(tok, 0) + 1

    hard_total = sum(v for k, v in counts.items() if k not in CONFIG["soft_fillers"])
    return {"total": hard_total, "breakdown": counts}


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


def detect_pauses_audio(wav_path: str, words: list = None) -> dict:
    """
    Find long pauses directly from the audio signal (silence detection).
    This does not depend on Whisper timestamps, so it is more reliable.

    The silence threshold adapts to each recording:
      - noise floor  = loudness of the quietest 10% of the recording
      - speech level = loudness of the loudest 5% of the recording
      - threshold    = the higher of (noise floor + 10 dB) and (speech level - 35 dB)
    A frame quieter than the threshold counts as silence.
    """
    import numpy as np
    import librosa

    sr = CONFIG["sample_rate"]
    hop = 256                                   # 16 ms per frame at 16 kHz
    audio, _ = librosa.load(wav_path, sr=sr, mono=True)
    if len(audio) < sr:                         # shorter than 1 second
        return detect_pauses(words or [])

    rms = librosa.feature.rms(y=audio, frame_length=1024, hop_length=hop)[0]
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
    # Only look at gaps BETWEEN speech parts. Silence at the very start or end is ignored.
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
    minutes = (words[-1]["end"] - words[0]["start"]) / 60
    spoken = [w for w in words if _normalise(w["word"]) not in CONFIG["single_fillers"]]
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
    """Module 5 entry point. Takes the Module 2 output and returns metrics.
    If audio_pauses is given, pauses come from the audio signal (more reliable).
    Otherwise they are estimated from the word timestamps."""
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
def analyze_audio(audio_path: str) -> dict:
    """
    Full pipeline: audio file -> transcript (Module 2) -> speech metrics (Module 5).

    Returns a dict with:
        "transcript": {duration_sec, words, raw_text, clean_text}
        "speech_analysis": {filler_count, wpm, fluency_score, ...}
    """
    wav = preprocess_audio(audio_path)
    try:
        transcript = transcribe(wav)
        audio_pauses = detect_pauses_audio(wav, transcript["words"])
        analysis = analyze_speech(transcript, audio_pauses)
    finally:
        try:
            Path(wav).unlink()          # remove the temporary 16 kHz copy
        except OSError:
            pass
    return {"transcript": transcript, "speech_analysis": analysis}


# ---------------------------------------------------------------------------
# TEST WITHOUT AUDIO (checks Module 5 logic using fake word timestamps)
# ---------------------------------------------------------------------------
def _demo_without_audio():
    fake = [
        ("So", 0.0, 0.3), ("um,", 0.5, 0.8), ("I", 1.0, 1.1), ("led", 1.1, 1.3),
        ("a", 1.3, 1.4), ("team", 1.4, 1.8), ("and", 4.2, 4.4),   # 2.4s pause before "and"
        ("it", 4.4, 4.5), ("was,", 4.5, 4.8), ("like,", 4.9, 5.2),
        ("really", 5.2, 5.6), ("hard", 5.6, 6.0), ("you", 6.1, 6.2), ("know", 6.2, 6.4),
        ("but", 6.4, 6.6), ("I", 6.6, 6.7), ("like", 6.7, 6.9), ("teamwork", 6.9, 7.6),
    ]
    words = [{"word": w, "start": s, "end": e} for w, s, e in fake]
    transcript = build_transcript(words)
    print(json.dumps(analyze_speech(transcript), indent=2))


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(json.dumps(analyze_audio(sys.argv[1]), indent=2))
    else:
        _demo_without_audio()
