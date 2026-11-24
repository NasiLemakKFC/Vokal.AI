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
import { formatDuration, scoreTone } from "@/lib/format";
import type { StarKey } from "@/lib/nlp/types";
import AnnotatedTranscript from "@/components/interview/AnnotatedTranscript";
import StarFeedbackExtras from "@/components/interview/StarFeedbackExtras";

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
  saveError?: string | null;
  isRetryingSave?: boolean;
  onRetrySave?: () => void;
  onRetryItem: (queueIndex: number) => void;
  onSkipItem: (queueIndex: number) => void;
  onCancelAnalysis: () => void;
  onCloseReview: () => void;
  onStartNewSession: () => void;
  onViewFullReport: (sessionId: string) => void;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

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
      moduleLabel: "Speech transcription",
      description: hasAudio
        ? "Transcribing recorded audio…"
        : "Reading typed transcript…",
    },
    {
      key: "speech_fluency",
      moduleLabel: "Speech pacing & fillers",
      description: "Measuring pace, filler words, and pauses…",
    },
    {
      key: "nlp_star",
      moduleLabel: "STAR rubric & keywords",
      description: "Grading S, T, A, R depth, relevance & rewrite…",
    },
    {
      key: "vision_merge",
      moduleLabel: "Eye contact & posture",
      description: "Merging presence summary…",
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="w-full max-w-[560px] rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
      style={{ boxShadow: "var(--shadow-popover)" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px] text-[var(--text)]">
              {errorItem ? "error_outline" : isCompleting ? "check_circle" : "graphic_eq"}
            </span>
          </div>
          <div className="min-w-0">
            <h2
              id="analysis-modal-title"
              className="text-[16px] font-medium text-[var(--text)] leading-snug"
            >
              {errorItem
                ? "Analysis paused on an answer"
                : isCompleting
                  ? "Analysis complete"
                  : "Analyzing your answers"}
            </h2>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">
              {errorItem
                ? "Choose how to continue below"
                : "Stay on this screen while answers are evaluated one by one"}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)] text-[12px] font-mono font-medium text-[var(--text)] tabular-nums shrink-0">
          {finishedCount} / {items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-[var(--ring-track)] overflow-hidden">
        <motion.div
          className="h-full"
          style={{
            backgroundColor: errorItem
              ? "var(--negative)"
              : isCompleting
                ? "var(--positive)"
                : "var(--accent)",
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
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
            ? "border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)]"
            : isAnalyzing
              ? "border-[var(--border-accent)] bg-[var(--accent-soft)]/50"
              : isDone
                ? "border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)]/50"
                : "border-[var(--border)] bg-[var(--raised)]/60";

          const steps = getSubStageSteps(item.hasAudio);
          const currentStepIdx =
            item.subStage === "done"
              ? steps.length
              : SUB_STAGE_ORDER.indexOf(item.subStage);

          const answerMetrics = item.result ? computeAnswerMetrics(item.result) : null;

          return (
            <motion.div
              key={item.questionIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04, ease: EASE_OUT }}
              className={`rounded-[var(--radius-control)] border p-3.5 transition-colors ${containerStyle}`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-[4px] text-[12px] font-mono font-medium tabular-nums shrink-0 ${
                      isDone
                        ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]"
                        : isAnalyzing
                          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                          : isError
                            ? "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]"
                            : "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]"
                    }`}
                  >
                    Q{item.questionIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text)] truncate">
                      {item.question}
                    </p>
                    <p className="text-[12px] text-[var(--muted)] mt-0.5 font-mono tabular-nums">
                      {item.hasAudio
                        ? `Audio · ${formatDuration(item.durationSec)}`
                        : "Text transcript"}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-[var(--radius-pill)] ${
                    isDone
                      ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]"
                      : isAnalyzing
                        ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                        : isError
                          ? "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]"
                          : "bg-[var(--pill-neutral-bg)] text-[var(--muted)]"
                  }`}
                >
                  {isDone && (
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  )}
                  {isAnalyzing && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
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

              {/* Active 4-stage sub-stage checklist */}
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="mt-3 pt-2.5 border-t border-[var(--border-accent)]/50 space-y-1.5"
                >
                  {steps.map((step, sIdx) => {
                    const stepDone = sIdx < currentStepIdx;
                    const stepActive = sIdx === currentStepIdx;
                    return (
                      <div key={step.key} className="flex items-center gap-2 text-[12px]">
                        {stepDone ? (
                          <span className="material-symbols-outlined text-[15px] text-[var(--positive)] shrink-0">
                            check_circle
                          </span>
                        ) : stepActive ? (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--control)]" />
                          </span>
                        )}
                        <span
                          className={`font-medium ${
                            stepDone
                              ? "text-[var(--positive)]"
                              : stepActive
                                ? "text-[var(--text)]"
                                : "text-[var(--subtle)]"
                          }`}
                        >
                          {step.moduleLabel}
                        </span>
                        <span
                          className={`truncate ${
                            stepActive ? "text-[var(--accent-ink)]" : "text-[var(--subtle)]"
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="mt-2.5 flex flex-wrap items-center gap-1.5"
                >
                  <span className="pill-positive">
                    STAR {starCount(item.result.analysis)}/4
                  </span>
                  <span className="badge">
                    Keywords {item.result.analysis.coverage}%
                  </span>
                  {item.result.speech && (
                    <span className="badge font-mono tabular-nums">
                      {item.result.speech.wpm} WPM
                    </span>
                  )}
                  {item.result.vision && (
                    <span className="badge font-mono tabular-nums">
                      Eye {Math.round(item.result.vision.eyeContactScore)}%
                    </span>
                  )}
                </motion.div>
              )}

              {/* Error message */}
              {isError && item.errorMessage && (
                <p className="mt-2 text-[12px] text-[var(--pill-negative-ink)] leading-snug">
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
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="rounded-[var(--radius-control)] bg-[var(--pill-positive-bg)] border border-[var(--pill-positive-border)] px-3.5 py-2.5 flex items-center gap-2 text-[13px] font-medium text-[var(--pill-positive-ink)]"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--positive)]">
                verified
              </span>
              All answers analyzed — opening your STAR review…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-[var(--raised)]/60 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        {errorItem ? (
          <>
            <button
              type="button"
              onClick={onCancelAnalysis}
              className="btn-secondary h-8 px-3 text-[12px] font-medium cursor-pointer"
            >
              Cancel &amp; return to practice
            </button>
            <div className="flex items-center gap-2">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSkipItem(errorIndex)}
                  className="btn-secondary h-8 px-3 text-[12px] font-medium cursor-pointer"
                >
                  Skip &amp; continue
                </button>
              )}
              <button
                type="button"
                onClick={() => onRetryItem(errorIndex)}
                className="btn-primary h-8 px-3 text-[12px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Retry Q{errorItem.questionIndex + 1}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span className="material-symbols-outlined text-[16px] text-[var(--muted)]">
              lock
            </span>
            <span>Controls are paused until analysis finishes</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ReviewView({
  session,
  saveError,
  isRetryingSave = false,
  onRetrySave,
  onCloseReview,
  onStartNewSession,
  onViewFullReport,
}: {
  session: SavedSession;
  saveError?: string | null;
  isRetryingSave?: boolean;
  onRetrySave?: () => void;
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
    { label: "Overall", value: `${sessionMetrics.overallScore}%`, tone: "text-[var(--text)]" },
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
          : "text-[var(--subtle)]",
    },
    {
      label: "Eye Contact & Posture",
      value: sessionMetrics.presenceScore !== null ? `${sessionMetrics.presenceScore}%` : "—",
      tone:
        sessionMetrics.presenceScore !== null
          ? scoreTone(sessionMetrics.presenceScore)
          : "text-[var(--subtle)]",
    },
  ];

  return (
    <motion.div
      key={`review-card-${session.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="w-full max-w-[860px] max-h-[88vh] flex flex-col rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
      style={{ boxShadow: "var(--shadow-popover)" }}
    >
      {/* Fixed Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--surface)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2
              id="analysis-modal-title"
              className="text-[16px] font-medium text-[var(--text)]"
            >
              Session STAR review
            </h2>
            {saveError ? (
              <span className="pill-negative gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                Not saved
              </span>
            ) : (
              <span className="pill-positive gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved to Reports
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--muted)] truncate mt-0.5">
            {targetLabel(session)} · {answers.length}{" "}
            {answers.length === 1 ? "answer" : "answers"} evaluated
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseReview}
          aria-label="Close review"
          className="w-8 h-8 rounded-[var(--radius-control)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {saveError && (
          <div
            role="alert"
            className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] px-3.5 py-2.5 text-[13px]"
          >
            {saveError}
          </div>
        )}
        {/* 4-column KPI Summary Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="kpi-card p-4"
            >
              <div className="text-[12px] text-[var(--muted)]">{kpi.label}</div>
              <div
                className={`mt-1.5 text-[24px] font-medium tabular-nums leading-none ${kpi.tone}`}
              >
                {kpi.value}
              </div>
            </div>
          ))}
        </section>

        {/* Question Tabs */}
        {answers.length > 1 && (
          <div className="flex flex-wrap gap-1.5 p-1 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)]">
            {answers.map((ans, idx) => {
              const isActive = idx === safeTab;
              return (
                <button
                  key={`${ans.question}-${idx}`}
                  type="button"
                  onClick={() => setSelectedTab(idx)}
                  className={`h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="font-mono tabular-nums">Q{idx + 1}</span>
                  <span
                    className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-[4px] ${
                      starCount(ans.analysis) >= 3
                        ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]"
                        : "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]"
                    }`}
                  >
                    {starCount(ans.analysis)}/4
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
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="space-y-4"
            >
              {/* Question + Telemetry */}
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)] p-4 space-y-3">
                <div className="text-[12px] font-medium text-[var(--muted)]">
                  Question {safeTab + 1}
                </div>
                <h3 className="text-[15px] font-medium text-[var(--text)] leading-snug">
                  {activeAnswer.question}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="pill-positive">
                    STAR {starCount(activeAnswer.analysis)}/4
                  </span>
                  <span className="badge font-mono tabular-nums">
                    Keywords {activeAnswer.analysis.coverage}%
                  </span>
                  {activeAnswer.speech && (
                    <>
                      <span className="badge font-mono tabular-nums">
                        {activeAnswer.speech.wpm} WPM
                      </span>
                      <span className="badge font-mono tabular-nums">
                        {activeAnswer.speech.fillerCount} fillers
                      </span>
                      <span className="badge font-mono tabular-nums">
                        {activeAnswer.speech.longPauses} long pauses
                      </span>
                    </>
                  )}
                  {activeAnswer.vision && (
                    <>
                      <span className="badge font-mono tabular-nums">
                        Eye contact {Math.round(activeAnswer.vision.eyeContactScore)}%
                      </span>
                      <span className="badge font-mono tabular-nums">
                        Posture {Math.round(activeAnswer.vision.postureScore)}%
                      </span>
                    </>
                  )}
                </div>

                {activeAnswer.followUp && (
                  <div className="rounded-[var(--radius-control)] border border-[var(--border-accent)] bg-[var(--accent-soft)]/45 px-3 py-2.5 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-ink)]">
                        <span className="material-symbols-outlined text-[14px]">
                          forum
                        </span>
                        Interviewer follow-up · {activeAnswer.followUp.pillarLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {typeof activeAnswer.followUp.wpm === "number" && (
                          <span className="badge font-mono tabular-nums">
                            {activeAnswer.followUp.wpm} WPM
                          </span>
                        )}
                        {typeof activeAnswer.followUp.fillerCount === "number" && (
                          <span className="badge font-mono tabular-nums">
                            {activeAnswer.followUp.fillerCount} fillers
                          </span>
                        )}
                        {typeof activeAnswer.followUp.fluencyScore === "number" && (
                          <span className="badge font-mono tabular-nums">
                            Fluency {activeAnswer.followUp.fluencyScore}%
                          </span>
                        )}
                        {typeof activeAnswer.followUp.durationSec === "number" &&
                          activeAnswer.followUp.durationSec > 0 && (
                            <span className="text-[11px] font-mono tabular-nums text-[var(--muted)]">
                              {Math.round(activeAnswer.followUp.durationSec)}s
                            </span>
                          )}
                      </div>
                    </div>
                    <p className="text-[12px] font-medium text-[var(--text)] leading-snug">
                      &ldquo;{activeAnswer.followUp.prompt}&rdquo;
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] border-l-2 border-[var(--accent)] pl-2 leading-relaxed">
                      {activeAnswer.followUp.transcript}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Rubric Insights + STAR Balance + Stronger Rewrite */}
              {activeAnswer.analysis.llmEvaluation && (
                <StarFeedbackExtras evaluation={activeAnswer.analysis.llmEvaluation} />
              )}

              {/* 2x2 STAR Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STAR_META.map(({ key, letter, label }) => {
                  const section = activeAnswer.analysis.star[key];
                  const pillarScore = activeMetrics.starPillarScores[key];
                  return (
                    <div
                      key={key}
                      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium shrink-0 ${
                            section.found
                              ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]"
                              : "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]"
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-[14px] font-medium text-[var(--text)]">
                          {label}
                        </span>
                        <span
                          className={`ml-auto text-[12px] font-medium px-2 py-0.5 rounded-[var(--radius-pill)] ${
                            section.found
                              ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]"
                              : "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]"
                          }`}
                        >
                          {section.found ? "Found" : "Missing"}
                        </span>
                        <span
                          className={`text-[12px] font-mono font-medium tabular-nums ${scoreTone(pillarScore)}`}
                        >
                          {pillarScore}%
                        </span>
                      </div>

                      <div className="h-1.5 bg-[var(--ring-track)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pillarScore}%`,
                            backgroundColor:
                              pillarScore >= 80 ? "var(--accent)" : "var(--negative)",
                          }}
                        />
                      </div>

                      <p className="text-[12px] text-[var(--muted)] leading-relaxed">
                        {section.explanation}
                      </p>

                      {section.sentences.length > 0 && (
                        <ul className="space-y-1">
                          {section.sentences.map((sent, sIdx) => (
                            <li
                              key={sIdx}
                              className="text-[12px] text-[var(--text-secondary)] border-l-2 border-[var(--accent)] pl-2 leading-snug"
                            >
                              {sent}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="text-[12px] text-[var(--accent-ink)] bg-[var(--accent-soft)]/50 rounded-[var(--radius-control)] px-2.5 py-1.5">
                        {section.suggestion}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Matched & Missing Keywords */}
              {activeAnswer.analysis.keywordGroups.length > 0 && (
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[14px] font-medium text-[var(--text)]">
                      Keyword coverage
                    </h4>
                    <span className="text-[12px] font-mono text-[var(--muted)] tabular-nums">
                      {activeAnswer.analysis.matchedCount} matched ·{" "}
                      {activeAnswer.analysis.missingCount} missing
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {activeAnswer.analysis.keywordGroups.map((group) => (
                      <div
                        key={group.category}
                        className="border-t border-[var(--rule)] pt-2.5 first:border-0 first:pt-0 space-y-1.5"
                      >
                        <div className="text-[12px] font-medium text-[var(--text)]">
                          {group.label}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.matched.map((kw) => (
                            <span key={`m-${kw}`} className="pill-positive">
                              {kw}
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
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSentences((v) => !v)}
                  aria-expanded={showSentences}
                  className="w-full px-4 h-11 flex items-center justify-between text-left hover:bg-[var(--raised)]/60 transition-colors cursor-pointer"
                >
                  <span className="text-[13px] font-medium text-[var(--text)]">
                    Sentence classification &amp; transcript ({activeAnswer.analysis.sentences.length}{" "}
                    sentences)
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-[var(--muted)]">
                    {showSentences ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {showSentences && (
                  <div className="px-4 pb-4 space-y-2.5 border-t border-[var(--rule)] pt-3">
                    {activeAnswer.speech && activeAnswer.speech.fillers.length > 0 && (
                      <div className="text-[12px] text-[var(--muted)]">
                        Detected fillers:{" "}
                        <span className="font-medium text-[var(--text)]">
                          {activeAnswer.speech.fillers.join(", ")}
                        </span>
                      </div>
                    )}
                    <AnnotatedTranscript
                      transcript={activeAnswer.transcript}
                      sentences={activeAnswer.analysis.sentences}
                      speech={activeAnswer.speech}
                    />
                  </div>
                )}
              </div>

              {/* Top Coaching Tips */}
              {activeAnswer.analysis.coaching.length > 0 && (
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-4 space-y-2.5">
                  <h4 className="text-[14px] font-medium text-[var(--text)]">
                    What to improve
                  </h4>
                  <ol className="space-y-2">
                    {activeAnswer.analysis.coaching.slice(0, 3).map((tip, tIdx) => (
                      <li key={tIdx} className="flex items-baseline gap-2.5 text-[13px] text-[var(--text)]">
                        <span className="text-[12px] font-mono tabular-nums text-[var(--muted)] shrink-0">
                          0{tIdx + 1}
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
      <div className="px-5 py-3 bg-[var(--raised)]/60 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCloseReview}
            className="btn-secondary h-9 px-3.5 text-[13px] font-medium cursor-pointer"
          >
            Back to Practice
          </button>
          <button
            type="button"
            onClick={onStartNewSession}
            className="btn-secondary h-9 px-3.5 text-[13px] font-medium cursor-pointer"
          >
            New Session
          </button>
        </div>

        {saveError && onRetrySave ? (
          <button
            type="button"
            disabled={isRetryingSave}
            onClick={onRetrySave}
            className="btn-primary h-9 px-4 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            {isRetryingSave ? "Saving…" : "Retry save"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onViewFullReport(session.id)}
            className="btn-primary h-9 px-4 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">insights</span>
            View full report
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function SessionAnalysisModal({
  phase,
  items,
  isCompleting,
  completedSession,
  saveError,
  isRetryingSave,
  onRetrySave,
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
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
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
                  saveError={saveError}
                  isRetryingSave={isRetryingSave}
                  onRetrySave={onRetrySave}
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
