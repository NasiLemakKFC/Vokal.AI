"use client";

import { useState } from "react";
import Link from "next/link";

interface StarBreakdown {
  situation: { score: number; note: string };
  task: { score: number; note: string };
  action: { score: number; note: string };
  result: { score: number; note: string };
  coachingSummary: string;
  fillers: string[];
}

interface PracticeSessionRow {
  id: string;
  date: string;
  role: string;
  questionTopic: string;
  duration: string;
  starScore: number;
  eyeContact: number;
  wpm: number;
  status: "Evaluated" | "Needs Result Metric" | "Strong Pass";
  report: StarBreakdown;
}

const RECENT_SESSIONS: PracticeSessionRow[] = [
  {
    id: "SES-042",
    date: "2026-10-26",
    role: "Junior Software Engineer",
    questionTopic: "Production Bug Diagnosis Under Deadline",
    duration: "03:42",
    starScore: 84.0,
    eyeContact: 94.0,
    wpm: 135,
    status: "Strong Pass",
    report: {
      situation: {
        score: 92,
        note: "Clearly framed staging outage 4 hours before release freeze.",
      },
      task: {
        score: 88,
        note: "Defined personal responsibility for isolating memory leak in payment worker.",
      },
      action: {
        score: 86,
        note: "Detailed APM trace inspection, heap snapshot diffing, and hotfix rollback plan.",
      },
      result: {
        score: 70,
        note: "Mentioned on-time launch, but omitted exact latency reduction percentage.",
      },
      coachingSummary:
        "Strong technical narrative. Quantify the post-deployment impact (e.g., error rate dropped from 4.2% to 0.1%) to raise the Result pillar above 85%.",
      fillers: ["um (2)", "actually (1)"],
    },
  },
  {
    id: "SES-039",
    date: "2026-10-24",
    role: "Backend Developer",
    questionTopic: "Resolving API Contract Disagreement Across Teams",
    duration: "04:05",
    starScore: 76.5,
    eyeContact: 89.5,
    wpm: 142,
    status: "Needs Result Metric",
    report: {
      situation: {
        score: 85,
        note: "Explained mobile vs. backend schema mismatch during sprint integration.",
      },
      task: {
        score: 82,
        note: "Owned OpenAPI spec alignment without delaying mobile release.",
      },
      action: {
        score: 78,
        note: "Walked through versioned endpoint adapter and contract test suite.",
      },
      result: {
        score: 61,
        note: "Concluded abruptly without stating team velocity or bug reduction outcome.",
      },
      coachingSummary:
        "Spend the final 30 seconds explicitly stating measurable outcomes: zero breaking changes across 3 subsequent releases.",
      fillers: ["uh (3)", "like (2)"],
    },
  },
  {
    id: "SES-035",
    date: "2026-10-21",
    role: "Cloud & DevOps Intern",
    questionTopic: "Automating Repetitive Deployment Verification",
    duration: "03:18",
    starScore: 88.0,
    eyeContact: 91.0,
    wpm: 128,
    status: "Strong Pass",
    report: {
      situation: {
        score: 90,
        note: "Described manual 45-minute regression checklist blocking daily deploys.",
      },
      task: {
        score: 89,
        note: "Tasked with building automated smoke-test stage in GitHub Actions.",
      },
      action: {
        score: 88,
        note: "Implemented containerized Playwright health checks and Slack webhook alerts.",
      },
      result: {
        score: 85,
        note: "Quantified 78% reduction in verification time (45m down to 10m).",
      },
      coachingSummary:
        "Well-balanced STAR response with clear before/after metrics and steady 128 WPM pacing.",
      fillers: ["um (1)"],
    },
  },
  {
    id: "SES-031",
    date: "2026-10-18",
    role: "Data Engineering Associate",
    questionTopic: "Handling Corrupted Upstream CSV Ingestion",
    duration: "03:55",
    starScore: 77.5,
    eyeContact: 93.5,
    wpm: 139,
    status: "Evaluated",
    report: {
      situation: {
        score: 84,
        note: "Identified malformed UTF-8 rows breaking nightly ETL job.",
      },
      task: {
        score: 80,
        note: "Needed schema validation layer before warehouse load.",
      },
      action: {
        score: 79,
        note: "Built quarantine dead-letter table and schema validator.",
      },
      result: {
        score: 67,
        note: "Stated pipeline stability improved; add SLA uptime figure.",
      },
      coachingSummary:
        "Good eye contact (93.5%). Keep Action concise so you have time to state the 99.8% SLA recovery.",
      fillers: ["ah (2)", "actually (2)"],
    },
  },
];

