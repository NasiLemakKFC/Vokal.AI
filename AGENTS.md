# InterViewAI (Vokal.ai) — Project Intelligence Guide
> **For AI agents, new contributors, and collaborators.**  
> This document is the single source of truth for understanding the codebase, architecture, conventions, and remaining roadmap.

---

## 1. Project Overview

**InterViewAI (Vokal.ai)** is a real-time multimodal AI mock interview coach built for Malaysian university students preparing for behavioral (STAR-method) job interviews.

| Field | Value |
|---|---|
| **Full Name** | InterViewAI (Vokal.ai) — Real-Time Multimodal AI Mock Interview Coach |
| **Academic Context** | FTMK Workshop II (BITU 3973), Universiti Teknikal Malaysia Melaka (UTeM) |
| **Target Users** | FTMK graduating & internship (LI) students, Malaysian CS/IT job seekers |
| **Interview Style** | STAR (Situation, Task, Action, Result) behavioral methodology |
| **Key Differentiator** | All computer vision runs **100% client-side in the browser** (zero video upload); speech ASR is tuned for **Malaysian English & Manglish** |

---

## 2. Team & Module Ownership

| Module | Name | Owner | Implementation |
|---|---|---|---|
| **Module 1** | Interview Question & Voice Response | **Amirul** | `SessionSetupCard`, `QuestionPrompt` (TTS read-aloud, 15s prep timer, follow-up probes), `useInterviewPrep`, `/api/interview/prepare` (3/5/7Q + Internship/Fresh Grad/Junior), `/api/interview/parse-resume`, `useAudioRecorder` |
| **Module 2** | Speech-to-Text & Data Processing | **Alia** | `backend/main.py` + `backend/speech_module.py` (`malaysian-whisper-small-v3-ct2` via `faster-whisper`), `/api/speech` proxy, `useBackgroundTranscription` |
| **Module 3** | NLP & STAR Structure Analysis | **Syafiq** | `src/lib/nlp/*` (EN + BM/Manglish regex STAR + keyword taxonomy) + hybrid LLM semantic STAR evaluator (`/api/interview/evaluate`, `starEvaluator.ts`) with rubric scores, STAR balance, and grounded rewrites |
| **Module 4** | Eye Contact & Posture Analysis | **Nabil** | Client-side MediaPipe `FaceLandmarker` + `PoseLandmarker` (`MediaPipeSetup.ts`, `visionCoach.ts`, `useVisionCoach.ts`, `visionOverlay.ts`), 3s start grace window, 5s presence timeline buckets |
| **Module 5** | Speech Analysis | **Alia** | `backend/speech_module.py` (WPM, hard/phrase/Manglish filler breakdown, audio-RMS long pause detection ≥2s, fluency score) + `AnnotatedTranscript.tsx` |
| **Module 6** | Feedback & Performance Report | **Amirul** | MongoDB persistence (`/api/sessions`), `SessionAnalysisModal`, `(dashboard)/page.tsx` (`ProgressTrendChart`), `(dashboard)/reports/page.tsx` (STAR/keywords/speech/presence timeline/annotated transcript/print PDF/retry weakest question) |

> **Hardware Note:** During local Whisper/LLM testing on laptops, keep cooling active (target CPU < 80°C).

---

## 3. Repository Structure

