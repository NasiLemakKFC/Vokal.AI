# Vokal.AI (InterViewAI) — Real-Time Multimodal AI Mock Interview Coach

**Vokal.AI (InterViewAI)** is a privacy-first, multimodal AI mock interview coach built for Malaysian university students and fresh graduates preparing for behavioral (**STAR-method**) job interviews.

> **Academic Context:** FTMK Workshop II (BITU 3973) — Universiti Teknikal Malaysia Melaka (UTeM)

---

## Core Modules & Team Ownership

| Module | Name | Owner | Status | Highlights |
|---|---|---|---|---|
| **Module 1** | Interview Question & Voice Response | **Amirul** | Integrated | Behavioral STAR question prompts, live session timer, browser microphone recording |
| **Module 2** | Speech-to-Text & Data Processing | **Alia** | Integrated | FastAPI + `faster-whisper` (`mesolitica/malaysian-whisper-small-v3` `int8`), `Manglish (EN)` & `Auto (BM+EN)` modes |
| **Module 3** | NLP & STAR Structure Analysis | **Syafiq** | Integrated | Client-side rule-based S/T/A/R sentence classifier, role & job-description keyword matching, coaching tips |
| **Module 4** | Eye Contact & Posture Analysis | **Nabil** | Integrated | Browser-side MediaPipe `FaceLandmarker` + `PoseLandmarker`, blendshape/iris gaze + blink filtering, wireframe overlay & visual/audio nudges |
| **Module 5** | Speech Fluency Analysis | **Alia** | Integrated | English + Manglish filler/slang detection (`um`, `uh`, `like`, `you know`, `lah`, `leh`, `lor`, `kan`), audio-signal pause detection, WPM & fluency score |
| **Module 6** | Feedback & Performance Report | **Amirul** | In Progress | Session overview & reports UI (`/`, `/reports`), `localStorage` persistence + MongoDB schema integration |

---

## Key Features

### 1. Client-Side Computer Vision Coaching (Module 4)
All video processing runs **100% locally in the browser** via WebGL/WASM (`@mediapipe/tasks-vision`) — **no webcam video is ever uploaded**.
- **Eye Contact & Gaze Tracking**: Combines head orientation (yaw/pitch) with MediaPipe face blendshapes (`eyeLook*`) and iris landmarks (`468`, `473`), plus blink filtering (`eyeBlink*`) so natural blinking does not penalize your score.
- **Posture & Lean-In Tracking**: Monitors side-to-side shoulder tilt, vertical slouching against a **1.5-second median auto-calibrated baseline**, and leaning too close to the webcam.
- **Minimal Wireframe Overlay (`Lines`)**: Draws clean eye contours, iris tracking rings, gaze vector, shoulder bar, spine axis, and a dashed upright target bracket over the mirrored `<canvas>`.
- **Camera-Anchored Visual & Audio Nudges**:
  - Top-center banners right below the webcam lens (`Look at camera`, `Eyes up`, `Sit upright`, `Level shoulders`, `Move back`) paired with a pulsing peripheral frame glow and camera-lens anchor dot.
  - **Sticky Hold + Green Confirmation**: Active nudges stay readable (`800ms` min hold) and morph into a green `Good eye contact` / `Great posture` confirmation once corrected.
  - **Repeating Earphone Chime (`Chime`)**: Synthesizes distinct Web Audio chimes that repeat until posture or gaze is corrected (best used with earphones so chimes do not bleed into the microphone).
  - **Configurable Grace Period (`Delay`)**: Switch between `1.5s` (Strict), `3s` (Balanced), and `5s` (Relaxed).

### 2. Malaysian-Tuned Speech & Fluency Pipeline (Modules 2 & 5)
- **Malaysian Whisper (`mesolitica/malaysian-whisper-small-v3`)**: Converted to CTranslate2 (`int8`) via `backend/convert_malaysian_whisper.py` for fast CPU inference (`~1.5s` load) and improved recognition of Malaysian English accents and code-switching.
- **Language Mode Toggle**: Switch between `Manglish (EN)` (English script with Malaysian particles) and `Auto (BM+EN)` (mixed Malay & English code-switching).
- **Audio Preprocessing & VAD**: Applies `ffmpeg` `highpass=f=80` rumble filtering (preserving silence-vs-speech dB dynamics) and Silero VAD filtering.
- **Malaysian Slang & Filler Detection**: Counts English fillers (`um`, `uh`, `like`, `you know`), soft fillers (`actually`, `basically`, `literally`), and Manglish particles (`lah`, `la`, `leh`, `lor`, `mah`, `kan`, `wei`, `bro`, `sis`), stripping them from `clean_text` before Module 3 NLP evaluation.

### 3. Live NLP & STAR Breakdown (Module 3)
- **Target Modes**: Evaluate answers against a **Specific company + Job Description**, a **General job role** (Software Engineer, Frontend, Backend, Data Analyst, AI/ML, UI/UX, QA, PM), or **General interview** skills.
- **Interactive Practice Panel**: Automatically receives Module 2 voice transcripts (and supports direct typing/pasting) to render live **S/T/A/R chips**, **keyword coverage %**, **sentence-by-sentence classification**, and **personalized coaching tips**.