const PREP_STEPS = [
  {
    id: "role",
    title: "Select Role & Malaysian Tech Track",
    shortMeta: "Software Engineering · Junior Role",
    detail:
      "Tailors behavioral prompts to Malaysian tech employers (FinTech, GLC digital units, SaaS startups) with role-specific keyword rubrics.",
    actionLabel: "Configure Track",
    href: "/interview",
  },
  {
    id: "session",
    title: "Run Multimodal STAR Practice",
    shortMeta: "Browser MediaPipe Vision + Whisper ASR",
    detail:
      "Tracks 478 facial landmarks client-side for eye contact and head pose while analyzing speech pacing (WPM), disfluencies, and S/T/A/R coverage.",
    actionLabel: "Enter Practice Room",
    href: "/interview",
  },
  {
    id: "review",
    title: "Calibrate with Faculty Rubric",
    shortMeta: "BITU 3973 Anti-Bias Evaluation",
    detail:
      "Compares your self-practice telemetry against objective STAR coverage weights and supervisor rubric notes before final assessment.",
    actionLabel: "Open Lecturer View",
    href: "/lecturer",
  },
];

const WEEK_CADENCE = [
  { day: "Mon", minutes: 18, done: true },
  { day: "Tue", minutes: 12, done: true },
  { day: "Wed", minutes: 0, done: false },
  { day: "Thu", minutes: 22, done: true },
  { day: "Fri", minutes: 0, done: false },
  { day: "Sat", minutes: 15, done: true, today: true },
  { day: "Sun", minutes: 0, done: false },
];

