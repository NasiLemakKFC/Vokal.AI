# Vokal.AI (InterViewAI)

A privacy-first, multimodal AI mock interview coach for practicing behavioral (**STAR** — Situation, Task, Action, Result) interviews. It combines **resume & job description alignment**, **tailored question generation**, **real-time browser computer vision** (eye contact & posture), **Malaysian-tuned speech transcription & fluency analysis**, and **bilingual (EN + BM) STAR & keyword feedback**.

---

## How It Works

### 1. Pre-Session Setup & Resume Tailoring (`/interview`)
- Expand the **Interview setup & resume check** card at the top of `/interview`.
- Pick a mode (**Specific company**, **General job role**, or **General interview**), optionally paste a Job Description, and add your resume (**Upload PDF** or **Paste text**).
- PDF text is extracted in memory on the server via `unpdf` (`POST /api/interview/parse-resume`) — no resume file is saved to disk.
- Clicking **Analyze fit & generate questions** calls `POST /api/interview/prepare`, which runs your configured AI provider (**Groq**, **Gemini**, or **Ollama**) or falls back automatically to the built-in offline NLP generator:
  - Produces a **Resume & JD Tailoring Report** (`matchScore`, verdict, matched vs. missing skills, and actionable tips), deterministically grounded against your actual resume text to prevent JD-to-resume hallucinations.
  - Generates a balanced **STAR question set**: **Q1 (`Resume Deep-Dive`)** probing a real project/metric from your resume, **Q2 (`JD Gap`)** testing a missing skill from the job description, and **Q3+ (`Role Behavioral`)** anchored to role/company responsibilities.

### 2. Live Practice Room (`/interview`)
- **Client-Side Computer Vision (`@mediapipe/tasks-vision`)**: Runs 100% locally in your browser via WebGL/WASM (`FaceLandmarker` + `PoseLandmarker`). **No webcam video ever leaves the browser.**
  - **Eye Contact & Gaze**: Combines head orientation (yaw/pitch), face blendshapes (`eyeLook*`), and iris landmarks with blink filtering (`eyeBlink*`) so natural blinking does not hurt your score.
  - **Posture & Lean-In**: Auto-calibrates an upright baseline over the first 1.5 seconds and tracks shoulder tilt, slouching, and leaning too close to the camera.
  - **Live Cues**: Optional minimal wireframe overlay, camera-anchored visual nudges (`Look at camera`, `Eyes up`, `Sit upright`, `Level shoulders`, `Move back`) with green confirmation once fixed, repeating Web Audio chimes (best with earphones), and configurable nudge delay (`1.5s`, `3s`, `5s`).
- **Audio Capture & Live Transcript**: Record voice answers per question in the browser (`useAudioRecorder`), choose speech mode (**English (MY)** or **Mixed (BM+EN)**), or type/paste an answer directly in the transcript box for instant live STAR & keyword preview.

### 3. Post-Session Analysis & Reports (`/reports`)
- Clicking **Finish & analyze** runs a 1-by-1 evaluation modal across every answered question:
  1. **Speech-to-Text & Fluency** (`POST /api/speech` → FastAPI `POST /analyze-speech`): Preprocesses audio via `ffmpeg` (`16 kHz` mono + `highpass=f=80`), transcribes with `faster-whisper` (`mesolitica/malaysian-whisper-small-v3` `int8` when converted, else `small`), measures WPM, detects `librosa` silence pauses (`> 2.0s`), and counts English + Manglish fillers (`um`, `uh`, `like`, `you know`, `lah`, `leh`, `lor`, `kan`, etc.), stripping fillers into `clean_text`.
  2. **STAR & Keyword NLP** (`analyzeAnswer`): Classifies Situation/Task/Action/Result sentences, evaluates keyword coverage against the active question, job description, and role taxonomy (supporting English and Bahasa Melayu cues), and produces personalized tips.
  3. **Vision Snapshot Merge**: Combines eye contact %, posture %, and nudge counts from the webcam session.
- Results are saved to browser `localStorage` (`vokal-module3-completed-sessions-v1`) and can be inspected in the **Session STAR Review** modal or on **`/reports`** (including the saved **Resume & job description alignment** disclosure).

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      BROWSER (Next.js App Router)                    │
│                                                                      │
│  Setup Card ──► PDF (.pdf) ──► POST /api/interview/parse-resume      │
│             └─► Target/JD + Resume ──► POST /api/interview/prepare   │
│                                                                      │
│  Webcam (720p) ──► WebcamFeed + useVisionCoach                       │
│                    ├─ MediaPipe FaceLandmarker & PoseLandmarker      │
│                    └─ Wireframe Overlay + VisualNudge + Web Audio    │
│                       (100% client-side; zero video uploaded)        │
│                                                                      │
│  Mic Audio ──► useAudioRecorder ──► POST /api/speech                 │
│                                           │                          │
│  Module 3 NLP & localStorage ◄────────────┼───────────┘              │
└───────────────────────────────────────────┼──────────────────────────┘
                                            │ Audio Blob only
                                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                PYTHON SPEECH BACKEND (FastAPI :8000)                 │