---

## Architecture & Data Flow

```text
┌──────────────────────────────────────────────────────────┐
│                 BROWSER (Next.js App Router)             │
│                                                          │
│  Webcam (720p) ──► WebcamFeed + useVisionCoach           │
│                     ├─ MediaPipe FaceLandmarker (GPU/CPU)│
│                     ├─ MediaPipe PoseLandmarker (Lite)   │
│                     └─ Minimal Wireframe + VisualNudge   │
│                        (zero video leaves the browser)   │
│                                                          │
│  Mic Audio (WebM/M4A) ──► useAudioRecorder               │
│                             │                            │
│  Module 3 NLP ◄── clean_text┘   POST /api/speech         │
└─────────────────────────────────────────┬────────────────┘
                                          │ Audio Blob only
                                          ▼
┌──────────────────────────────────────────────────────────┐
│              PYTHON BACKEND (FastAPI + Whisper)          │
│                                                          │
│  POST /analyze-speech                                    │
│    ├─ ffmpeg (16 kHz mono WAV + highpass=f=80)           │
│    ├─ faster-whisper (malaysian-whisper-small-v3 int8)   │
│    ├─ librosa RMS silence-based long-pause detection     │
│    └─ Module 5 fillers (EN + Manglish), WPM & fluency    │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React, Material Symbols
- **Client-Side Vision AI**: `@mediapipe/tasks-vision` (`FaceLandmarker` + `PoseLandmarker`), Web Audio API
- **Speech Backend**: Python 3.10 / 3.11, FastAPI, Uvicorn, `faster-whisper` (CTranslate2), `librosa`, `soundfile`, `ffmpeg`
- **Database (Planned / Configured)**: MongoDB (`mongodb` official driver)

---

## Repository Structure

```text
WORKSHOP 2/
├── README.md
├── AGENTS.md                        # Project architecture & contributor guide
├── MILESTONE.md                     # Workshop II milestone tracker
├── backend/
│   ├── main.py                      # FastAPI server (/health, POST /analyze-speech)
│   ├── speech_module.py             # Module 2 (Whisper ASR) & Module 5 (speech analysis)
│   ├── convert_malaysian_whisper.py # Converts mesolitica/malaysian-whisper-small-v3 -> CTranslate2 int8
│   ├── requirements.txt             # Backend Python dependencies
│   └── README.md                    # Backend API & Whisper notes
└── frontend/
    ├── package.json
    └── src/
        ├── app/
        │   ├── api/speech/route.ts  # Next.js proxy forwarding audio to FastAPI
        │   └── (dashboard)/
        │       ├── page.tsx         # Home overview
        │       ├── interview/       # Practice Room (Modules 1–5 live)
        │       └── reports/         # Session Reports (Module 6)
        ├── components/interview/    # WebcamFeed, CandidateVideoFeed, VisualNudge, Module3Analysis, etc.
        ├── hooks/                   # useVisionCoach, useAudioRecorder, useMediaDevices, useFaceMesh
        └── lib/
            ├── speechApi.ts         # Typed client for /api/speech
            ├── nlp/                 # Module 3 STAR, keyword, taxonomy & sessionStore engine
            └── vision/              # MediaPipeSetup, visionCoach, visionOverlay, nudgeSound
```

---

## Getting Started (Local Setup)

### Prerequisites
- **Node.js** 20+ and **npm**
- **Python** 3.10 or 3.11 (official Windows Python build recommended for prebuilt wheels)
- **ffmpeg** installed on your `PATH` (Windows: `winget install Gyan.FFmpeg`)

### 1. Start the Speech Backend (Modules 2 & 5)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

# (Optional, recommended for Malaysian English & Manglish):
# Install CPU PyTorch + Transformers once, then convert Mesolitica's model:
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install transformers
python convert_malaysian_whisper.py

# Start FastAPI on port 8000
uvicorn main:app --port 8000
```

Verify the backend is healthy by opening `http://localhost:8000/health` (expected: `{"status": "ok", "model": "malaysian-whisper-small-v3", "device": "cpu"}`).

### 2. Start the Next.js Frontend

Create `frontend/.env.local` (never commit this file):

```env
FASTAPI_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Optional for Module 6 MongoDB persistence:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/
```

Then install dependencies and launch the dev server:

```powershell
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000/interview`** in Chrome or Edge and allow camera & microphone permissions.

---

## Privacy & Demo Tips
- **Zero Video Upload**: All MediaPipe inference stays inside browser memory.
- **Use Earphones for Audio Chimes**: Prevents the Module 4 chime from entering the microphone recording sent to Whisper.
- **Thermal Note**: During sustained local Whisper + MediaPipe testing on laptops, keep cooling active to maintain CPU thermals below 80°C.