export default function Dashboard() {
  // Only expand STAR report when user explicitly clicks a session's dropdown button
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  // Collapsible workflow guide drawer (closed by default to save vertical space)
  const [showWorkflowGuide, setShowWorkflowGuide] = useState<boolean>(false);
  // Selected KPI tab for the pillar breakdown strip
  const [selectedMetricTab, setSelectedMetricTab] = useState<"star" | "vision" | "speech">("star");

  const toggleSessionReport = (id: string) => {
    setExpandedSessionId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-[1204px] mx-auto space-y-6">
      {/* ── Title Row (design-taste-frontend §4.3: 22px noun h1, one finding, primary action) ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold text-[#131416] tracking-tight leading-snug">
              Overview
            </h1>
            <span className="text-[12px] text-[#5d5f60] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e7b4f]" />
              Updated 26 Oct, 14:35
            </span>
          </div>
          <p className="text-[14px] text-[#5d5f60]">
            Result quantification averaged{" "}
            <span className="text-[#131416] font-medium font-mono tabular-nums">70.8%</span>{" "}
            across 4 recent sessions —{" "}
            <span className="text-[#c4242a] font-medium font-mono tabular-nums">
              −16.9 pts
            </span>{" "}
            below your Situation baseline (87.7%).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowWorkflowGuide((prev) => !prev)}
            aria-expanded={showWorkflowGuide}
            className="h-[32px] px-3 rounded-[6px] bg-white border border-[#cdced1] text-[13px] font-medium text-[#131416] hover:bg-[#f4f6f8] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>3-Step Prep Guide</span>
            <span className="material-symbols-outlined text-[16px] text-[#5d5f60]">
              {showWorkflowGuide ? "expand_less" : "expand_more"}
            </span>
          </button>

          <Link
            href="/interview"
            className="h-[32px] px-3.5 rounded-[6px] bg-[#131416] text-white text-[13px] font-medium hover:bg-[#25272a] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">
              videocam
            </span>
            <span>Start Mock Interview</span>
          </Link>
        </div>
      </div>

      {/* ── Collapsible 3-Step Getting Started Strip (Only shown when clicked to save space) ── */}
      {showWorkflowGuide && (
        <section
          aria-label="Preparation Workflow Guide"
          className="bg-[#f4f6f8] p-1.5 rounded-[8px] border border-[#e8eaec]"
        >
          <div className="bg-white rounded-[6px] border border-[#e8eaec] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e8eaec]">
            {PREP_STEPS.map((step, idx) => (
              <div key={step.id} className="p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium text-[#131416]">
                      {idx + 1}. {step.title}
                    </span>
                    <Link
                      href={step.href}
                      className="text-[12px] font-medium text-[#1b6c80] hover:underline flex items-center gap-0.5"
                    >
                      <span>{step.actionLabel}</span>
                      <span className="material-symbols-outlined text-[14px]">
                        arrow_outward
                      </span>
                    </Link>
                  </div>
                  <p className="text-[12px] text-[#5d5f60]">{step.shortMeta}</p>
                  <p className="text-[13px] text-[#45474a] leading-relaxed pt-1">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Framed-Sheet Usage Tray: 4-Cell Divided KPI Strip + Interactive Pillar Breakdown ── */}
      <section className="bg-[#f4f6f8] p-1.5 rounded-[8px] border border-[#e8eaec] space-y-1.5">
        {/* 4 Equal KPI Cells split by 1px dividers (app-screens §5) */}
        <div className="bg-white rounded-[6px] border border-[#e8eaec] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#e8eaec]">
          <button
            type="button"
            onClick={() => setSelectedMetricTab("star")}
            className={`p-4 text-left transition-colors cursor-pointer relative ${
              selectedMetricTab === "star" ? "bg-white" : "hover:bg-[#f9fbfc]"
            }`}
          >
            {selectedMetricTab === "star" && (
              <span className="absolute inset-x-0 top-0 h-[2px] bg-[#1b6c80]" />
            )}
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Avg. STAR Coverage
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#131416] font-mono tabular-nums leading-tight">
                81.5
              </span>
              <span className="text-[13px] text-[#5d5f60]">%</span>
              <span className="text-[12px] text-[#1e7b4f] font-mono tabular-nums ml-auto">
                +6.2% vs prior 4
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMetricTab("vision")}
            className={`p-4 text-left transition-colors cursor-pointer relative ${
              selectedMetricTab === "vision" ? "bg-white" : "hover:bg-[#f9fbfc]"
            }`}
          >
            {selectedMetricTab === "vision" && (
              <span className="absolute inset-x-0 top-0 h-[2px] bg-[#1b6c80]" />
            )}
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Eye Contact Stability
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#131416] font-mono tabular-nums leading-tight">
                92.0
              </span>
              <span className="text-[13px] text-[#5d5f60]">%</span>
              <span className="text-[12px] text-[#1e7b4f] font-mono tabular-nums ml-auto">
                +3.5% vs prior 4
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMetricTab("speech")}
            className={`p-4 text-left transition-colors cursor-pointer relative ${
              selectedMetricTab === "speech" ? "bg-white" : "hover:bg-[#f9fbfc]"
            }`}
          >
            {selectedMetricTab === "speech" && (
              <span className="absolute inset-x-0 top-0 h-[2px] bg-[#1b6c80]" />
            )}
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Speech Pace
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#131416] font-mono tabular-nums leading-tight">
                136
              </span>
              <span className="text-[13px] text-[#5d5f60]">WPM</span>
              <span className="text-[12px] text-[#5d5f60] font-mono tabular-nums ml-auto">
                125–150 target
              </span>
            </div>
          </button>

          <div className="p-4 text-left">
            <div className="text-[13px] font-medium text-[#5d5f60]">
              Sessions Completed
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-normal text-[#131416] font-mono tabular-nums leading-tight">
                4
              </span>
              <span className="text-[13px] text-[#5d5f60]">of 5 required</span>
              <span className="text-[12px] text-[#5d5f60] font-mono tabular-nums ml-auto">
                14m 55s total
              </span>
            </div>
          </div>
        </div>

        {/* Contextual Breakdown Strip Controlled by KPI Selection */}
        <div className="bg-white rounded-[6px] border border-[#e8eaec] p-4">
          {selectedMetricTab === "star" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[#131416]">
                  STAR Component Coverage vs. 80.0% Rubric Target
                </span>
                <span className="text-[12px] text-[#5d5f60]">
                  Tick mark indicates faculty minimum threshold (80%)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: "Situation", value: 87.8, target: 80, ok: true },
                  { label: "Task", value: 84.8, target: 80, ok: true },
                  { label: "Action", value: 82.8, target: 80, ok: true },
                  { label: "Result", value: 70.8, target: 80, ok: false },
                ].map((pillar) => (
                  <div key={pillar.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#131416] font-medium">{pillar.label}</span>
                      <span
                        className={`font-mono tabular-nums font-medium ${
                          pillar.ok ? "text-[#131416]" : "text-[#c4242a]"
                        }`}
                      >
                        {pillar.value.toFixed(1)}%
                      </span>
                    </div>
                    <div className="relative h-2 bg-[#f0f1f2] rounded-[2px] overflow-hidden">
                      <div
                        className={`h-full ${
                          pillar.ok ? "bg-[#1b6c80]" : "bg-[#c4242a]"
                        }`}
                        style={{ width: `${pillar.value}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-[1.5px] bg-[#131416]"
                        style={{ left: `${pillar.target}%` }}
                        title="80% Target"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedMetricTab === "vision" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[13px] font-medium text-[#131416]">
                  Client-Side MediaPipe Iris &amp; Head Pose Telemetry
                </span>
                <p className="text-[12px] text-[#5d5f60]">
                  Iris gaze vector maintained within 12° of camera axis for 92.0% of speaking duration. Minor slouching detected after minute 02:30.
                </p>
              </div>
              <div className="flex items-center gap-6 shrink-0 font-mono tabular-nums text-[13px]">
                <div>
                  <span className="text-[#5d5f60] block text-[11px] font-sans">Gaze Lock</span>
                  <span className="text-[#131416] font-medium">92.0%</span>
                </div>
                <div>
                  <span className="text-[#5d5f60] block text-[11px] font-sans">Head Pitch</span>
                  <span className="text-[#131416] font-medium">−2.4° (Level)</span>
                </div>
                <div>
                  <span className="text-[#5d5f60] block text-[11px] font-sans">Posture Alerts</span>
                  <span className="text-[#92400e] font-medium">1 event</span>
                </div>
              </div>
            </div>
          )}

          {selectedMetricTab === "speech" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[13px] font-medium text-[#131416]">
                  Whisper ASR Fluency &amp; Disfluency Distribution
                </span>
                <p className="text-[12px] text-[#5d5f60]">
                  Speaking rate stays inside the 125–150 WPM optimal band. Disfluencies cluster during transition from Action to Result.
                </p>
              </div>
              <div className="flex items-center gap-6 shrink-0 font-mono tabular-nums text-[13px]">
                <div>
                  <span className="text-[#5d5f60] block text-[11px] font-sans">Avg Pace</span>
                  <span className="text-[#131416] font-medium">136 WPM</span>
                </div>
                <div>
                  <span className="text-[#5d5f60] block text-[11px] font-sans">Filler Rate</span>
                  <span className="text-[#131416] font-medium">2.4 /min</span>
                </div>
                <div>
                  <span className="text-[#5d5f60] block text-[11px] font-sans">Top Fillers</span>
                  <span className="text-[#5d5f60] font-sans">&ldquo;um&rdquo;, &ldquo;actually&rdquo;</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Main Two-Column Grid: Recent Sessions with Collapsible STAR Reports (8 cols) + Cadence (4 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 8 COLS: Recent Sessions Table with On-Click STAR Report Dropdowns */}
        <section className="lg:col-span-8 card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e8eaec] flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#131416]">
                Recent Practice Runs
              </h2>
              <p className="text-[12px] text-[#5d5f60]">
                Click <span className="text-[#131416] font-medium">STAR Report</span> on any session to expand its pillar breakdown and AI summary.
              </p>
            </div>
            <span className="text-[12px] text-[#5d5f60] font-mono tabular-nums">
              4 sessions
            </span>
          </div>

          {/* Table Header (app-screens §7.2: 12px grey sentence-case headers, right-aligned numbers) */}
          <div className="hidden sm:grid sm:grid-cols-12 px-5 h-[36px] items-center border-b border-[#e8eaec] text-[12px] text-[#5d5f60] select-none">
            <div className="col-span-5">Session &amp; Prompt</div>
            <div className="col-span-2 text-right">STAR Score</div>
            <div className="col-span-2 text-right">Eye / Pace</div>
            <div className="col-span-3 text-right">Report Summary</div>
          </div>

          <div className="divide-y divide-[#f0f1f2]">
            {RECENT_SESSIONS.map((session) => {
              const isExpanded = expandedSessionId === session.id;
              return (
                <div key={session.id} className="transition-colors">
                  {/* Primary Compact Row */}
                  <div
                    className={`px-5 py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-0 items-center ${
                      isExpanded ? "bg-[#f9fbfc]" : "hover:bg-[#f9fbfc]"
                    }`}
                  >
                    {/* Identity Column */}
                    <div className="sm:col-span-5 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-[#5d5f60] tabular-nums">
                          {session.id}
                        </span>
                        <span className="text-[14px] font-medium text-[#131416] truncate">
                          {session.questionTopic}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#5d5f60] flex items-center gap-2 mt-0.5">
                        <span>{session.role}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{session.date}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{session.duration}</span>
                      </div>
                    </div>

                    {/* Right-aligned STAR Score */}
                    <div className="sm:col-span-2 sm:text-right flex sm:block items-center justify-between">
                      <span className="sm:hidden text-[12px] text-[#5d5f60]">STAR Score:</span>
                      <div>
                        <span
                          className={`text-[14px] font-mono tabular-nums font-medium ${
                            session.starScore >= 80
                              ? "text-[#1e7b4f]"
                              : "text-[#92400e]"
                          }`}
                        >
                          {session.starScore.toFixed(1)}%
                        </span>
                        <span className="block text-[11px] text-[#5d5f60]">
                          {session.status}
                        </span>
                      </div>
                    </div>

                    {/* Right-aligned Eye Contact & WPM */}
                    <div className="sm:col-span-2 sm:text-right flex sm:block items-center justify-between">
                      <span className="sm:hidden text-[12px] text-[#5d5f60]">Telemetry:</span>
                      <div>
                        <span className="text-[13px] font-mono tabular-nums text-[#131416]">
                          {session.eyeContact.toFixed(0)}%
                        </span>
                        <span className="text-[12px] text-[#5d5f60]"> eye</span>
                        <span className="block text-[12px] font-mono tabular-nums text-[#5d5f60]">
                          {session.wpm} WPM
                        </span>
                      </div>
                    </div>

                    {/* Action Column: Dropdown Trigger Button to Show/Hide Full STAR Report */}
                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleSessionReport(session.id)}
                        aria-expanded={isExpanded}
                        className={`h-[30px] px-2.5 rounded-[6px] text-[12px] font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                          isExpanded
                            ? "bg-[#131416] text-white border-[#131416]"
                            : "bg-white text-[#131416] border-[#cdced1] hover:bg-[#f4f6f8]"
                        }`}
                      >
                        <span>{isExpanded ? "Hide STAR Report" : "STAR Report"}</span>
                        <span className="material-symbols-outlined text-[15px] leading-none">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible STAR Summary & Pillar Breakdown Drawer */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-2 bg-[#f9fbfc] border-t border-[#f0f1f2] space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {(
                          [
                            ["Situation", session.report.situation],
                            ["Task", session.report.task],
                            ["Action", session.report.action],
                            ["Result", session.report.result],
                          ] as const
                        ).map(([label, item]) => (
                          <div
                            key={label}
                            className="bg-white p-3 rounded-[6px] border border-[#e8eaec] space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-medium text-[#131416]">
                                {label}
                              </span>
                              <span
                                className={`text-[12px] font-mono tabular-nums font-medium ${
                                  item.score >= 80
                                    ? "text-[#1e7b4f]"
                                    : "text-[#c4242a]"
                                }`}
                              >
                                {item.score}%
                              </span>
                            </div>
                            <p className="text-[12px] text-[#5d5f60] leading-normal">
                              {item.note}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white p-3 rounded-[6px] border border-[#e8eaec] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-medium text-[#5d5f60]">
                            AI Coach Takeaway &amp; Disfluency Log
                          </span>
                          <p className="text-[13px] text-[#131416]">
                            {session.report.coachingSummary}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="badge font-mono">
                            Fillers: {session.report.fillers.join(", ")}
                          </span>
                          <Link
                            href="/interview"
                            className="h-[28px] px-2.5 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] inline-flex items-center gap-1"
                          >
                            <span>Retry Prompt</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT 4 COLS: Weekly Practice Cadence + Compact Rubric Reference */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Weekly Cadence Card */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#131416]">
                Weekly Practice Cadence
              </h2>
              <span className="text-[12px] text-[#5d5f60] font-mono tabular-nums">
                4 of 7 days · 67 mins
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_CADENCE.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] text-[#5d5f60]">{d.day}</span>
                  <div
                    className={`w-full h-9 rounded-[6px] border flex items-center justify-center font-mono text-[11px] tabular-nums ${
                      d.done
                        ? "bg-[#eef4f6] border-[#b8d4dc] text-[#134e5e] font-medium"
                        : "bg-[#f9fbfc] border-[#e8eaec] text-[#5d5f60]"
                    } ${d.today ? "ring-1 ring-[#1b6c80]" : ""}`}
                  >
                    {d.done ? `${d.minutes}m` : "0"}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#f0f1f2] flex items-center justify-between text-[12px]">
              <span className="text-[#5d5f60]">Target before faculty grading</span>
              <span className="font-mono tabular-nums text-[#131416] font-medium">
                1 session remaining
              </span>
            </div>
          </div>

          {/* Faculty Rubric Quick Check */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#131416]">
                BITU 3973 Evaluation Weights
              </h2>
              <Link
                href="/lecturer"
                className="text-[12px] font-medium text-[#1b6c80] hover:underline"
              >
                Faculty View
              </Link>
            </div>

            <div className="divide-y divide-[#f0f1f2] text-[13px]">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5d5f60]">STAR Structure Completeness</span>
                <span className="font-mono tabular-nums text-[#131416] font-medium">40%</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5d5f60]">Technical Keyword Relevance</span>
                <span className="font-mono tabular-nums text-[#131416] font-medium">25%</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5d5f60]">Speech Pace &amp; Fluency</span>
                <span className="font-mono tabular-nums text-[#131416] font-medium">20%</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5d5f60]">Eye Contact &amp; Head Pose</span>
                <span className="font-mono tabular-nums text-[#131416] font-medium">15%</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
