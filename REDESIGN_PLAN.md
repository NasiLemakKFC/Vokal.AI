# Vokal.ai — Simplified Redesign Plan (handoff for the next model)

> **IF THE USER SAYS "continue":** open this file, find the first unchecked box in §5, verify the previous checked step actually landed in code (read the files), and keep going. Tick each box (`[x]`) right after finishing that step.

> Skill: `design-taste-frontend` (app-screens chapter, `framed-sheet`, light). Direction sheet: `.taste-skill/direction.json`.
> Source of truth for scope: `modules_to_be_developed.md` (6 modules). Anything not tied to a module gets cut.
> Rules: never run `next dev` / `next build` in the sandbox (Turbopack Tailwind loader needs loopback); use BypassSandbox. Keep zero UTeM/FTMK/academic wording.

## 0. Principles
1. Each page answers ONE question and shows at most ~5 data points on first view.
2. Everything detailed (STAR breakdown, fillers list, transcript, tips) sits behind a button/dropdown.
3. Only features that map to Modules 1–6 stay. Cut: weekly cadence, scoring-weights card, 3-step prep guide, KPI tab strip, cohort/hiring tables, "Pipeline: Active" chips, diagnostics extras.
4. Visual language unchanged (ground `#f9fbfc`, sheet `#fff`, accent `#1b6c80`, IBM Plex, flat cards, 1px lines). Mono only for timer/WPM/IDs (reduces the 65 `mono` lint warnings — sentence text and labels use Sans).

## 1. Shell (applies to ALL pages)
- Move `src/app/interview/` into the `(dashboard)` route group → `(dashboard)/interview/page.tsx`, so Sidebar + TopHeader wrap every page.
- Sidebar collapse: state in `(dashboard)/layout.tsx` (`collapsed`, persisted in `localStorage["vokalai_sidebar"]`).
  - Expanded 228px (mark + name + labels); collapsed 56px icon rail (mark only, icons with `title` tooltips). Width transition on `width` only. Toggle button (`left_panel_close` / `left_panel_open`) at sidebar bottom + `[` keyboard shortcut. Mobile (<lg): off-canvas drawer opened from TopHeader hamburger.
- Nav (3 items, no sections): **Home** `/`, **Practice** `/interview`, **Reports** `/reports` (Module 6). Remove "Question Bank", "STAR Framework Guide", Hiring Review.
- TopHeader: remove mode-switcher pill group and breadcrumb noise. Keep: page title (left), privacy note "Video stays on your device" (right, small), avatar chip.
- Remove the user card ("Amirul Haziq / SWE Track · Pro Studio") from the sidebar bottom → just avatar in header.
- Practice room: delete the `SessionHeader` "← Overview" back button; sidebar replaces it. Keep timer + End session inside the page toolbar (see §3). Check `ControlDock` positioning (`fixed`/`sticky`) so it centers within the sheet and respects the sidebar width.

## 2. Home `/` (question: "How did my last practice go, and what do I do next?")
Keep:
- Title "Home" + primary button **Start practice**.
- One summary line: last score + weakest pillar (e.g. "Last session 84% — Result needs a number").
- 3 figures in one hairline strip: **STAR score**, **Eye contact**, **Fillers/min** (latest session, with good/bad colour on delta only).
- **Recent sessions** list (3–5 rows: topic, role, date, score). Each row has a **STAR report ▾** button → expands S/T/A/R bars + coach takeaway (already built; keep).
Remove: 3-step guide, KPI tab panels, Weekly Practice Cadence (**the card in the screenshot — delete it**), Vokal.ai Scoring Weights, "Evaluator view" link, freshness stamp.

## 3. Practice `/interview` (Modules 1, 2, 4, 5 live; question: "Am I answering well right now?")
Layout: 2 columns (5/7) → simplify to video-dominant.
- Toolbar row (inside sheet, not a separate header): `Q2/5 · Junior Software Engineer`, timer (mono), **End session**.
- Left: Question card (Module 1) with **Rubric keywords ▾** (keep). **STAR bar** = 4 chips S·T·A·R lit as detected, click expands one-line summary each (Module 3, keep collapsed). One-line live tip replaces `LiveCoachingTip` card (tip text only appears on click of "Tip ▾" — keep existing collapsible).
- Right: Webcam with only two HUD chips by default — **eye contact %** and **posture alert** (Module 4 nudges). WPM + fillers (Module 5) move into one small chip row below video; `DiagnosticsBar` (volume/clarity/confidence) → delete or fold into a "Signals ▾" dropdown.
- ControlDock: mic, camera, start/stop, settings only.
- Remove: "Pipeline: Active/Standby" chip, Whisper kHz/dBFS readout, waveform decoration (keep simple level bar only while recording).

## 4. Reports `/reports` (Module 6; question: "What should I improve?")
Replace `(dashboard)/lecturer/page.tsx` (hiring/cohort screen is not in the module list) with a single-session report:
- Header: session picker (select) + overall score big figure.
- Row of 4 score tiles in one hairline strip: Content (Module 3), Delivery (Module 5), Eye contact/posture (Module 4), Overall.
- **Top 3 improvements** list (max 3 lines).
- Dropdown sections, all closed by default: **STAR breakdown ▾**, **Speech details ▾** (fillers, pauses, WPM), **Transcript ▾** (Module 2).
- Delete routes/links to `/lecturer`; keep redirect `/lecturer → /reports` in `next.config.ts` `redirects()` (preserve existing config incl. `experimental.agentUpgrade` and `turbopack.rules`).

## 5. Execution order (checklist)
- [x] 1. Move `interview` into `(dashboard)`; delete `SessionHeader`'s back button / replace with in-page toolbar. (SessionHeader.tsx + DiagnosticsBar.tsx deleted; shared mock data in `src/lib/mockSessions.ts`)
- [x] 2. Build collapsible Sidebar + layout state + mobile drawer; trim TopHeader.
- [x] 3. Simplify Home (§2); delete cadence/weights/guide code.
- [x] 4. Simplify Practice (§3); trim HUD, DiagnosticsBar, ControlDock; verify dock vs sidebar width.
- [x] 5. Create `/reports`, remove `/lecturer`, add redirect (§4).
- [x] 6. Replace `font-mono` on prose/labels; keep on timer/WPM/IDs only. Drop `shadow-lg` in `ControlDock` (use 1px border) except for the device modal.
- [x] 7. Grep: no `lecturer`, `Hiring`, `cadence`, `Pipeline`, `UTeM`, `FTMK`, `BITU`.
- [x] 8. Run `node C:\Users\USER\.gemini\config\skills\design-taste-frontend\scripts\lint.mjs --app "c:\Users\USER\Desktop\WORKSHOP 2\frontend\src"` (0 FAIL, warnings should drop), `npm run lint`, `npm run build` (BypassSandbox). Then ask the user to restart `npm run dev` (stop old PID on :3000) and hard-refresh.
- [x] 9. Update `TASK_LIST.md` and `AGENTS.md` repo-structure section (routes/components changed).

## 6. Decisions I made (change if you disagree)
- Hiring/cohort review page removed, replaced by a personal Reports page, since the module list has no reviewer role.
- Sidebar collapses to an icon rail, not fully hidden.