```
WORKSHOP 2/
├── AGENTS.md                        ← THIS FILE — project intelligence guide
├── modules_to_be_developed.md       ← Core 6 functional modules specification
├── MILESTONE.md / TASK_LIST.md      ← Planning & milestone logs
├── graphify-out/                    ← Knowledge graph (update via `graphify update .`)
│
├── backend/                         ← Python FastAPI Speech Service (Modules 2 & 5)
│   ├── main.py                      ← POST /analyze-speech, GET /health (single-worker lock)
│   ├── speech_module.py             ← Malaysian Whisper ASR, filler/Manglish & audio-RMS pause detection
│   ├── convert_malaysian_whisper.py ← One-time CT2 int8 converter
│   ├── test_speech_module.py        ← Backend tests
│   └── models/malaysian-whisper-small-v3-ct2/
│
└── frontend/                        ← Next.js 16.4.5 App Router application (Vokal.ai)
    ├── scripts/
    │   ├── test-unit.mjs            ← Unit tests (STAR, keywords, scoring, 3/5/7Q, LLM grounding)
    │   └── test-api.mjs             ← API smoke tests
    └── src/
        ├── app/
        │   ├── globals.css          ← Multi-theme tokens (editorial/studio/bento × light/dark) + print styles
        │   ├── (auth)/              ← login, signup pages
        │   ├── (dashboard)/         ← Persistent Sidebar + TopHeader layout
        │   │   ├── page.tsx         ← Home overview, KPIs, ProgressTrendChart, recent sessions
        │   │   ├── interview/page.tsx ← Practice Room (Modules 1–5 live coaching)
        │   │   └── reports/page.tsx ← Session Reports (Module 6, print PDF, retry weakest Q)
        │   └── api/
        │       ├── auth/            ← login, signup, logout, me (HTTP-only session cookies)
        │       ├── interview/       ← prepare (3/5/7Q + resume tailoring), parse-resume (PDF), evaluate (LLM STAR rubric)
        │       ├── sessions/        ← GET/POST /api/sessions, DELETE /api/sessions/[id] (MongoDB)
        │       └── speech/          ← Proxy to FastAPI POST /analyze-speech
        ├── components/
        │   ├── interview/           ← SessionSetupCard, QuestionPrompt, StarChecklist, LiveCoachingTip,
        │   │                          CandidateVideoFeed, WebcamFeed, ControlDock, DeviceSettingsModal,
        │   │                          Module3Analysis, SessionAnalysisModal, AnnotatedTranscript, StarFeedbackExtras
        │   ├── layout/              ← Sidebar, TopHeader
        │   └── ui/                  ← AppearanceMenu, BrandMark, ScoreRing, ProgressTrendChart
        ├── hooks/
        │   ├── useAuth.tsx
        │   ├── useAudioRecorder.ts
        │   ├── useBackgroundTranscription.ts ← Serial background Whisper queue during 3/5/7Q sessions
        │   ├── useInterviewPrep.ts           ← Role/company/level/count/resume prep + retry deep-links
        │   ├── useInterviewShortcuts.ts      ← Space / M / Alt+Arrow shortcuts
        │   ├── useMediaDevices.ts
        │   ├── useSessions.ts
        │   ├── useTheme.ts
        │   └── useVisionCoach.ts
        └── lib/
            ├── interview/           ← types.ts, llmProvider.ts, offlineGenerator.ts, starEvaluator.ts, analysisQueue.ts
            ├── nlp/                 ← analyze.ts, star.ts, keywords.ts, taxonomy.ts, text.ts, types.ts, sessionStore.ts
            ├── vision/              ← MediaPipeSetup.ts, visionCoach.ts, visionOverlay.ts, nudgeSound.ts
            ├── auth.ts / mongodb.ts / sessionSerializer.ts / speechApi.ts / format.ts
```

---

## 4. Tech Stack & Architecture

- **Frontend:** Next.js 16.4.5 (App Router), React 19.3, TypeScript 5, Tailwind CSS v4, Framer Motion 14, `unpdf` (resume PDF text extraction).
- **Client-Side Vision (Module 4):** `@mediapipe/tasks-vision` (`FaceLandmarker` with blendshapes/iris + `PoseLandmarker` for shoulder tilt, slouch, lean-in). **Video never leaves the browser.**
- **Speech Backend (Modules 2 & 5):** FastAPI + `faster-whisper` running Mesolitica's `malaysian-whisper-small-v3` (CTranslate2 int8) + `librosa` RMS pause analysis.
- **LLM Waterfall (Modules 1 & 3):** `Groq` → `Gemini` → `Ollama` → deterministic offline rule-based fallback (`resolveLlmProvider` / `invokeLlmJson` in `llmProvider.ts`).
- **Database:** MongoDB (`practice_sessions`, `users`) via singleton in `src/lib/mongodb.ts`.

