"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  computeAnswerMetrics,
  computeSessionMetrics,
  starCount,
  type SavedAnswer,
  type SavedSession,
} from "@/lib/nlp/sessionStore";
import type { StarKey } from "@/lib/nlp/types";

export type AnalysisModalPhase = "closed" | "analyzing" | "review";

export type AnalysisSubStage =
  | "speech_transcribe"
  | "speech_fluency"
  | "nlp_star"
  | "vision_merge"
  | "done";

export interface AnalysisQueueItem {
  questionIndex: number;
  question: string;
  hasAudio: boolean;
  durationSec: number;
  status: "pending" | "analyzing" | "done" | "error" | "skipped";
  subStage: AnalysisSubStage;
  errorMessage?: string;
  result?: SavedAnswer;
}

export interface SessionAnalysisModalProps {
  phase: AnalysisModalPhase;
  items: AnalysisQueueItem[];
  isCompleting: boolean;
  completedSession: SavedSession | null;
  onRetryItem: (queueIndex: number) => void;
  onSkipItem: (queueIndex: number) => void;
  onCancelAnalysis: () => void;
  onCloseReview: () => void;
  onStartNewSession: () => void;
  onViewFullReport: (sessionId: string) => void;
}

const STAR_META: { key: StarKey; letter: string; label: string }[] = [
  { key: "situation", letter: "S", label: "Situation" },
  { key: "task", letter: "T", label: "Task" },
  { key: "action", letter: "A", label: "Action" },
  { key: "result", letter: "R", label: "Result" },
];

const SUB_STAGE_ORDER: Exclude<AnalysisSubStage, "done">[] = [
  "speech_transcribe",
  "speech_fluency",
  "nlp_star",
  "vision_merge",
];

const SUB_STAGE_PROGRESS: Record<AnalysisSubStage, number> = {
  speech_transcribe: 0.2,
  speech_fluency: 0.5,
  nlp_star: 0.78,
  vision_merge: 0.94,
  done: 1,
};

