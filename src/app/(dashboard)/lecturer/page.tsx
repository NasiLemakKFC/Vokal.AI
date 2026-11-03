"use client";

import { useState } from "react";
import Link from "next/link";

interface StarPillarDetail {
  situation: { score: number; summary: string };
  task: { score: number; summary: string };
  action: { score: number; summary: string };
  result: { score: number; summary: string };
}

interface CandidateSubmission {
  id: string;
  name: string;
  matricNo: string;
  track: string;
  date: string;
  starScore: number;
  eyeContact: number;
  wpm: number;
  fillers: string;
  postureNote: string;
  status: "Completed" | "Needs Review" | "Graded";
  recommendation: "Strong Pass" | "Progressing" | "Needs Coaching";
  transcriptExcerpt: string;
  defaultNotes: string;
  pillars: StarPillarDetail;
}

const CANDIDATES: CandidateSubmission[] = [
  {
    id: "SUB-101",
    name: "Amirul Haziq",
    matricNo: "B032110045",
    track: "Software Engineering",
    date: "2026-10-26",
    starScore: 84.0,
    eyeContact: 94.0,
    wpm: 135,
    fillers: "2 (um, actually)",
    postureNote: "Stable upright frame (0 deviations)",
    status: "Completed",
    recommendation: "Strong Pass",
    transcriptExcerpt:
      "“When our staging payment worker hit a memory spike 4 hours before release freeze, I isolated the leaky event listener using Chrome DevTools heap snapshots and shipped a bounded queue patch…”",
    defaultNotes:
      "Candidate demonstrates strong Situation and Task context. Action articulation is detailed with APM and heap snapshot references. Advised to quantify Result metrics more clearly with post-launch latency numbers.",
    pillars: {
      situation: {
        score: 90,
        summary: "Clear staging outage context and 4-hour release freeze constraint.",
      },
      task: {
        score: 85,
        summary: "Defined individual ownership of payment worker memory isolation.",
      },
      action: {
        score: 88,
        summary: "Specific debugging workflow: heap diffing, bounded queue patch, regression test.",
      },
      result: {
        score: 73,
        summary: "Stated release shipped on time; needs exact memory or latency percentage.",
      },
    },
  },
  {
    id: "SUB-102",
    name: "Nur Alia Farhana",
    matricNo: "B032110112",
    track: "Data Engineering",
    date: "2026-10-26",
    starScore: 78.5,
    eyeContact: 88.0,
    wpm: 142,
    fillers: "3 (uh, like)",
    postureNote: "Stable (minor head tilt at 02:10)",
    status: "Completed",
    recommendation: "Progressing",
    transcriptExcerpt:
      "“During the nightly warehouse ingestion, malformed UTF-8 rows caused downstream Spark jobs to fail. I added a dead-letter quarantine table and schema validator before the staging load…”",
    defaultNotes:
      "Solid technical explanation of ETL quarantine pattern. Needs stronger Result quantification (e.g., SLA recovery percentage and rows recovered per run).",
    pillars: {
      situation: {
        score: 84,
        summary: "Nightly warehouse ETL failure clearly contextualized.",
      },
      task: {
        score: 82,
        summary: "Owned schema validation and pipeline recovery.",
      },
      action: {
        score: 80,
        summary: "Implemented dead-letter quarantine table and automated alert.",
      },
      result: {
        score: 68,
        summary: "Mentioned zero failed runs afterward; add SLA uptime metric.",
      },
    },
  },
  {
    id: "SUB-103",
    name: "Muhammad Syafiq",
    matricNo: "B032110089",
    track: "Cloud & DevOps",
    date: "2026-10-25",
    starScore: 91.0,
    eyeContact: 92.0,
    wpm: 130,
    fillers: "1 (um)",
    postureNote: "Centered and steady throughout",
    status: "Graded",
    recommendation: "Strong Pass",
    transcriptExcerpt:
      "“Our manual 45-minute pre-deploy checklist was blocking daily releases. I containerized our smoke tests in GitHub Actions, cutting verification time by 78% down to 10 minutes…”",
    defaultNotes:
      "Exemplary STAR coverage across all four pillars with concrete before/after metrics (45m to 10m, 78% reduction).",
    pillars: {
      situation: {
        score: 92,
        summary: "45-minute manual regression bottleneck clearly stated.",
      },
      task: {
        score: 90,
        summary: "Automate smoke testing inside CI/CD pipeline.",
      },
      action: {
        score: 93,
        summary: "Built parallel Playwright container job with Slack rollback hooks.",
      },
      result: {
        score: 89,
        summary: "Quantified 78% time reduction and 3x deployment frequency.",
      },
    },
  },
  {
    id: "SUB-104",
    name: "Ahmad Nabil",
    matricNo: "B032110034",
    track: "AI & Machine Learning",
    date: "2026-10-25",
    starScore: 68.0,
    eyeContact: 72.0,
    wpm: 165,
    fillers: "6 (um, ah, actually)",
    postureNote: "2 slouching alerts after minute 01:45",
    status: "Needs Review",
    recommendation: "Needs Coaching",
    transcriptExcerpt:
      "“We had high latency on the inference endpoint so we tried quantizing the model weights to INT8 and adjusted batching parameters…”",
    defaultNotes:
      "Speaking pace (165 WPM) is rushed, and candidate used 'we' throughout Action without isolating personal contribution. Result metric omitted.",
    pillars: {
      situation: {
        score: 76,
        summary: "Inference endpoint latency issue stated briefly.",
      },
      task: {
        score: 70,
        summary: "Goal was sub-200ms response time, but role boundary was vague.",
      },
      action: {
        score: 66,
        summary: "Used 'we' instead of 'I'; needs clearer personal technical steps.",
      },
      result: {
        score: 60,
        summary: "Did not state final latency figure or accuracy trade-off.",
      },
    },
  },
];