### End-to-End Session Flow
1. Candidate configures target (`company`/`role`/`general`), session length (`3`/`5`/`7`Q), experience level (`internship`/`fresh_grad`/`junior`), optional JD & PDF resume → `POST /api/interview/prepare`.
2. Candidate answers each question via mic (`useAudioRecorder`) while `useVisionCoach` runs real-time eye contact & posture tracking (with a 3s recording-start grace window and 5s timeline buckets).
3. On stopping each answer, `useBackgroundTranscription` sends the clip to `/api/speech` in the background while the candidate moves to the next question.
4. On **Finish & analyze**, `executeAnalysisQueue` reuses completed background transcripts, runs baseline EN/BM NLP (`analyzeAnswer`) + semantic LLM grading (`POST /api/interview/evaluate`), merges vision snapshots, persists to MongoDB (`POST /api/sessions`), and opens `SessionAnalysisModal`.

---

## 5. Key Conventions & Rules

- **Design Tokens Only:** Never hardcode hex values in JSX/TSX; always use CSS custom properties from `src/app/globals.css` (`--surface`, `--raised`, `--border`, `--accent`, `--positive`, `--negative`, `--warning-ink`, `--star-s-*`..`--star-r-*`) so all 6 theme/mode presets (`editorial`, `studio`, `bento` × `light`/`dark`) stay consistent.
- **Video Gradients:** Any gradient over the webcam feed must use dark scrims (`black/60`), never inverted theme surface tokens.
- **Singleton Vision Models:** Never import `@mediapipe/tasks-vision` directly in components — always go through `MediaPipeSetup.ts` and `useVisionCoach.ts`.
- **Path Alias:** Always use `@/` imports (`src/`).
- **Knowledge Graph:** After modifying code files, run `graphify update .`.

---

## 6. Running & Verifying

```bash
# 1. Start Python Speech Backend (Modules 2 & 5)
cd "WORKSHOP 2/backend"
uvicorn main:app --reload --port 8000

# 2. Start Next.js Frontend
cd "WORKSHOP 2/frontend"
npm run dev

# Verification commands
npm run test:unit     # Unit tests (STAR, keywords, scoring, 3/5/7Q, LLM grounding)
npx tsc --noEmit      # TypeScript check
npm run lint          # ESLint
npx next build --webpack
```

---

## 7. Current Status vs. Future Polish

### Built & Working
- [x] Auth (`/login`, `/signup`, HTTP-only cookies) & MongoDB session persistence (`/api/sessions`)
- [x] Configurable 3 / 5 / 7 question sessions + `Internship / Fresh Grad / Junior` level selector
- [x] Resume PDF parsing (`/api/interview/parse-resume`) + anti-hallucination JD tailoring + multi-provider LLM fallback
- [x] Browser TTS read-aloud, 15s prep timer, and contextual interviewer follow-up probes
- [x] Background per-question transcription (`useBackgroundTranscription`) with Malaysian Whisper & Manglish filler detection
- [x] Hybrid STAR analysis: instant EN/BM regex + post-session LLM semantic rubric (0–100 pillars, relevance, ownership, STAR time balance, grounded stronger rewrite)
- [x] Live MediaPipe Face + Pose coaching (`visionCoach.ts`) with 3s start grace window & 5s presence timeline
- [x] Multi-session `ProgressTrendChart` on Home, annotated transcripts (STAR tags + fillers + Manglish + pauses), print/PDF export, and one-click "Retry weakest question"

### Future / Nice-to-Have Ideas
- [ ] Audio playback scrubber synced to long pauses and filler timestamps in `/reports`
- [ ] Optional lecturer/cohort aggregate analytics view
- [ ] Offline exhibition kiosk toggle (pre-cached demo mode)