│                                                                      │
│  POST /analyze-speech                                                │
│    ├─ ffmpeg (16 kHz mono WAV + highpass=f=80)                       │
│    ├─ faster-whisper (malaysian-whisper-small-v3 int8 / small)       │
│    ├─ librosa RMS silence-based pause detection (> 2.0s)             │
│    └─ WPM, EN + Manglish filler counts & fluency score               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React, Material Symbols
- **Resume & AI Orchestration**: `unpdf` (PDF parsing), native `fetch` adapters for Groq, Gemini API, and Ollama + rule-based offline fallback
- **Client-Side Vision**: `@mediapipe/tasks-vision` (`FaceLandmarker` + `PoseLandmarker`), Web Audio API
- **Speech Backend**: Python 3.10 / 3.11, FastAPI, Uvicorn, `faster-whisper` (CTranslate2), `librosa`, `soundfile`, `ffmpeg`
- **Storage**: Browser `localStorage` (active session persistence) + `mongodb` driver (`src/lib/mongodb.js` helper available)

---

## Prerequisites

- **Node.js** 20+ and **npm**
- **Python** 3.10 or 3.11
- **`ffmpeg`** available on `PATH` (Windows: `winget install Gyan.FFmpeg`, then open a new terminal)
- **Chrome** or **Edge** (for webcam/microphone `getUserMedia` and WebGL MediaPipe)

---

## Running Locally

### 1. Start the Speech Backend (`backend/`)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

# Optional (once, recommended for Malaysian English & Manglish):
# Converts mesolitica/malaysian-whisper-small-v3 -> CTranslate2 int8
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install transformers
python convert_malaysian_whisper.py

# Start FastAPI on port 8000
uvicorn main:app --port 8000
```

Verify it is running at `http://localhost:8000/health` (returns `status`, active `model`, and `device`).

> **Note:** The frontend works standalone for setup, resume tailoring, webcam vision coaching, and typed answers even if the speech backend is not running — you only need port `8000` when recording voice answers.

**Useful backend environment variables:**
- `WHISPER_MODEL` — override the model name or path (defaults to `backend/models/malaysian-whisper-small-v3-ct2` if present, otherwise `small`)
- `WHISPER_DEVICE` — set `cuda` to opt into GPU (defaults to CPU `int8`)
- `WHISPER_LANGUAGE` — default `en` (`auto` for mixed BM+EN)
- `PRELOAD_MODEL=0` — skip loading Whisper at server startup

---

### 2. Configure & Start the Frontend (`frontend/`)

Copy `frontend/.env.example` to `frontend/.env.local` (never commit `.env.local`):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
FASTAPI_BACKEND_URL=http://localhost:8000

# AI Provider for Resume Tailoring & Question Generation
# Options: auto | groq | gemini | ollama | offline
AI_PROVIDER=auto
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite

# Optional local Ollama (uncomment only if Ollama is installed and running)
# OLLAMA_BASE_URL=http://127.0.0.1:11434
# OLLAMA_MODEL=qwen2.5:3b
```

Install dependencies and start the Next.js dev server:

```powershell
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000/interview`** and grant camera/microphone permissions when prompted.

> **Important:** Restart `npm run dev` whenever you edit `frontend/.env.local`.

---

## AI Provider Options (`AI_PROVIDER`)

| Setting | Model Default | Notes |
|---|---|---|
| `auto` (default) | — | Tries **Groq** → **Gemini** → explicit **Ollama** (`OLLAMA_BASE_URL`/`OLLAMA_MODEL` set) → **Offline NLP** |
| `groq` | `openai/gpt-oss-20b` | Fast cloud inference, strict JSON Schema (`reasoning_effort: "low"`), zero local CPU/GPU load |
| `gemini` | `gemini-2.5-flash-lite` | Cloud fallback via `generativelanguage.googleapis.com` JSON mode |
| `ollama` | `qwen2.5:3b` | Fully offline local LLM via `http://127.0.0.1:11434/api/chat` |
| `offline` | `rule-based-nlp` | Instant keyword/taxonomy matching + curated role/resume templates; zero API key needed |

To avoid hitting rate limits or wasting tokens, inputs are compacted server-side (max `2,400` chars JD, `3,000` chars resume) and identical inputs are fingerprinted on the client unless you click **Regenerate questions** / **New angle**.