function scoreTone(score: number): string {
  return score >= 80
    ? "text-[#1e7b4f]"
    : score >= 70
      ? "text-[#92400e]"
      : "text-[#c4242a]";
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

function targetLabel(session: SavedSession): string {
  if (session.mode === "general") return "General Interview";
  if (session.company.trim()) return `${session.company.trim()} · ${session.role}`;
  return session.role;
}

function getSubStageSteps(hasAudio: boolean): {
  key: Exclude<AnalysisSubStage, "done">;
  moduleLabel: string;
  description: string;
}[] {
  return [
    {
      key: "speech_transcribe",
      moduleLabel: "Module 2 · Speech-to-Text",
      description: hasAudio
        ? "Transcribing audio with Whisper…"
        : "Reading typed transcript…",
    },
    {
      key: "speech_fluency",
      moduleLabel: "Module 5 · Speech Fluency",
      description: "Measuring pace, filler words & pauses…",
    },
    {
      key: "nlp_star",
      moduleLabel: "Module 3 · STAR & Keywords",
      description: "Classifying S / T / A / R & role keywords…",
    },
    {
      key: "vision_merge",
      moduleLabel: "Module 4 · Visual Presence",
      description: "Merging eye contact & posture summary…",
    },
  ];
}

function AnalyzingView({
  items,
  isCompleting,
  onRetryItem,
  onSkipItem,
  onCancelAnalysis,
}: {
  items: AnalysisQueueItem[];
  isCompleting: boolean;
  onRetryItem: (queueIndex: number) => void;
  onSkipItem: (queueIndex: number) => void;
  onCancelAnalysis: () => void;
}) {
  const totalCount = Math.max(1, items.length);
  const finishedCount = items.filter(
    (it) => it.status === "done" || it.status === "skipped"
  ).length;
  const activeItem = items.find((it) => it.status === "analyzing");
  const errorIndex = items.findIndex((it) => it.status === "error");
  const errorItem = errorIndex >= 0 ? items[errorIndex] : null;

  const activeFraction = activeItem ? SUB_STAGE_PROGRESS[activeItem.subStage] : 0;
  const progressPct = isCompleting
    ? 100
    : Math.min(100, Math.round(((finishedCount + activeFraction) / totalCount) * 100));

  return (
    <motion.div
      key="analyzing-card"
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="w-full max-w-[560px] rounded-[12px] bg-white border border-[#e8eaec] shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e8eaec] flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative w-9 h-9 rounded-[8px] bg-[#eef4f6] border border-[#b8d4dc] flex items-center justify-center shrink-0">
            {!errorItem && !isCompleting && (
              <span className="absolute inset-0 rounded-[8px] bg-[#1b6c80]/15 animate-ping" />
            )}
            <span className="material-symbols-outlined text-[20px] text-[#1b6c80] relative">
              {errorItem ? "error_outline" : isCompleting ? "check_circle" : "graphic_eq"}
            </span>
          </div>
          <div className="min-w-0">
            <h2
              id="analysis-modal-title"
              className="text-[16px] font-semibold text-[#131416] leading-snug"
            >
              {errorItem
                ? "Analysis paused on an answer"
                : isCompleting
                  ? "Analysis complete"
                  : "Analyzing your answers"}
            </h2>
            <p className="text-[12.5px] text-[#5d5f60] mt-0.5">
              {errorItem
                ? "Choose how to continue below."
                : "Please stay on this screen — answers are being evaluated one by one."}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec] text-[12px] font-medium text-[#131416] tabular-nums shrink-0">
          {finishedCount} / {items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-[#f0f1f2] overflow-hidden">
        <motion.div
          className={`h-full ${errorItem ? "bg-[#c4242a]" : isCompleting ? "bg-[#1e7b4f]" : "bg-[#1b6c80]"}`}
          initial={{ width: "0%" }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      {/* 1-by-1 Answer Queue */}
      <div className="p-5 space-y-2.5 max-h-[55vh] overflow-y-auto">
        {items.map((item, idx) => {
          const isAnalyzing = item.status === "analyzing";
          const isDone = item.status === "done";
          const isError = item.status === "error";
          const isSkipped = item.status === "skipped";

          const containerStyle = isError
            ? "border-[#f5c2c7] bg-[#fff5f5]"
            : isAnalyzing
              ? "border-[#1b6c80] bg-[#f4f9fb]"
              : isDone
                ? "border-[#b5e8c5] bg-[#f7fcf9]"
                : "border-[#e8eaec] bg-[#f9fbfc]";

          const steps = getSubStageSteps(item.hasAudio);
          const currentStepIdx =
            item.subStage === "done"
              ? steps.length
              : SUB_STAGE_ORDER.indexOf(item.subStage);

          const answerMetrics = item.result ? computeAnswerMetrics(item.result) : null;

          return (
            <motion.div
              key={item.questionIndex}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              className={`rounded-[8px] border p-3.5 transition-colors ${containerStyle}`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-[5px] text-[11.5px] font-semibold tabular-nums shrink-0 ${
                      isDone
                        ? "bg-[#dcfae5] text-[#04250e]"
                        : isAnalyzing
                          ? "bg-[#1b6c80] text-white"
                          : isError
                            ? "bg-[#ffedea] text-[#831c1e]"
                            : "bg-[#ebedee] text-[#353736]"
                    }`}
                  >
                    Q{item.questionIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#131416] truncate">
                      {item.question}
                    </p>
                    <p className="text-[11.5px] text-[#5d5f60] mt-0.5 tabular-nums">
                      {item.hasAudio
                        ? `Audio · ${formatDuration(item.durationSec)}`
                        : "Text transcript"}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-0.5 rounded-[4px] ${
                    isDone
                      ? "bg-[#dcfae5] text-[#04250e]"
                      : isAnalyzing
                        ? "bg-[#e6f2f5] text-[#134e5e]"
                        : isError
                          ? "bg-[#ffedea] text-[#831c1e]"
                          : isSkipped
                            ? "bg-[#ebedee] text-[#5d5f60]"
                            : "bg-[#ebedee] text-[#5d5f60]"
                  }`}
                >
                  {isDone && (
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  )}
                  {isAnalyzing && (
                    <span className="w-2 h-2 rounded-full bg-[#1b6c80] animate-pulse" />
                  )}
                  {isError && (
                    <span className="material-symbols-outlined text-[14px]">error</span>
                  )}
                  {isDone
                    ? "Done"
                    : isAnalyzing
                      ? "Analyzing"
                      : isError
                        ? "Failed"
                        : isSkipped
                          ? "Skipped"
                          : "Waiting"}
                </span>
              </div>

              {/* Active 4-module sub-stage checklist */}
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 pt-2.5 border-t border-[#d8e9ee] space-y-1.5"
                >
                  {steps.map((step, sIdx) => {
                    const stepDone = sIdx < currentStepIdx;
                    const stepActive = sIdx === currentStepIdx;
                    return (
                      <div key={step.key} className="flex items-center gap-2 text-[12px]">
                        {stepDone ? (
                          <span className="material-symbols-outlined text-[15px] text-[#1e7b4f] shrink-0">
                            check_circle
                          </span>
                        ) : stepActive ? (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-[#1b6c80] border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#cdced1]" />
                          </span>
                        )}
                        <span
                          className={`font-medium ${
                            stepDone
                              ? "text-[#1e7b4f]"
                              : stepActive
                                ? "text-[#131416]"
                                : "text-[#8b8d90]"
                          }`}
                        >
                          {step.moduleLabel}
                        </span>
                        <span
                          className={`truncate ${
                            stepActive ? "text-[#134e5e]" : "text-[#8b8d90]"
                          }`}
                        >
                          {stepActive ? step.description : stepDone ? "Complete" : "Queued"}
                        </span>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {/* Done summary chips */}
              {isDone && item.result && answerMetrics && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="mt-2.5 flex flex-wrap items-center gap-1.5"
                >
                  <span className="pill-positive">
                    STAR {starCount(item.result.analysis)}/4
                  </span>
                  <span className="badge">
                    Keywords {item.result.analysis.coverage}%
                  </span>
                  {item.result.speech && (
                    <span className="badge tabular-nums">
                      {item.result.speech.wpm} WPM
                    </span>
                  )}
                  {item.result.vision && (
                    <span className="badge tabular-nums">
                      Eye {Math.round(item.result.vision.eyeContactScore)}%
                    </span>
                  )}
                </motion.div>
              )}

              {/* Error message */}
              {isError && item.errorMessage && (
                <p className="mt-2 text-[12px] text-[#831c1e] leading-snug">
                  {item.errorMessage}
                </p>
              )}
            </motion.div>
          );
        })}

        {/* Final completion beat banner */}
        <AnimatePresence>
          {isCompleting && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-[8px] bg-[#dcfae5] border border-[#b5e8c5] px-3.5 py-2.5 flex items-center gap-2 text-[13px] font-medium text-[#04250e]"
            >
              <span className="material-symbols-outlined text-[18px] text-[#1e7b4f]">
                verified
              </span>
              All answers analyzed — opening your STAR review…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-[#f9fbfc] border-t border-[#e8eaec] flex flex-wrap items-center justify-between gap-2">
        {errorItem ? (
          <>
            <button
              type="button"
              onClick={onCancelAnalysis}
              className="h-[32px] px-3 rounded-[6px] border border-[#cdced1] bg-white text-[12px] font-medium text-[#131416] hover:bg-[#f4f6f8] cursor-pointer"
            >
              Cancel &amp; return to practice
            </button>
            <div className="flex items-center gap-2">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSkipItem(errorIndex)}
                  className="h-[32px] px-3 rounded-[6px] border border-[#cdced1] bg-white text-[12px] font-medium text-[#131416] hover:bg-[#f4f6f8] cursor-pointer"
                >
                  Skip &amp; continue
                </button>
              )}
              <button
                type="button"
                onClick={() => onRetryItem(errorIndex)}
                className="h-[32px] px-3.5 rounded-[6px] bg-[#1b6c80] text-white text-[12px] font-medium hover:bg-[#134e5e] flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">refresh</span>
                Retry Q{errorItem.questionIndex + 1}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
            <span className="material-symbols-outlined text-[15px] text-[#1b6c80]">
              lock
            </span>
            <span>Controls are paused until analysis finishes.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ReviewView({
  session,
  onCloseReview,
  onStartNewSession,
  onViewFullReport,
}: {
  session: SavedSession;
  onCloseReview: () => void;
  onStartNewSession: () => void;
  onViewFullReport: (sessionId: string) => void;
}) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [showSentences, setShowSentences] = useState(false);

  const answers = session.answers;
  const safeTab = Math.min(selectedTab, Math.max(0, answers.length - 1));
  const activeAnswer = answers[safeTab];
  const sessionMetrics = computeSessionMetrics(answers);
  const activeMetrics = activeAnswer ? computeAnswerMetrics(activeAnswer) : null;

  const kpis = [
    { label: "Overall", value: `${sessionMetrics.overallScore}%`, tone: "text-[#131416]" },
    {
      label: "STAR Structure",
      value: `${sessionMetrics.starScore}%`,
      tone: scoreTone(sessionMetrics.starScore),
    },
    {
      label: "Speech Fluency",
      value: sessionMetrics.deliveryScore !== null ? `${sessionMetrics.deliveryScore}%` : "—",
      tone:
        sessionMetrics.deliveryScore !== null
          ? scoreTone(sessionMetrics.deliveryScore)
          : "text-[#8b8d90]",
    },
    {
      label: "Eye Contact & Posture",
      value: sessionMetrics.presenceScore !== null ? `${sessionMetrics.presenceScore}%` : "—",
      tone:
        sessionMetrics.presenceScore !== null
          ? scoreTone(sessionMetrics.presenceScore)
          : "text-[#8b8d90]",
    },
  ];

  return (
    <motion.div
      key={`review-card-${session.id}`}
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full max-w-[860px] max-h-[88vh] flex flex-col rounded-[12px] bg-white border border-[#e8eaec] shadow-xl overflow-hidden"
    >
      {/* Fixed Header */}
      <div className="px-5 py-3.5 border-b border-[#e8eaec] flex items-center justify-between gap-3 shrink-0 bg-white">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="analysis-modal-title"
              className="text-[16px] font-semibold text-[#131416]"
            >
              Session STAR Review
            </h2>
            <span className="pill-positive gap-1">
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              Saved to Reports
            </span>
          </div>
          <p className="text-[12px] text-[#5d5f60] truncate mt-0.5">
            {targetLabel(session)} · {answers.length}{" "}
            {answers.length === 1 ? "answer" : "answers"} evaluated
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseReview}
          aria-label="Close review"
          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#5d5f60] hover:text-[#131416] hover:bg-[#f4f6f8] transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* 4-column KPI Summary Strip */}
        <section className="rounded-[8px] border border-[#e8eaec] grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e8eaec]">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className={`p-3.5 ${i >= 2 ? "border-t sm:border-t-0 border-[#e8eaec]" : ""}`}
            >
              <div className="text-[12px] text-[#5d5f60]">{kpi.label}</div>
              <div
                className={`mt-1 tabular-nums leading-tight font-semibold ${
                  i === 0 ? "text-[26px]" : "text-[22px]"
                } ${kpi.tone}`}
              >
                {kpi.value}
              </div>
            </div>
          ))}
        </section>

        {/* Question Tabs */}
        {answers.length > 1 && (
          <div className="flex flex-wrap gap-1.5 p-1 rounded-[8px] bg-[#f4f6f8] border border-[#e8eaec]">
            {answers.map((ans, idx) => {
              const isActive = idx === safeTab;
              return (
                <button
                  key={`${ans.question}-${idx}`}
                  type="button"
                  onClick={() => setSelectedTab(idx)}
                  className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-white text-[#131416] shadow-sm border border-[#e8eaec]"
                      : "text-[#5d5f60] hover:text-[#131416]"
                  }`}
                >
                  <span className="tabular-nums">Q{idx + 1}</span>
                  <span
                    className={`text-[11px] tabular-nums px-1.5 py-0.2 rounded-[4px] ${
                      starCount(ans.analysis) >= 3
                        ? "bg-[#dcfae5] text-[#04250e]"
                        : "bg-[#ebedee] text-[#353736]"
                    }`}
                  >
                    {starCount(ans.analysis)}/4 STAR
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Answer Detail */}
        {activeAnswer && activeMetrics && (
          <AnimatePresence mode="wait">
            <motion.div
              key={safeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-4"
            >
              {/* Question + Telemetry */}
              <div className="rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] p-4 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1b6c80]">
                  Question {safeTab + 1}
                </div>
                <h3 className="text-[15px] font-semibold text-[#131416] leading-snug">
                  {activeAnswer.question}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="pill-positive">
                    STAR {starCount(activeAnswer.analysis)}/4
                  </span>
                  <span className="badge tabular-nums">
                    Keywords {activeAnswer.analysis.coverage}%
                  </span>
                  {activeAnswer.speech && (
                    <>
                      <span className="badge tabular-nums">
                        {activeAnswer.speech.wpm} WPM
                      </span>
                      <span className="badge tabular-nums">
                        {activeAnswer.speech.fillerCount} fillers
                      </span>
                      <span className="badge tabular-nums">
                        {activeAnswer.speech.longPauses} long pauses
                      </span>
                    </>
                  )}
                  {activeAnswer.vision && (
                    <>
                      <span className="badge tabular-nums">
                        Eye contact {Math.round(activeAnswer.vision.eyeContactScore)}%
                      </span>
                      <span className="badge tabular-nums">
                        Posture {Math.round(activeAnswer.vision.postureScore)}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 2x2 STAR Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STAR_META.map(({ key, letter, label }) => {
                  const section = activeAnswer.analysis.star[key];
                  const pillarScore = activeMetrics.starPillarScores[key];
                  return (
                    <div
                      key={key}
                      className="rounded-[8px] border border-[#e8eaec] bg-white p-3.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
                            section.found
                              ? "bg-[#dcfae5] text-[#04250e]"
                              : "bg-[#ffedea] text-[#831c1e]"
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-[13.5px] font-semibold text-[#131416]">
                          {label}
                        </span>
                        <span
                          className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-[4px] ${
                            section.found
                              ? "bg-[#dcfae5] text-[#04250e]"
                              : "bg-[#ffedea] text-[#831c1e]"
                          }`}
                        >
                          {section.found ? "Found" : "Missing"}
                        </span>
                        <span
                          className={`text-[12px] font-semibold tabular-nums ${scoreTone(pillarScore)}`}
                        >
                          {pillarScore}%
                        </span>
                      </div>

                      <div className="h-1.5 bg-[#f0f1f2] rounded-[2px] overflow-hidden">
                        <div
                          className={`h-full ${
                            pillarScore >= 80 ? "bg-[#1b6c80]" : "bg-[#c4242a]"
                          }`}
                          style={{ width: `${pillarScore}%` }}
                        />
                      </div>

                      <p className="text-[12px] text-[#5d5f60] leading-relaxed">
                        {section.explanation}
                      </p>

                      {section.sentences.length > 0 && (
                        <ul className="space-y-1">
                          {section.sentences.map((sent, sIdx) => (
                            <li
                              key={sIdx}
                              className="text-[11.5px] text-[#25272a] border-l-2 border-[#1b6c80] pl-2 leading-snug"
                            >
                              {sent}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="text-[12px] text-[#134e5e] bg-[#f4f9fb] rounded-[6px] px-2.5 py-1.5">
                        {section.suggestion}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Matched & Missing Keywords */}
              {activeAnswer.analysis.keywordGroups.length > 0 && (
                <div className="rounded-[8px] border border-[#e8eaec] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[13.5px] font-semibold text-[#131416]">
                      Keyword coverage
                    </h4>
                    <span className="text-[12px] text-[#5d5f60] tabular-nums">
                      {activeAnswer.analysis.matchedCount} matched ·{" "}
                      {activeAnswer.analysis.missingCount} missing
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {activeAnswer.analysis.keywordGroups.map((group) => (
                      <div
                        key={group.category}
                        className="border-t border-[#f0f1f2] pt-2.5 first:border-0 first:pt-0 space-y-1.5"
                      >
                        <div className="text-[12px] font-medium text-[#131416]">
                          {group.label}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.matched.map((kw) => (
                            <span key={`m-${kw}`} className="pill-positive">
                              ✓ {kw}
                            </span>
                          ))}
                          {group.missing.map((kw) => (
                            <span key={`x-${kw}`} className="pill-negative">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected fillers + Sentence breakdown toggle */}
              <div className="rounded-[8px] border border-[#e8eaec] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSentences((v) => !v)}
                  aria-expanded={showSentences}
                  className="w-full px-4 h-[42px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
                >
                  <span className="text-[13px] font-medium text-[#131416]">
                    Sentence classification &amp; transcript ({activeAnswer.analysis.sentences.length}{" "}
                    sentences)
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-[#5d5f60]">
                    {showSentences ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {showSentences && (
                  <div className="px-4 pb-4 space-y-2.5 border-t border-[#f0f1f2] pt-3">
                    {activeAnswer.speech && activeAnswer.speech.fillers.length > 0 && (
                      <div className="text-[12px] text-[#5d5f60]">
                        Detected fillers:{" "}
                        <span className="font-medium text-[#131416]">
                          {activeAnswer.speech.fillers.join(", ")}
                        </span>
                      </div>
                    )}
                    {activeAnswer.analysis.sentences.length === 0 ? (
                      <p className="text-[12.5px] text-[#5d5f60]">
                        {activeAnswer.transcript || "No transcript available."}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeAnswer.analysis.sentences.map((item, sIdx) => {
                          const label =
                            item.section === "unclassified"
                              ? "Not classified"
                              : STAR_META.find((s) => s.key === item.section)?.label;
                          const tone =
                            item.section === "situation"
                              ? "border-[#2f70bb] bg-[#eff6ff]"
                              : item.section === "task"
                                ? "border-[#a86f0c] bg-[#fffbeb]"
                                : item.section === "action"
                                  ? "border-[#1b6c80] bg-[#eef4f6]"
                                  : item.section === "result"
                                    ? "border-[#1e7b4f] bg-[#effaf3]"
                                    : "border-[#cdced1] bg-[#f9fbfc]";
                          return (
                            <div
                              key={sIdx}
                              className={`rounded-[6px] border-l-[3px] px-3 py-2 ${tone}`}
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#45474a]">
                                {label}
                              </div>
                              <p className="text-[12.5px] text-[#131416] mt-0.5">
                                {item.text}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Top Coaching Tips */}
              {activeAnswer.analysis.coaching.length > 0 && (
                <div className="rounded-[8px] border border-[#e8eaec] p-4 space-y-2">
                  <h4 className="text-[13.5px] font-semibold text-[#131416]">
                    What to improve
                  </h4>
                  <ol className="space-y-1.5">
                    {activeAnswer.analysis.coaching.slice(0, 3).map((tip, tIdx) => (
                      <li key={tIdx} className="flex gap-2.5 text-[13px] text-[#131416]">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-[#eef4f6] text-[#134e5e] text-[12px] font-medium flex items-center justify-center tabular-nums">
                          {tIdx + 1}
                        </span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="px-5 py-3 bg-[#f9fbfc] border-t border-[#e8eaec] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCloseReview}
            className="h-[34px] px-3.5 rounded-[6px] border border-[#cdced1] bg-white text-[13px] font-medium text-[#131416] hover:bg-[#f4f6f8] transition-colors cursor-pointer"
          >
            Back to Practice
          </button>
          <button
            type="button"
            onClick={onStartNewSession}
            className="h-[34px] px-3.5 rounded-[6px] border border-[#cdced1] bg-white text-[13px] font-medium text-[#131416] hover:bg-[#f4f6f8] transition-colors cursor-pointer"
          >
            New Session
          </button>
        </div>

        <button
          type="button"
          onClick={() => onViewFullReport(session.id)}
          className="h-[34px] px-4 rounded-[6px] bg-[#1b6c80] text-white text-[13px] font-medium hover:bg-[#134e5e] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">insights</span>
          View Full Report
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function SessionAnalysisModal({
  phase,
  items,
  isCompleting,
  completedSession,
  onRetryItem,
  onSkipItem,
  onCancelAnalysis,
  onCloseReview,
  onStartNewSession,
  onViewFullReport,
}: SessionAnalysisModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasErrorItem = items.some((it) => it.status === "error");

  // Lock background scroll while modal is open
  useEffect(() => {
    if (phase === "closed") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [phase]);

  // Move focus inside modal on open so keyboard users stay inside
  useEffect(() => {
    if (phase !== "closed") {
      dialogRef.current?.focus();
    }
  }, [phase]);

  // Block keyboard shortcuts (Escape, Sidebar "[", and Tab escaping modal)
  useEffect(() => {
    if (phase === "closed") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (phase === "review") {
          onCloseReview();
        }
        return;
      }

      if (e.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !container.contains(active)) {
          e.preventDefault();
          first.focus();
          return;
        }
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [phase, onCloseReview]);

  // Warn before accidentally closing/refreshing tab while active analysis runs
  useEffect(() => {
    if (phase !== "analyzing" || hasErrorItem) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase, hasErrorItem]);

  return (
    <AnimatePresence>
      {phase !== "closed" && (
        <motion.div
          key="session-analysis-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#131416]/55 backdrop-blur-[3px]"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="analysis-modal-title"
            tabIndex={-1}
            className="w-full flex justify-center outline-none"
          >
            <AnimatePresence mode="wait">
              {phase === "analyzing" && (
                <AnalyzingView
                  items={items}
                  isCompleting={isCompleting}
                  onRetryItem={onRetryItem}
                  onSkipItem={onSkipItem}
                  onCancelAnalysis={onCancelAnalysis}
                />
              )}
              {phase === "review" && completedSession && (
                <ReviewView
                  key={`review-${completedSession.id}`}
                  session={completedSession}
                  onCloseReview={onCloseReview}
                  onStartNewSession={onStartNewSession}
                  onViewFullReport={onViewFullReport}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
