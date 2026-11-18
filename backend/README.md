# Vokal.AI speech backend (Module 2 and Module 5)

Python (FastAPI) service. It receives one recorded answer and returns:
- the transcript with word timestamps (Module 2)
- filler words, long pauses, speaking rate and a fluency score (Module 5)

## Run it

You need Python 3.10 or 3.11 and **ffmpeg** on the PATH.
On Windows: `winget install ffmpeg`, then open a new terminal.

    cd backend
    python -m venv venv
    venv\Scripts\activate            (Mac/Linux: source venv/bin/activate)
    pip install -r requirements.txt
    uvicorn main:app --port 8000

The first start downloads the Whisper `small.en` model (several hundred MB).
Later starts are faster. Check it works: open http://localhost:8000/health

Frontend: add this line to `frontend/.env.local`, then run `npm run dev`.

    FASTAPI_BACKEND_URL=http://localhost:8000

## How the pieces connect

    Practice page (Start / Stop)
      -> hooks/useAudioRecorder.ts        records the answer in the browser (webm)
      -> lib/speechApi.ts                 POST /api/speech
      -> app/api/speech/route.ts          Next.js proxy, forwards to FastAPI
      -> backend/main.py                  POST /analyze-speech
      -> speech_module.py                 ffmpeg -> Whisper -> metrics

## Reply format

    {
      "ui": {                       // same field names as PracticeSession in lib/mockSessions.ts
        "wpm": 128.9, "fillersPerMin": 1.7, "fillerCount": 2,
        "fillers": ["um ×1", "like ×1"], "longPauses": 1,
        "fluencyScore": 87, "durationSec": 61.2,
        "transcript": "clean transcript, filler words removed"
      },
      "transcript": { "duration_sec", "words": [{word, start, end}], "raw_text", "clean_text" },
      "speech_analysis": { "filler_count", "filler_breakdown", "long_pauses", "wpm", "wpm_status",
                           "fluency_score", "fluency_penalties", ... }
    }

Errors use HTTP 422 with `{"detail": "..."}` (empty file, unreadable audio, no speech).

## For other modules

- Module 3 (STAR / NLP): use `transcript.clean_text` (or `ui.transcript`).
- Module 6 (Reports): save `ui` with the session. Its fields match `PracticeSession`.

## Known limits (read before the demo)

- The answer is analysed **after the user presses Stop**. It is not live word by word.
- Whisper often removes "um" and "uh". We tuned the prompt and hotwords (see `CONFIG` in
  `speech_module.py`). On 2 recordings with 7 planned fillers, recall went from 29% to 71%
  with precision 100%, and a clean recording gave 0 false fillers.
  "uh" is still never detected (0 of 2), so filler counts can be a little low and fluency
  scores a little high.
- `condition_on_previous_text` is on. Very long or very quiet answers (over about 1.5 minutes)
  could make Whisper repeat a sentence. Check the transcript if a result looks odd.
- English only (`small.en`). Malay words are not transcribed.
- Eye contact and posture values on the Practice page are still mock (Module 4).
- Results are not saved yet (`/api/sessions` is still a TODO).
