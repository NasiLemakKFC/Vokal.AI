# InterViewAI — Multimodal AI Mock Interview Coach
## FTMK Workshop II (BITU 3973) Project Roadmap & Milestones

---

### Project Overview
* **Project Title:** InterViewAI — Real-Time Multimodal AI Mock Interview Coach
* **Faculty:** Faculty of Information and Communication Technology (FTMK), Universiti Teknikal Malaysia Melaka (UTeM)
* **Target Audience:** Graduating students and job seekers practicing behavioral interviews (STAR methodology) for the Malaysian tech industry
* **Core Technologies:** Next.js (App Router), TypeScript, Tailwind CSS, MediaPipe (Face Mesh / Iris & Pose tracking), Whisper ASR, Supabase, FastAPI

---

## 👥 Team Roster & Lead Responsibilities

| Name | Role | Primary Focus Areas |
| :--- | :--- | :--- |
| **Amirul** | Project Lead / Vision AI & Architecture Lead | System architecture, Next.js frontend, Supabase setup, MediaPipe Vision engine, technical report synthesis |
| **Alia** | Project Management & Documentation Lead | Gantt scheduling, problem formulation, video pitch directing, peer review coordination |
| **Syafiq** | Speech AI & NLP Lead | Whisper ASR integration, STAR matrix parser, Malaysian industry keyword extraction, pitch audio/video |
| **Whole Team** | Collaborative Integration & QA | End-to-end merging, peer testing, poster design, exhibition showcase & defense |

> [!NOTE]
> **Hardware Operational Guideline:** During intensive local AI testing and inference workloads, keep the **MSI Katana GF66 cooling pad active** to ensure local CPU thermals remain strictly under **80°C**.

---

## 📅 Master Milestone Schedule (Weeks 1 – 15)

| Week / Phase | Key Milestone | Technical Task Breakdown | Lead Responsibility | Deliverables & Gates |
| :--- | :--- | :--- | :--- | :--- |
| **Weeks 1–3**<br>`Planning` | **Proposal Submission** | Draft Introduction and Problem Statements. Define Objectives. Map out the Gantt chart and system architecture. | • **Alia**: Gantt, Intro, Problem Statement<br>• **Syafiq**: Objectives<br>• **Amirul**: Architecture | Project Proposal Document, Initial Gantt Chart |
| **Weeks 4–5**<br>`Environment & UI` | **Progress Report I**<br>*(Frontend Skeleton)* | Initialize Next.js frontend and Supabase database using Antigravity IDE. Build core student and educator dashboard interfaces. | **Amirul** *(Keep MSI Katana GF66 cooling pad active during testing; CPU <80°C)* | Progress Report I, Next.js Scaffold, Supabase Schema, UI Mockups |
| **Weeks 6–7**<br>`Vision Module` | **Live Nudge Prototype** | Integrate OpenCV and MediaPipe Pose/Face Mesh to track eye contact and posture via webcam. Program mid-sentence visual alerts (e.g., screen border glow). | **Vision AI Lead / Amirul** | Client-side MediaPipe hook, Live eye-contact/posture HUD nudges |
| **Weeks 8–9**<br>`Speech & NLP` | **Progress Report II**<br>*(Voice-First NLP)* | Connect Whisper ASR for voice-to-text. Script logic to detect filler words (*"um"*, *"ah"*) and evaluate transcripts against the STAR framework and Malaysian industry keywords. | **NLP Lead / Syafiq** | Progress Report II, Whisper pipeline, STAR classification engine |
| **Weeks 10–11**<br>`Integration` | **Exhibition Poster**<br>*(System Merge)* | Connect backend AI logic (Vision + NLP) to Next.js frontend. Ensure acoustic pacing metrics and structural feedback populate dashboard accurately. Design exhibition poster. | **Whole Team** | Integrated MVP, Exhibition Poster (A1 format), Shared API contracts |
| **Week 12**<br>`Testing & Polish` | **Progress Report III**<br>*(Bug Fixing)* | Conduct rigorous peer testing. Refine the anti-bias lecturer view. Optimize live reminder triggers to ensure they are not overly distracting while candidate speaks. | **Whole Team** | Progress Report III, Peer testing audit log, latency benchmarks |
| **Week 13**<br>`Demo Production` | **Draft Final Report**<br>*(Pitch Video)* | Record live system demo. Edit and upload YouTube pitch video. Compile Draft Final Report combining all modular progress. | • **Alia & Syafiq**: Video demo & editing<br>• **Amirul**: Report compilation | Draft Final Report, YouTube 3–5 min Pitch Video |
| **Weeks 14–15**<br>`Final Exhibition` | **Live Presentation**<br>*(Final Submission)* | Present at FTMK Workshop II exhibition booth. Submit Final Report, Individual Logbooks (with supervisor signatures), and Peer Assessment Form. | **Whole Team** | Final Report, Signed Logbooks, Peer Assessment, Booth Demo |

---

## 🔍 Detailed Phase Breakdown & Task Tracking

### Phase 1: Planning & Proposal Formulation (Weeks 1–3)
* **Goal:** Establish clear project scope, academic validation, and system boundaries.
* **Tasks:**
  - [x] Formulate problem statement highlighting graduate interview preparation gaps in Malaysia.
  - [x] Define functional and non-functional requirements (real-time feedback, privacy-first client inference).
  - [x] Create comprehensive architecture diagram detailing client-side MediaPipe + backend Whisper ASR pipeline.
  - [x] Establish team Gantt chart and milestone tracking schedule.
