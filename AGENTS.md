# InterViewAI — Project Intelligence Guide
> **For AI agents, new contributors, and collaborators.**  
> This document is the single source of truth for understanding the codebase, architecture, conventions, and what still needs to be built.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Team & Responsibilities](#2-team--responsibilities)
3. [Repository Structure](#3-repository-structure)
4. [Tech Stack](#4-tech-stack)
5. [Architecture & Data Flow](#5-architecture--data-flow)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Design System](#7-design-system)
8. [What's Built vs. What's TODO](#8-whats-built-vs-whats-todo)
9. [Key Conventions & Rules](#9-key-conventions--rules)
10. [Running the Project](#10-running-the-project)
11. [AI Agent Instructions](#11-ai-agent-instructions)

---

## 1. Project Overview

**InterViewAI** is a real-time multimodal AI mock interview coach built for Malaysian university students preparing for behavioral (STAR-method) job interviews.

| Field | Value |
|---|---|
| **Full Name** | InterViewAI — Real-Time Multimodal AI Mock Interview Coach |
| **Academic Context** | FTMK Workshop II (BITU 3973), Universiti Teknikal Malaysia Melaka (UTeM) |
| **Target Users** | FTMK graduating students & Malaysian job seekers |
| **Interview Style** | STAR (Situation, Task, Action, Result) behavioral methodology |
| **Key Differentiator** | All computer vision runs **client-side in the browser** (privacy-first, zero video upload) |

### Core Problem Being Solved
Malaysian CS graduates have limited access to realistic mock interview practice. Existing tools don't provide real-time, multimodal coaching (eye contact, posture, speech pacing, STAR structure) simultaneously.

---

## 2. Team & Responsibilities

The project is divided into **6 functional modules**, each owned by a team member:

| Module | Name | Owner | Description |
|---|---|---|---|
| **Module 1** | Interview Question & Voice Response | **Amirul** | System generates mock interview questions per job role; user answers by speaking |
| **Module 2** | Speech-to-Text & Data Processing | **Alia** | Transcribes user's voice response and prepares data for downstream analysis |
| **Module 3** | NLP & STAR Structure Analysis | **Syafiq** | Evaluates responses with NLP for industry keywords; verifies STAR structure coverage and gaps |
| **Module 4** | Eye Contact & Posture Analysis | **Nabil** | Webcam-based real-time tracking; displays reminders when eye contact or posture needs improvement |
| **Module 5** | Speech Analysis | **Alia** | Identifies filler words ("um", "ah", "like") and long pauses to assess fluency and pacing |
| **Module 6** | Feedback & Performance Report | **Amirul** | Merges all analysis outputs into a final score, feedback summary, and improvement recommendations |

### Module Ownership Summary

| Member | Modules | Primary Focus |
|---|---|---|
| **Amirul** | 1, 6 | Question generation, session orchestration, final report synthesis |
| **Alia** | 2, 5 | Whisper ASR transcription, filler word & fluency analysis |
| **Syafiq** | 3 | NLP keyword extraction, STAR structure classification |
| **Nabil** | 4 | MediaPipe vision — eye contact tracking, posture detection via webcam |

> ⚠️ **Hardware Note:** During local AI inference testing, keep the **MSI Katana GF66 cooling pad active**. Target CPU thermal limit: **< 80°C**.

---

## 3. Repository Structure

```
WORKSHOP 2/                          ← Project root
├── MILESTONE.md                     ← Milestone tracker
├── modules_to_be_developed.md       ← Core 6 functional modules specification
├── REDESIGN_PLAN.md                 ← Simplified Vokal.ai UI redesign plan & handoff
├── TASK_LIST.md                     ← Persistent task checklist for model handoff
├── AGENTS.md                        ← THIS FILE — project intelligence guide
│
└── frontend/                        ← Next.js 16.4.5 App Router application (Vokal.ai)
    ├── package.json                 ← Dependencies & npm scripts
    ├── tailwind.config.ts           ← Tailwind v4 configuration
    ├── next.config.ts               ← Next.js configuration (redirects, cacheComponents)
    ├── postcss.config.mjs           ← PostCSS config (@tailwindcss/postcss for Tailwind v4)
    ├── tsconfig.json                ← TypeScript configuration
    │
    └── src/
        ├── app/
        │   ├── globals.css          ← Vokal.ai framed-sheet design tokens
        │   ├── layout.tsx           ← Root layout (IBM Plex Sans & Mono, metadata)
        │   └── (dashboard)/         ← Persistent App Shell route group (Sidebar + TopHeader on all pages)
        │       ├── layout.tsx       ← Collapsible Sidebar (228px / 56px icon rail + mobile drawer) + TopHeader
        │       ├── page.tsx         ← Home overview (latest session summary, 3 KPIs, recent sessions list)
        │       ├── interview/
        │       │   └── page.tsx     ← Practice Room (Modules 1–5 live interview coaching)
        │       └── reports/
        │           └── page.tsx     ← Session Reports (Module 6 feedback, STAR/speech/transcript dropdowns)
        │
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx      ← Collapsible persistent sidebar (Home, Practice, Reports)
        │   │   └── TopHeader.tsx    ← Minimal 48px header with page title & privacy indicator
        │   │
        │   ├── interview/           ← Live Practice Room UI components
        │   │   ├── index.ts         ← Barrel export for interview components
        │   │   ├── QuestionPrompt.tsx       ← Module 1 question card + collapsible Keywords toggle
        │   │   ├── StarChecklist.tsx        ← Module 3 live S/T/A/R 4-chip bar (click letter for summary)
        │   │   ├── LiveCoachingTip.tsx      ← Collapsible 1-line AI coaching tip
        │   │   ├── CandidateVideoFeed.tsx   ← Module 4 webcam wrapper + eye contact & posture alerts
        │   │   ├── WebcamFeed.tsx           ← Low-level webcam component (getUserMedia + canvas overlay)
        │   │   ├── ControlDock.tsx          ← Bottom dock: mic/camera/settings, start/stop, next question
        │   │   ├── DeviceSettingsModal.tsx  ← Hardware input selection & live mic level tester
        │   │   └── VisualNudge.tsx          ← Animated visual nudge alerts
        │   │
        ├── hooks/
        │   ├── useFaceMesh.ts       ← MediaPipe FaceLandmarker rAF inference loop
        │   ├── useMediaDevices.ts   ← Webcam & microphone enumeration + localStorage persistence
        │   └── useTheme.ts          ← Theme state hook
        │
        └── lib/
            ├── mockSessions.ts      ← Shared session dataset for Home (`/`) and Reports (`/reports`)
            ├── mongodb.js           ← MongoDB client singleton (connection caching)
            └── vision/
                └── MediaPipeSetup.ts ← MediaPipe FaceLandmarker singleton init/destroy
```

---

## 4. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.4.0 (App Router) | React framework, SSR/client routing |
| **React** | 19.3.0 | UI rendering |
| **TypeScript** | ^5 | Type safety across entire codebase |
| **Tailwind CSS** | ^4 | Utility-first styling (CSS-variable based design tokens) |
| **Framer Motion** | ^14 | Animated visual nudges and micro-interactions |
| **Lucide React** | ^1.52 | Icon library (used in WebcamFeed states) |
| **Material Symbols** | CDN | Icon font for HUD overlays and buttons |
| **Google Fonts** | CDN | IBM Plex Sans (UI) + IBM Plex Mono (telemetry) via `next/font/google` |

### Vision AI (Client-Side — Browser)
| Technology | Version | Purpose |
|---|---|---|
| **@mediapipe/tasks-vision** | ^1.1.0 | FaceLandmarker — 478 face landmarks, iris tracking, head pose |
| **@mediapipe/camera_utils** | ^0.3 | Camera stream utilities |

### Database & Backend
| Technology | Version / Type | Purpose |
|---|---|---|
| **MongoDB** | ^7.7.0 (Official Driver) | NoSQL document database for session history, candidate profiles, evaluation logs |
| **FastAPI** (Python) | Planned | REST API for audio/NLP processing |
| **Whisper ASR** | Planned | Speech-to-text transcription |
| **STAR Classification** | Planned | NLP model for Situation/Task/Action/Result detection |

---

## 5. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Client-Side)                  │
│                                                           │
│  Webcam (HD 1280×720) ──► WebcamFeed.tsx                 │
│                               │ HTMLVideoElement ref      │
│                               ▼                           │
│                        useFaceMesh.ts                     │
│                     (requestAnimationFrame loop)           │
│                        ~15 fps state updates              │
│                               │                           │
│                    MediaPipeSetup.ts                      │
│                  (FaceLandmarker singleton)                │
│                  GPU-accelerated via WebGL                │
│                               │                           │
│              478 Face Landmarks per frame                 │
│         ┌─────────────┬───────────────┐                  │
│         ▼             ▼               ▼                  │
│    Eye Contact    Head Pose      Expressions             │
│    (iris 468-477) estimation    (blendshapes)            │
│         │             │               │                  │
│         └─────────────┴───────────────┘                  │
│                        │                                  │
│              CandidateVideoFeed HUD                       │
│         (WPM overlay, eye contact %, posture alert)      │
└──────────────────────────┬──────────────────────────────┘
                           │ Audio stream only
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND (Python / FastAPI)  [PLANNED]    │
│                                                           │
│  Audio Stream ──► Whisper ASR ──► Transcript             │
│                                       │                   │
│                              STAR Classifier              │
│                         (Situation/Task/Action/Result)    │
│                                       │                   │
│                        Malaysian keyword taxonomy         │
│                        Filler word detection (um, ah...)  │
│                                       │                   │
│                              MongoDB                      │
│                   (session logs, candidate profiles)      │
└─────────────────────────────────────────────────────────┘
```

### Privacy Architecture
> **Video never leaves the browser.** MediaPipe runs entirely in WebAssembly + WebGL on the client GPU. Only the audio stream is sent to the backend for speech transcription. This is an intentional design decision to preserve candidate privacy.

---

## 6. Frontend Deep Dive

### Entry Point: `src/app/(dashboard)/interview/page.tsx`
The main `PracticeRoom` component owns all session state:
- `isSessionActive` — starts/stops the interview timer and AI listening indicator
- `isMicOn / isVideoOn` — controls for the bottom dock
- `elapsedSeconds` — live timer (increments only while session is active)
- `starProgress` — mock STAR detection state (to be driven by backend NLP)
- `metrics` — mock HUD telemetry (to be driven by MediaPipe + Whisper)
- `isDark / toggleTheme` — from `useTheme` hook, controls global dark mode

### Component Responsibilities

#### `WebcamFeed.tsx`
- Owns `getUserMedia` permission lifecycle
- Renders `<video>` mirrored (scaleX -1) for natural UX
- Layers a `<canvas>` overlay for future face mesh debug drawing
- Exposes `videoElement` and `canvasElement` via `forwardRef` / `useImperativeHandle`
- States: `idle → requesting → active | denied | error`
- **Video constraints:** 1280×720 ideal, 640×480 minimum, 16:9 aspect ratio, 30fps

#### `CandidateVideoFeed.tsx`
- Wraps `WebcamFeed` with a 16:9 aspect-ratio container (`aspect-video min-h-[420px]`)
- Adds HUD overlays absolutely positioned inside:
  - Top-left: WPM speech pacing gauge
  - Top-right: Eye contact percentage tracker
  - Bottom-left: Posture deviation alert (amber)
  - Bottom-right: Filler word micro-counter
- Dark gradient vignettes (always `black/60`) for HUD readability — NOT theme-sensitive tokens
- Toggle between live webcam and a demo Unsplash image stream

#### `useFaceMesh.ts`
- Singleton pattern: loads ~4MB MediaPipe WASM + model once, reuses across renders
- `requestAnimationFrame` loop runs at display refresh rate (~60fps)
- React state is throttled to **~15fps** (`STATE_UPDATE_INTERVAL_MS = 66ms`) to avoid excessive re-renders
- Returns `{ result, isModelReady, isDetecting, error }`
- **TODO:** Pipe raw landmarks into eye-contact scoring function
- **TODO:** Enable `refineLandmarks: true` for precise iris positions (indices 468–477)

#### `useTheme.ts`
- Reads `localStorage("theme")` on mount, falls back to OS `prefers-color-scheme`
- Toggles `.dark` class on `<html>` element
- Persists choice to `localStorage` on every toggle
- Returned from `page.tsx` (note: the redesigned UI is light-only; the hook is retained but not currently wired)

### Dark Mode Implementation
The design system uses CSS custom properties in `globals.css`:
- `:root {}` — light theme (cool crystalline blues, white surfaces)
- `.dark {}` — dark theme (deep navy `#0d1b2e` base, inverted text/primary tokens)
- `body` has `transition: background-color 0.3s ease, color 0.3s ease` for smooth switching
- **Critical:** Any gradient that overlays the video feed must use `black/opacity` NOT `inverse-surface` token (which flips to white in dark mode)

---

## 7. Design System

Full spec in [`DESIGN.md`](./DESIGN.md). Summary:

### Color Tokens (CSS Variables)
| Token | Light Value | Dark Value | Role |
|---|---|---|---|
| `--surface` | `#f8f9ff` | `#0d1b2e` | Page background |
| `--surface-container-lowest` | `#ffffff` | `#060e1a` | Cards, header |
| `--primary` | `#0058be` | `#adc6ff` | CTAs, focus |
| `--on-surface` | `#0b1c30` | `#dce8ff` | Body text |
| `--tertiary` | `#006947` | `#4edea3` | Live/active states |
| `--error` | `#ba1a1a` | `#ffb4ab` | Recording, warnings |

### Typography
- **UI & prose:** IBM Plex Sans
- **Telemetry / IDs:** IBM Plex Mono (tabular-nums)
- **Monospace metrics** (WPM, timers): `font-mono` via Tailwind

### Spacing
8-point grid system. Use Tailwind spacing utilities (`p-4` = 16px, `gap-6` = 24px).

### Icons
- **Material Symbols Outlined** (CDN) — used in all HUD chips and buttons
- **Lucide React** — used in WebcamFeed state screens (Video, VideoOff, Loader2)

---

## 8. What's Built vs. What's TODO

### ✅ Built & Working
- [x] Full Practice Room layout (split-screen, responsive 12-col grid)
- [x] `Sidebar` + `TopHeader` persistent app shell (replaced the old `SessionHeader`)
- [x] `QuestionPrompt` — behavioral question card with recording indicator
- [x] `StarChecklist` — STAR progress tracker (mock data, UI only)
- [x] `LiveCoachingTip` — coaching callout card
- [x] `CandidateVideoFeed` — 16:9 webcam with HUD overlays (mock metrics)
- [x] `WebcamFeed` — real webcam via `getUserMedia`, HD 1280×720 constraints
- [x] `ControlDock` — mic/video/session toggle controls
- [x] `VisualNudge` — animated alert component (Framer Motion)
- [x] `MediaPipeSetup.ts` — FaceLandmarker singleton init/destroy
- [x] `useFaceMesh.ts` — rAF inference loop, throttled state updates
- [x] `useTheme.ts` — dark/light toggle with localStorage persistence
- [x] Dark mode (full `.dark` CSS variable overrides + smooth transitions)
- [x] Design system (`globals.css` with Material 3 tonal tokens)

### 🔲 TODO — Vision AI
- [ ] Enable `refineLandmarks: true` in `MediaPipeSetup.ts` for iris tracking (indices 468–477)
- [ ] Wire `useFaceMesh` into `CandidateVideoFeed` / `WebcamFeed` to drive live HUD metrics
- [ ] Implement eye-contact scoring algorithm using iris vs. camera vector
- [ ] Implement posture detection using shoulder landmark alignment (MediaPipe Pose or FaceMesh head pose matrix)
- [ ] Draw face mesh debug landmarks on `<canvas>` overlay (controlled by `showDebugOverlay` prop)
- [ ] Replace mock `metrics` state in `page.tsx` with live MediaPipe output

### 🔲 TODO — Speech & NLP Backend
- [ ] Set up FastAPI project (`/backend`)
- [ ] Integrate Whisper ASR for audio-to-text transcription
- [ ] Build filler word detector (English: "um", "uh"; Malaysian: "ah", "lah", "actually")
- [ ] Build STAR classification engine (Situation / Task / Action / Result coverage scoring)
- [ ] Malaysian tech industry keyword taxonomy integration
- [ ] REST API endpoints to feed transcript data back to Next.js frontend

### 🔲 TODO — Integration
- [ ] Wire live WPM / volume / clarity metrics to live audio analysis
- [ ] Wire `StarChecklist` progress to live backend NLP output
- [ ] Wire `LiveCoachingTip` to dynamic AI-generated coaching suggestions
- [ ] Connect `ControlDock` mic toggle to actual audio stream on/off

### 🔲 TODO — MongoDB & Data Layer
- [x] Configure `MONGODB_URI` in `.env.local`
- [x] Create MongoDB client singleton with cached promise (`mongodb.js`)
- [ ] Define collections & TypeScript schemas (`candidates`, `sessions`, `star_evaluations`, `session_metrics`)
- [ ] Create Next.js API routes (`/api/sessions`) or Server Actions to persist practice runs
- [ ] Candidate dashboard for reviewing past session analytics from MongoDB

### 🔲 TODO — Production Polish
- [ ] Lecturer / anti-bias dashboard (`/components/dashboard`)
- [ ] Offline/local fallback mode for exhibition booth
- [ ] Calibrate visual nudge thresholds (avoid distraction during high-stress speech)
- [ ] Fix edge-case race conditions in stream teardown

---

## 9. Key Conventions & Rules

### TypeScript
- All components use strict TypeScript — no `any` unless unavoidable
- Props interfaces are defined inline above each component
- `forwardRef` + `useImperativeHandle` pattern used for DOM handle exposure (see `WebcamFeed`, `CandidateVideoFeed`)

### Imports
- Path alias `@/` maps to `src/` — always use this, never relative paths that go up more than one level
- Components import from barrel `@/components/interview` where possible

### Styling Rules
- **Tailwind utility classes only** — no inline `style={}` except for specific overrides (`transform`, `fontVariationSettings`)
- **Always use CSS design tokens** (`text-primary`, `bg-surface-container-low`) — never hardcode hex values in JSX
- **Exception:** Video feed gradients must use `from-black/60` not `from-inverse-surface/80` — the latter flips to white in dark mode
- Dark mode overrides live in `globals.css` `.dark {}` block — never use Tailwind's `dark:` prefix

### Component Rules
- All client components must have `"use client"` at the top
- No component should own business logic it doesn't need — keep components dumb, push state up to `page.tsx`
- MediaPipe hooks (`useFaceMesh`) belong in `src/hooks/`, not inside components

### Naming
- Components: `PascalCase` (e.g., `CandidateVideoFeed`)
- Hooks: `camelCase` starting with `use` (e.g., `useFaceMesh`)
- Files: `PascalCase.tsx` for components, `camelCase.ts` for hooks and utilities

---

## 10. Running the Project

```bash
# Navigate to the frontend
cd "WORKSHOP 2/frontend"

# Install dependencies (already done)
npm install

# Start dev server
npm run dev
# → Opens at http://localhost:3000

# Lint check
npm run lint

# Production build (only when needed)
npm run build
```

> **Webcam permission:** The browser will ask for camera access on first load. Click "Allow". If denied, the `WebcamFeed` component shows an error state with instructions.

---

## 11. AI Agent Instructions

If you are an AI agent working on this codebase, follow these rules:

### Always Do
- Read `DESIGN.md` before touching any CSS or Tailwind classes
- Use existing design tokens (`--primary`, `--surface-container-low`, etc.) — check `globals.css` for the full list
- Keep the `useFaceMesh` + `MediaPipeSetup` singleton pattern — do not create new FaceLandmarker instances in components
- Test that dark mode still works after any CSS changes (the `.dark` class is toggled on `<html>`)
- Use `"use client"` directive for any component using React hooks or browser APIs

### Never Do
- Never hardcode hex color values in JSX/TSX — always use Tailwind design token classes
- Never use `inverse-surface` for gradients overlaid on the video feed (it goes white in dark mode)
- Never import MediaPipe directly in a React component — go through `MediaPipeSetup.ts` and `useFaceMesh.ts`
- Never add `minHeight` constraints to `WebcamFeed` — the parent `CandidateVideoFeed` controls sizing via `aspect-video`
- Never add a backend API call in a component — only in hooks or server actions

### Current Mock Data Locations
All the following are **currently fake/hardcoded** and need to be replaced with live data:
- `src/lib/mockSessions.ts` (Home + Reports) - replace with MongoDB/backend output
- Mock STAR / metrics state in `src/app/(dashboard)/interview/page.tsx` - replace with MediaPipe + Whisper + NLP output
- `LiveCoachingTip` tip prop in `page.tsx` — replace with dynamic AI suggestion

### Next Recommended Task
The highest-value next step is wiring up the MediaPipe vision pipeline:
1. Enable `refineLandmarks: true` in `MediaPipeSetup.ts`
2. Call `useFaceMesh(webcamRef)` in `page.tsx`
3. Map the `result.faceLandmarks[0]` iris landmarks (468–477) to an eye-contact percentage
4. Push that percentage into the `metrics.eyeContact` state to drive the HUD