---

## Routes & API Endpoints

| Route / Endpoint | Purpose |
|---|---|
| `/` | Home dashboard — latest score deltas and recent sessions |
| `/interview` | Practice Room — setup card, webcam vision coach, audio recorder, and live Module 3 NLP |
| `/reports` | Session reports — overall/pillar scores, STAR breakdown, speech/vision telemetry, transcript, and resume fit summary |
| `POST /api/interview/parse-resume` | Extracts clean text from uploaded `.pdf` resumes (limit `5 MB`) |
| `POST /api/interview/prepare` | Checks resume vs. JD alignment and generates tailored STAR questions |
| `POST /api/speech` | Next.js proxy forwarding audio recordings to FastAPI `:8000/analyze-speech` |
| `GET http://localhost:8000/health` | Speech backend health, active Whisper model, and device |
| `POST http://localhost:8000/analyze-speech` | Whisper ASR + WPM, filler word, long-pause, and fluency analysis |

---

## Repository Structure

```text
.
├── README.md
├── AGENTS.md                        # Contributor & architecture notes
├── backend/
│   ├── main.py                      # FastAPI server (/health, POST /analyze-speech)
│   ├── speech_module.py             # Whisper ASR + fluency & filler detection
│   ├── convert_malaysian_whisper.py # Converts mesolitica/malaysian-whisper-small-v3 -> CTranslate2 int8
│   ├── requirements.txt             # Python dependencies
│   └── README.md                    # Speech backend reference
└── frontend/
    ├── next.config.ts               # Next.js config (serverExternalPackages: ["unpdf"], redirects)
    ├── package.json
    ├── .env.example
    └── src/
        ├── app/
        │   ├── (dashboard)/
        │   │   ├── page.tsx         # Home overview (/)
        │   │   ├── interview/       # Practice Room (/interview)
        │   │   └── reports/         # Session Reports (/reports)
        │   └── api/
        │       ├── speech/          # Proxy to FastAPI /analyze-speech
        │       └── interview/
        │           ├── parse-resume/# PDF text extraction (unpdf)
        │           └── prepare/     # Resume check + AI/offline question generation
        ├── components/interview/    # SessionSetupCard, QuestionPrompt, StarChecklist,
        │                            # CandidateVideoFeed, WebcamFeed, ControlDock,
        │                            # Module3Analysis, SessionAnalysisModal, VisualNudge
        ├── hooks/                   # useVisionCoach, useAudioRecorder, useMediaDevices, useFaceMesh
        └── lib/
            ├── interview/           # types.ts, llmProvider.ts, offlineGenerator.ts
            ├── nlp/                 # analyze.ts, star.ts, keywords.ts, taxonomy.ts, sessionStore.ts
            ├── vision/              # MediaPipeSetup.ts, visionCoach.ts, visionOverlay.ts, nudgeSound.ts
            ├── speechApi.ts         # Typed client for /api/speech
            └── mongodb.js           # MongoDB client singleton
```

---

## Tuning & Customization

- **Eye Contact & Posture Thresholds**: Edit `DEFAULT_VISION_CONFIG` in `frontend/src/lib/vision/visionCoach.ts` (tilt angle, slouch drop ratio, lean-in ratio, gaze sensitivity, blink threshold, nudge delay).
- **Whisper & Filler Rules**: Edit `CONFIG`, `FILLER_PROMPT`, and `FILLER_HOTWORDS` in `backend/speech_module.py` (ideal WPM band `120–160`, long pause threshold `2.0s`, VAD sensitivity, English/Manglish filler sets).
- **Skill Taxonomy & Synonyms**: Edit `frontend/src/lib/nlp/taxonomy.ts` and `frontend/src/lib/nlp/keywords.ts`.

---

## Troubleshooting & Practical Tips

- **`[browser] W... gl_context.cc / face_landmarker_graph.cc` in terminal**: Normal MediaPipe WebAssembly startup logs mirrored by Next.js — not errors.
- **Speech analysis returns `502`**: Start the Python backend (`uvicorn main:app --port 8000` inside `backend/`) and verify `FASTAPI_BACKEND_URL=http://localhost:8000` in `frontend/.env.local`.
- **PDF upload says no selectable text**: The PDF is likely a scanned image. Switch to the **Paste text** tab inside the setup card.
- **Audio chimes bleed into recordings**: Wear earphones when **Chime** is enabled so the browser chime isn't picked up by your microphone.
- **Laptop thermals**: Running local Whisper (`faster-whisper`) + webcam MediaPipe (and optionally local Ollama) concurrently is CPU-intensive; keep cooling active during extended sessions.