* **Gateway Checkpoint:** Formal Proposal Submission & Supervisor Sign-off.

---

### Phase 2: Environment Setup & UI Skeleton (Weeks 4–5)
* **Goal:** Scaffold solid, scalable Next.js App Router codebase and persistence layer.
* **Tasks:**
  - [x] Scaffold Next.js 15+ project with TypeScript, Tailwind CSS, and Lucide/Material Icons.
  - [x] Establish design system (`globals.css`) aligned with Material 3 tonal surfaces and Stitch specifications.
  - [x] Set up Supabase project for candidate profiles, session histories, and evaluation logs.
  - [x] Build Practice Room layout with responsive split-screen view and bottom dock.
* **Thermal Note:** Enforce active cooling on MSI Katana GF66 during local Next.js + IDE operations.
* **Gateway Checkpoint:** Progress Report I Submission.

---

### Phase 3: Vision Module & Real-Time Nudges (Weeks 6–7)
* **Goal:** Zero-latency client-side visual telemetry using MediaPipe.
* **Tasks:**
  - [x] Implement `useFaceMesh` custom hook utilizing `@mediapipe/tasks-vision`.
  - [x] Implement eye-contact estimation algorithm comparing iris landmarks against camera vector.
  - [x] Build posture deviation detection using shoulder landmark alignment.
  - [x] Implement non-intrusive HUD visual nudges (border glow, subtle toast alerts).
* **Gateway Checkpoint:** Live webcam visual nudge demonstration.

---

### Phase 4: Voice-First NLP & STAR Analysis (Weeks 8–9)
* **Goal:** Acoustic pacing, speech disfluency analysis, and structured behavioral scoring.
* **Tasks:**
  - [ ] Configure Whisper ASR ingestion pipeline for student audio stream.
  - [ ] Implement disfluency counter for English and Malaysian filler words (*"um"*, *"ah"*, *"actually"*, *"like"*).
  - [ ] Build STAR classification model to assess Situation, Task, Action, and Result coverage.
  - [ ] Integrate Malaysian tech industry contextual keyword taxonomy.
* **Gateway Checkpoint:** Progress Report II Submission.

---

### Phase 5: System Integration & Exhibition Poster (Weeks 10–11)
* **Goal:** End-to-end integration and public exhibition artifact preparation.
* **Tasks:**
  - [ ] Wire frontend HUD elements (`DiagnosticsBar`, `StarChecklist`, `CandidateVideoFeed`) to live audio/vision inference streams.
  - [ ] Real-time aggregation of WPM, volume consistency, and clarity index.
  - [ ] Design high-impact A1 Exhibition Poster highlighting problem, methodology, novelty, and architecture.
* **Gateway Checkpoint:** Exhibition Poster Draft & Merged System Prototype.

---

### Phase 6: Peer Testing, Calibration & Polish (Week 12)
* **Goal:** Usability validation and minimization of cognitive overload.
* **Tasks:**
  - [ ] Conduct peer usability trials with at least 5 FTMK students.
  - [ ] Calibrate visual nudge thresholds to prevent student distraction during high-stress speech.
  - [ ] Refine anti-bias lecturer review dashboard (focusing purely on structured STAR competencies).
  - [ ] Fix edge-case race conditions and stream teardown leaks.
* **Gateway Checkpoint:** Progress Report III Submission.

---

### Phase 7: Demo Production & Draft Report (Week 13)
* **Goal:** Polish all visual and written artifacts for academic grading.
* **Tasks:**
  - [ ] Screen-capture high-fidelity end-to-end practice session and analytics review.
  - [ ] Edit, voiceover, and publish 3–5 minute YouTube promotional/technical pitch video.
  - [ ] Assemble modular chapters into comprehensive Draft Final Report.
* **Gateway Checkpoint:** Draft Final Report & YouTube Video Link Submission.

---

### Phase 8: Final Exhibition & Submission (Weeks 14–15)
* **Goal:** Successful project defense and completion of all workshop requirements.
* **Tasks:**
  - [ ] Deploy stable offline/local fallback mode for exhibition booth showcase.
  - [ ] Prepare interactive booth demo (webcam setup, lighting, sample question bank).
  - [ ] Finalize Individual Logbooks with required supervisor weekly signatures.
  - [ ] Complete Peer Assessment Forms and submit hardcopy/softcopy Final Report.
* **Gateway Checkpoint:** Workshop II Exhibition Presentation & Final Submission.

---

## 📋 Evaluation Checklist & Deliverables Verification

- [ ] **Project Proposal** *(Submitted Week 3)*
- [ ] **Progress Report I** *(Submitted Week 5)*
- [ ] **Progress Report II** *(Submitted Week 9)*
- [ ] **Progress Report III** *(Submitted Week 12)*
- [ ] **A1 Exhibition Poster** *(Ready Week 11)*
- [ ] **3–5 min Pitch Video on YouTube** *(Uploaded Week 13)*
- [ ] **Draft Final Report** *(Submitted Week 13)*
- [ ] **Individual Logbooks with Supervisor Signatures** *(Weeks 1–14 signed)*
- [ ] **Peer Assessment Forms** *(Completed by all 3 members)*
- [ ] **Final Project Report** *(Submitted Week 15)*
- [ ] **FTMK Workshop II Booth Defense** *(Completed Week 15)*
