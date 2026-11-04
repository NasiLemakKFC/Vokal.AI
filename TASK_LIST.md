# Vokal.ai — Simplified Redesign & Module-Aligned UI Task List

> **Purpose:** Persistent handoff checklist for **Vokal.ai** using the **`design-taste-frontend` (`framed-sheet` light-mode app architecture)** skill and aligning strictly with [`modules_to_be_developed.md`](file:///c:/Users/USER/Desktop/WORKSHOP%202/modules_to_be_developed.md) (Modules 1–6).
> **Plan Reference:** [`REDESIGN_PLAN.md`](file:///c:/Users/USER/Desktop/WORKSHOP%202/REDESIGN_PLAN.md)

---

## Completed Simplified Redesign Checklist

- [x] **1. Persistent Collapsible Sidebar on All Pages (`(dashboard)` Route Group)**:
  - Moved `/interview` inside `src/app/(dashboard)/interview/page.tsx` so `Sidebar` and `TopHeader` wrap every screen (`/`, `/interview`, `/reports`).
  - Added desktop sidebar collapse (`228px` expanded ↔ `56px` icon rail) persisted in `localStorage["vokalai_sidebar"]` with `[` keyboard shortcut, plus mobile off-canvas drawer.
  - Simplified navigation to 3 core items: **Home** (`/`), **Practice** (`/interview`), and **Reports** (`/reports`).
  - Removed the old `SessionHeader` back button (`← Overview`) and redundant header switchers.

- [x] **2. Simplified Home Page (`src/app/(dashboard)/page.tsx`)**:
  - Removed the **Weekly Practice Cadence** card, **Scoring Weights** card, **3-Step Prep Guide**, and KPI tab panels.
  - Kept a clean, focused overview: greeting + one-line takeaway, primary **Start practice** button, 3-cell hairline KPI strip (**STAR score**, **Eye contact**, **Fillers per minute**), and the **Recent sessions** list with per-row **STAR ▾** dropdowns.

- [x] **3. Simplified Practice Room (`src/app/(dashboard)/interview/page.tsx` & `components/interview/*`)**:
  - Added a clean in-page toolbar (`Question 1 of 3 · Junior Software Engineer`, live timer, **End session** link to `/reports`).
  - Simplified [`QuestionPrompt.tsx`](file:///c:/Users/USER/Desktop/WORKSHOP%202/frontend/src/components/interview/QuestionPrompt.tsx) (Module 1) with a **Keywords ▾** toggle button.
  - Simplified [`StarChecklist.tsx`](file:///c:/Users/USER/Desktop/WORKSHOP%202/frontend/src/components/interview/StarChecklist.tsx) (Module 3) into a 4-letter `S · T · A · R` chip bar where clicking any letter reveals its one-line detection note.
  - Kept [`LiveCoachingTip.tsx`](file:///c:/Users/USER/Desktop/WORKSHOP%202/frontend/src/components/interview/LiveCoachingTip.tsx) collapsed behind a single-line **Coaching tip ▾** toggle.
  - Simplified [`CandidateVideoFeed.tsx`](file:///c:/Users/USER/Desktop/WORKSHOP%202/frontend/src/components/interview/CandidateVideoFeed.tsx) (Module 4) to show only **Eye contact %** and **Posture nudge** on the video, with **Pace (WPM)** and **Fillers** (Module 5) as two clean chips right below the video.
  - Removed `SessionHeader.tsx` and `DiagnosticsBar.tsx` clutter, and streamlined [`ControlDock.tsx`](file:///c:/Users/USER/Desktop/WORKSHOP%202/frontend/src/components/interview/ControlDock.tsx).

- [x] **4. Module 6 Session Reports Page (`src/app/(dashboard)/reports/page.tsx`)**:
  - Replaced `/lecturer` with `/reports` (and added a redirect `/lecturer → /reports` in `next.config.ts`).
  - Displays a session selector, a 4-tile score strip (**Overall**, **Content (STAR)**, **Delivery**, **Eye contact & posture**), **What to improve** (top 3 actionable bullets), and 3 closed-by-default disclosure drawers:
    - **STAR breakdown ▾** (Module 3)
    - **Speech details ▾** (Module 5: WPM, fillers/min, long pauses, filler words)
    - **Transcript ▾** (Module 2)

- [x] **5. Verification & Gate**:
  - `design-taste-frontend` linter (`lint.mjs --app`): **0 FAIL, 4 WARN** (down from 72 warnings).
  - ESLint (`npm run lint`): **0 errors**.
  - Production build (`npm run build`): **0 errors**.

---

## Next Recommended Steps (For Future Sessions / Model Handoff)
- [ ] **Phase 7.1 (Module 4 Live Wiring)**: Wire live MediaPipe iris landmarks (`468–477`) and head pose from `useFaceMesh.ts` into `CandidateVideoFeed` on `/interview`.
- [ ] **Phase 7.2 (Modules 2, 3, 5, 6 Backend/DB Wiring)**: Connect `/api/sessions` MongoDB persistence so completed runs in `/interview` save to the database and populate `/` and `/reports`.