export default function LecturerDashboard() {
  const [selectedId, setSelectedId] = useState<string>("SUB-101");
  const [filterTrack, setFilterTrack] = useState<string>("All");
  const [notesByCandidate, setNotesByCandidate] = useState<Record<string, string>>({
    "SUB-101": CANDIDATES[0].defaultNotes,
    "SUB-102": CANDIDATES[1].defaultNotes,
    "SUB-103": CANDIDATES[2].defaultNotes,
    "SUB-104": CANDIDATES[3].defaultNotes,
  });
  const [isAntiBiasVerified, setIsAntiBiasVerified] = useState<boolean>(true);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Space-saving collapsible dropdown states (user clicks to reveal dense text reports)
  const [openSection, setOpenSection] = useState<{
    starReport: boolean;
    telemetry: boolean;
    rubric: boolean;
  }>({
    starReport: false,
    telemetry: false,
    rubric: false,
  });

  const selectedCandidate =
    CANDIDATES.find((c) => c.id === selectedId) || CANDIDATES[0];

  const filteredCandidates =
    filterTrack === "All"
      ? CANDIDATES
      : CANDIDATES.filter((c) => c.track === filterTrack);

  const toggleSection = (key: keyof typeof openSection) => {
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveGrade = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="max-w-[1204px] mx-auto space-y-6">
      {/* ── Title Row (design-taste-frontend §4.3) ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold text-[#131416] tracking-tight leading-snug">
              Faculty Evaluation
            </h1>
            <span className="badge font-mono">BITU 3973 · Workshop II</span>
          </div>
          <p className="text-[14px] text-[#5d5f60]">
            3 of 48 assessed candidates scored below{" "}
            <span className="text-[#131416] font-mono tabular-nums font-medium">75.0%</span>{" "}
            on STAR completeness due to unquantified Result statements.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/interview"
            className="h-[32px] px-3.5 rounded-[6px] bg-white border border-[#cdced1] hover:bg-[#f4f6f8] text-[#131416] text-[13px] font-medium transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px] text-[#1b6c80]">
              videocam
            </span>
            <span>Preview Practice Room</span>
          </Link>
        </div>
      </div>

      {/* ── Cohort Summary Strip: 1 Container Split by 1px Dividers (app-screens §5) ── */}
      <section className="bg-[#f4f6f8] p-1.5 rounded-[8px] border border-[#e8eaec]">
        <div className="bg-white rounded-[6px] border border-[#e8eaec] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#e8eaec]">
          <div className="p-4">
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Candidates Assessed
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#131416] font-mono tabular-nums leading-tight">
                48
              </span>
              <span className="text-[13px] text-[#5d5f60]">/ 52 enrolled</span>
              <span className="text-[12px] text-[#1e7b4f] font-mono tabular-nums ml-auto">
                92.3%
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Cohort STAR Mean
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#1b6c80] font-mono tabular-nums leading-tight">
                80.3
              </span>
              <span className="text-[13px] text-[#5d5f60]">%</span>
              <span className="text-[12px] text-[#1e7b4f] font-mono tabular-nums ml-auto">
                +6.2% vs Sem 1
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Non-Verbal Poise
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#131416] font-mono tabular-nums leading-tight">
                86.5
              </span>
              <span className="text-[13px] text-[#5d5f60]">%</span>
              <span className="text-[12px] text-[#5d5f60] ml-auto">
                Iris &amp; head pose
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Flagged for Review
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#c4242a] font-mono tabular-nums leading-tight">
                3
              </span>
              <span className="text-[13px] text-[#5d5f60]">submissions</span>
              <span className="text-[12px] text-[#c4242a] ml-auto">
                &lt;75% STAR
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Two-Column Review Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Student Submissions Table */}
        <section className="lg:col-span-7 card !p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e8eaec] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#131416]">
                Student Submissions
              </h2>
              <p className="text-[12px] text-[#5d5f60]">
                Select a candidate to inspect their STAR report and rubric in the right panel.
              </p>
            </div>

            {/* Track Filter Pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {[
                "All",
                "Software Engineering",
                "Data Engineering",
                "Cloud & DevOps",
                "AI & Machine Learning",
              ].map((track) => (
                <button
                  key={track}
                  type="button"
                  onClick={() => setFilterTrack(track)}
                  className={`h-[26px] px-2.5 rounded-[4px] text-[11px] font-medium transition-colors cursor-pointer border ${
                    filterTrack === track
                      ? "bg-[#131416] text-white border-[#131416]"
                      : "bg-white text-[#5d5f60] border-[#e8eaec] hover:text-[#131416]"
                  }`}
                >
                  {track === "All" ? "All (4)" : track.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Table Column Headers */}
          <div className="hidden sm:grid sm:grid-cols-12 px-5 h-[34px] items-center border-b border-[#e8eaec] text-[12px] text-[#5d5f60] select-none">
            <div className="col-span-5">Candidate &amp; Track</div>
            <div className="col-span-2 text-right">STAR</div>
            <div className="col-span-3 text-right">Eye / Pace</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {/* Candidate Rows */}
          <div className="divide-y divide-[#f0f1f2]">
            {filteredCandidates.map((candidate) => {
              const isSelected = candidate.id === selectedCandidate.id;
              return (
                <div
                  key={candidate.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(candidate.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedId(candidate.id);
                    }
                  }}
                  className={`px-5 py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-0 items-center transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#eef4f6]"
                      : "bg-white hover:bg-[#f9fbfc]"
                  }`}
                >
                  {/* Candidate Identity */}
                  <div className="sm:col-span-5 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#131416] truncate">
                        {candidate.name}
                      </span>
                      <span className="text-[11px] text-[#5d5f60] font-mono tabular-nums">
                        {candidate.matricNo}
                      </span>
                    </div>
                    <div className="text-[12px] text-[#5d5f60] truncate">
                      {candidate.track} ·{" "}
                      <span className="font-mono tabular-nums">{candidate.date}</span>
                    </div>
                  </div>

                  {/* Right-aligned STAR % */}
                  <div className="sm:col-span-2 sm:text-right">
                    <span
                      className={`text-[14px] font-mono tabular-nums font-medium ${
                        candidate.starScore >= 80
                          ? "text-[#1e7b4f]"
                          : candidate.starScore >= 75
                          ? "text-[#1b6c80]"
                          : "text-[#c4242a]"
                      }`}
                    >
                      {candidate.starScore.toFixed(1)}%
                    </span>
                  </div>

                  {/* Right-aligned Eye Contact & WPM */}
                  <div className="sm:col-span-3 sm:text-right font-mono tabular-nums text-[12px] text-[#5d5f60]">
                    <span className="text-[#131416]">{candidate.eyeContact.toFixed(0)}%</span>{" "}
                    eye · <span>{candidate.wpm} WPM</span>
                  </div>

                  {/* Status Pill */}
                  <div className="sm:col-span-2 flex sm:justify-end">
                    <span
                      className={
                        candidate.status === "Graded"
                          ? "pill-positive"
                          : candidate.status === "Needs Review"
                          ? "pill-negative"
                          : "badge"
                      }
                    >
                      {candidate.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT COLUMN (5 cols): Selected Candidate Inspector with Collapsible Dropdowns */}
        <section className="lg:col-span-5 card !p-0 overflow-hidden">
          {/* Selected Candidate Header */}
          <div className="p-4 border-b border-[#e8eaec] flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#5d5f60] tabular-nums">
                  {selectedCandidate.id}
                </span>
                <span className="text-[#cdced1]">·</span>
                <span className="font-mono text-[11px] text-[#5d5f60] tabular-nums">
                  {selectedCandidate.matricNo}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-[#131416] mt-0.5">
                {selectedCandidate.name}
              </h3>
              <p className="text-[12px] text-[#5d5f60]">{selectedCandidate.track}</p>
            </div>

            <span
              className={
                selectedCandidate.recommendation === "Strong Pass"
                  ? "pill-positive"
                  : selectedCandidate.recommendation === "Needs Coaching"
                  ? "pill-negative"
                  : "pill-warning"
              }
            >
              {selectedCandidate.recommendation}
            </span>
          </div>

          {/* Compact Summary Strip (Always visible, 1 line) */}
          <div className="grid grid-cols-3 divide-x divide-[#e8eaec] border-b border-[#e8eaec] bg-[#f9fbfc] text-center py-2.5">
            <div>
              <span className="text-[11px] text-[#5d5f60] block">STAR Score</span>
              <span className="text-[15px] font-mono tabular-nums font-medium text-[#131416]">
                {selectedCandidate.starScore.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#5d5f60] block">Eye Contact</span>
              <span className="text-[15px] font-mono tabular-nums font-medium text-[#131416]">
                {selectedCandidate.eyeContact.toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#5d5f60] block">Speech Pace</span>
              <span className="text-[15px] font-mono tabular-nums font-medium text-[#131416]">
                {selectedCandidate.wpm} WPM
              </span>
            </div>
          </div>

          {/* ── Collapsible Dropdown 1: STAR Coverage & Pillar Summary Report ── */}
          <div className="border-b border-[#e8eaec]">
            <button
              type="button"
              onClick={() => toggleSection("starReport")}
              aria-expanded={openSection.starReport}
              className="w-full px-4 h-[44px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#1b6c80]">
                  fact_check
                </span>
                <span className="text-[13px] font-medium text-[#131416]">
                  STAR Report &amp; Pillar Summary
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
                <span className="font-mono tabular-nums text-[#1b6c80] font-medium">
                  {openSection.starReport ? "Hide" : "View Report"}
                </span>
                <span className="material-symbols-outlined text-[16px]">
                  {openSection.starReport ? "expand_less" : "expand_more"}
                </span>
              </div>
            </button>

            {openSection.starReport && (
              <div className="px-4 pb-4 pt-2 bg-[#f9fbfc] border-t border-[#f0f1f2] space-y-3">
                {(
                  [
                    ["Situation", selectedCandidate.pillars.situation],
                    ["Task", selectedCandidate.pillars.task],
                    ["Action", selectedCandidate.pillars.action],
                    ["Result", selectedCandidate.pillars.result],
                  ] as const
                ).map(([label, pillar]) => (
                  <div
                    key={label}
                    className="bg-white p-2.5 rounded-[6px] border border-[#e8eaec] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[#131416]">{label}</span>
                      <span
                        className={`font-mono tabular-nums font-medium ${
                          pillar.score >= 80
                            ? "text-[#1e7b4f]"
                            : pillar.score >= 70
                            ? "text-[#1b6c80]"
                            : "text-[#c4242a]"
                        }`}
                      >
                        {pillar.score}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#f0f1f2] rounded-[2px] overflow-hidden">
                      <div
                        className={`h-full ${
                          pillar.score >= 80
                            ? "bg-[#1e7b4f]"
                            : pillar.score >= 70
                            ? "bg-[#1b6c80]"
                            : "bg-[#c4242a]"
                        }`}
                        style={{ width: `${pillar.score}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-[#5d5f60] leading-normal">
                      {pillar.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Collapsible Dropdown 2: Multimodal Signals & Whisper Transcript Excerpt ── */}
          <div className="border-b border-[#e8eaec]">
            <button
              type="button"
              onClick={() => toggleSection("telemetry")}
              aria-expanded={openSection.telemetry}
              className="w-full px-4 h-[44px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#1b6c80]">
                  graphic_eq
                </span>
                <span className="text-[13px] font-medium text-[#131416]">
                  Transcript &amp; Multimodal Signals
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
                <span>{openSection.telemetry ? "Hide" : "Expand"}</span>
                <span className="material-symbols-outlined text-[16px]">
                  {openSection.telemetry ? "expand_less" : "expand_more"}
                </span>
              </div>
            </button>

            {openSection.telemetry && (
              <div className="px-4 pb-4 pt-2 bg-[#f9fbfc] border-t border-[#f0f1f2] space-y-2.5 text-[12px]">
                <div className="bg-white p-2.5 rounded-[6px] border border-[#e8eaec] space-y-1">
                  <span className="text-[11px] font-medium text-[#5d5f60] block">
                    Whisper ASR Key Excerpt
                  </span>
                  <p className="text-[#131416] leading-relaxed">
                    {selectedCandidate.transcriptExcerpt}
                  </p>
                </div>

                <div className="bg-white p-2.5 rounded-[6px] border border-[#e8eaec] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5d5f60]">Detected Disfluencies</span>
                    <span className="font-mono text-[#131416] font-medium">
                      {selectedCandidate.fillers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5d5f60]">Head Pose &amp; Posture</span>
                    <span className="text-[#131416] font-medium">
                      {selectedCandidate.postureNote}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Collapsible Dropdown 3: Supervisor Rubric Feedback & Anti-Bias Sign-Off ── */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("rubric")}
              aria-expanded={openSection.rubric}
              className="w-full px-4 h-[44px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#1b6c80]">
                  verified_user
                </span>
                <span className="text-[13px] font-medium text-[#131416]">
                  Supervisor Rubric Notes
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
                <span>{openSection.rubric ? "Hide" : "Edit Notes"}</span>
                <span className="material-symbols-outlined text-[16px]">
                  {openSection.rubric ? "expand_less" : "expand_more"}
                </span>
              </div>
            </button>

            {openSection.rubric && (
              <div className="px-4 pb-4 pt-2 bg-[#f9fbfc] border-t border-[#f0f1f2] space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="lecturer-rubric-notes"
                    className="text-[12px] font-medium text-[#131416] block"
                  >
                    Calibration &amp; Coaching Feedback
                  </label>
                  <textarea
                    id="lecturer-rubric-notes"
                    rows={3}
                    value={notesByCandidate[selectedCandidate.id] ?? ""}
                    onChange={(e) =>
                      setNotesByCandidate((prev) => ({
                        ...prev,
                        [selectedCandidate.id]: e.target.value,
                      }))
                    }
                    className="w-full text-[12px] text-[#131416] bg-white border border-[#cdced1] rounded-[6px] p-2.5 focus:outline-none focus:border-[#1b6c80] resize-none leading-relaxed"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[#5d5f60] select-none">
                  <input
                    type="checkbox"
                    checked={isAntiBiasVerified}
                    onChange={(e) => setIsAntiBiasVerified(e.target.checked)}
                    className="rounded border-[#cdced1] text-[#1b6c80] w-3.5 h-3.5"
                  />
                  <span>Verified objective scoring against BITU 3973 rubric</span>
                </label>
              </div>
            )}
          </div>

          {/* Primary Save Action Footer */}
          <div className="p-4 bg-white border-t border-[#e8eaec] flex items-center justify-between gap-3">
            <span className="text-[12px] text-[#5d5f60]">
              {isAntiBiasVerified ? "Anti-bias check verified" : "Verify rubric check above"}
            </span>
            <button
              type="button"
              onClick={handleSaveGrade}
              className="h-[32px] px-4 rounded-[6px] bg-[#131416] hover:bg-[#25272a] text-white font-medium text-[12px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] leading-none">
                {isSaved ? "check" : "save"}
              </span>
              <span>{isSaved ? "Grade Saved" : "Save Evaluation"}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
