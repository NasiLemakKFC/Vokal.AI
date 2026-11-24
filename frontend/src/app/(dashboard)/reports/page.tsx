"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionReportBrowser } from "@/hooks/useSessionReportBrowser";
import {
  computeAnswerMetrics,
  computeSessionMetrics,
  starCount,
  type SavedSession,
  type SessionSummary,
} from "@/lib/nlp/sessionStore";
import { STAR_LABELS, type StarKey } from "@/lib/nlp/types";
import { scoreTone } from "@/lib/format";
import AnnotatedTranscript from "@/components/interview/AnnotatedTranscript";
import StarFeedbackExtras from "@/components/interview/StarFeedbackExtras";
import SessionSwitcher from "@/components/reports/SessionSwitcher";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const PILLAR_LABEL_MAP: Record<StarKey, string> = {
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTarget(s: SavedSession): string {
  if (s.mode === "general") return "General Interview";
  if (s.company.trim()) return `${s.company.trim()} · ${s.role}`;
  return s.role;
}

function stripTrailingPeriod(text: string): string {
  return text.trim().replace(/\.+$/, "");
}

function ControlledDisclosure({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border)] first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-5 h-12 flex items-center justify-between text-left hover:bg-[var(--raised)]/60 transition-colors cursor-pointer"
      >
        <span className="text-[14px] font-medium text-[var(--text)]">
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="material-symbols-outlined text-[18px] text-[var(--muted)] no-print"
        >
          expand_more
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="px-5 pb-5 pt-1"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreStrip({
  scores,
}: {
  scores: {
    label: string;
    value: number | null;
    delta: number | null;
    note: string;
  }[];
}) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {scores.map((sc) => (
        <div
          key={sc.label}
          className="kpi-card p-5 flex flex-col justify-between gap-3"
        >
          <span className="text-[13px] text-[var(--muted)] leading-snug">
            {sc.label}
          </span>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span
              className={`text-[28px] font-medium tabular-nums leading-none ${
                sc.value !== null ? scoreTone(sc.value) : "text-[var(--subtle)]"
              }`}
            >
              {sc.value !== null ? `${sc.value}%` : "—"}
            </span>
            {sc.delta !== null && (
              <span
                className={`text-[12px] font-mono font-medium tabular-nums ${
                  sc.delta >= 0
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {sc.delta > 0 ? "+" : ""}
                {sc.delta}%
              </span>
            )}
          </div>
          <span className="text-[12px] text-[var(--muted)]">{sc.note}</span>
        </div>
      ))}
    </section>
  );
}

type SectionKey = "star" | "keywords" | "speech" | "transcript" | "tailor";

function SavedSessionReport({
  session,
  previousSummary,
  forceExpandAll,
}: {
  session: SavedSession;
  previousSummary: SessionSummary | null;
  forceExpandAll: boolean;
}) {
  const [answerTab, setAnswerTab] = useState(0);
  const [openMap, setOpenMap] = useState<Record<SectionKey, boolean>>({
    star: true,
    keywords: false,
    speech: false,
    transcript: true,
    tailor: false,
  });

  const answers = session.answers;
  const tailorReport = session.tailorReport ?? null;
  const safeIdx = Math.min(answerTab, Math.max(0, answers.length - 1));
  const active = answers[safeIdx];

  const perAnswerMetrics = useMemo(
    () => answers.map(computeAnswerMetrics),
    [answers]
  );

  const weakestIdx = useMemo(() => {
    if (perAnswerMetrics.length <= 1) return -1;
    let minIdx = 0;
    for (let i = 1; i < perAnswerMetrics.length; i++) {
      if (perAnswerMetrics[i].overallScore < perAnswerMetrics[minIdx].overallScore) {
        minIdx = i;
      }
    }
    return minIdx;
  }, [perAnswerMetrics]);

  const sessionMetrics = useMemo(() => computeSessionMetrics(answers), [answers]);
  const overall = session.overallScore ?? sessionMetrics.overallScore;
  const starScore = session.starScore ?? sessionMetrics.starScore;
  const delivery =
    session.deliveryScore !== undefined
      ? session.deliveryScore
      : sessionMetrics.deliveryScore;
  const presence =
    session.presenceScore !== undefined
      ? session.presenceScore
      : sessionMetrics.presenceScore;

  const activeMetrics = perAnswerMetrics[safeIdx] ?? null;

  const scores = [
    {
      label: "Overall",
      value: overall,
      delta: previousSummary ? overall - previousSummary.overallScore : null,
      note: previousSummary ? "vs previous session" : "Composite score",
    },
    {
      label: "Content (STAR)",
      value: starScore,
      delta: previousSummary ? starScore - previousSummary.starScore : null,
      note: "STAR & keyword depth",
    },
    {
      label: "Delivery",
      value: delivery,
      delta:
        delivery !== null && previousSummary?.deliveryScore != null
          ? delivery - previousSummary.deliveryScore
          : null,
      note: delivery !== null ? "Speech fluency" : "No audio recorded",
    },
    {
      label: "Eye contact & posture",
      value: presence,
      delta:
        presence !== null && previousSummary?.presenceScore != null
          ? presence - previousSummary.presenceScore
          : null,
      note: presence !== null ? "Camera presence" : "Camera off",
    },
  ];

  const allSectionKeys: SectionKey[] = [
    "star",
    ...(active?.analysis.keywordGroups.length ? (["keywords"] as const) : []),
    "speech",
    "transcript",
    ...(tailorReport ? (["tailor"] as const) : []),
  ];
  const allOpen =
    forceExpandAll || allSectionKeys.every((key) => openMap[key]);

  const toggleAllSections = () => {
    const nextVal = !allOpen;
    setOpenMap({
      star: nextVal,
      keywords: nextVal,
      speech: nextVal,
      transcript: nextVal,
      tailor: nextVal,
    });
  };

  const toggleSection = (key: SectionKey) => {
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rewrite = active?.analysis.llmEvaluation?.strongerRewrite ?? null;
  const hasRewrite = Boolean(rewrite?.example);

  return (
    <>
      <ScoreStrip scores={scores} />

      {/* Smarter Question Tabs for Multi-Question Sessions */}
      {answers.length > 1 && (
        <div
          role="tablist"
          aria-label="Session questions"
          className="flex flex-wrap gap-1.5 p-1.5 rounded-[var(--radius-card)] bg-[var(--raised)] border border-[var(--border)] no-print"
        >
          {answers.map((ans, idx) => {
            const isSelected = idx === safeIdx;
            const qScore = perAnswerMetrics[idx]?.overallScore ?? 0;
            const isWeakest = idx === weakestIdx;
            return (
              <button
                key={`${ans.question}-${idx}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setAnswerTab(idx)}
                className={`relative px-3 h-9 rounded-[var(--radius-control)] text-[13px] font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "text-[var(--text)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="report-question-tab"
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    className="absolute inset-0 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)]"
                  />
                )}
                <span className="relative tabular-nums font-medium">
                  Q{idx + 1}
                </span>
                <span
                  className={`relative text-[12px] font-mono font-medium tabular-nums ${scoreTone(qScore)}`}
                >
                  {qScore}%
                </span>
                <span className="relative text-[11px] text-[var(--muted)] font-mono tabular-nums hidden sm:inline">
                  {starCount(ans.analysis)}/4
                </span>
                {ans.followUp && (
                  <span
                    title="Includes interviewer follow-up"
                    className="relative material-symbols-outlined text-[14px] text-[var(--accent-ink)]"
                  >
                    forum
                  </span>
                )}
                {isWeakest && (
                  <span className="relative text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]">
                    Focus
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {active && activeMetrics && (
        <>
          {/* Active Question Card + Per-Question Telemetry Strip + Follow-Up Q&A */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)] px-5 py-4 space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--muted)] tabular-nums">
                  Question {safeIdx + 1} of {answers.length}
                </span>
                <span
                  className={`text-[12px] font-mono font-medium tabular-nums ${scoreTone(activeMetrics.overallScore)}`}
                >
                  Question score · {activeMetrics.overallScore}%
                </span>
              </div>
              <p className="text-[15px] font-medium text-[var(--text)] mt-1 leading-snug">
                {active.question}
              </p>
            </div>

            {/* Per-Question Telemetry Strip */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="pill-positive">
                STAR {starCount(active.analysis)}/4
              </span>
              <span className="badge font-mono tabular-nums">
                Keywords {active.analysis.coverage}%
              </span>
              {active.speech && (
                <>
                  <span className="badge font-mono tabular-nums">
                    {active.speech.wpm} WPM
                  </span>
                  <span className="badge font-mono tabular-nums">
                    {active.speech.fillerCount} fillers
                  </span>
                  <span className="badge font-mono tabular-nums">
                    {active.speech.longPauses} long pauses
                  </span>
                </>
              )}
              {active.vision && (
                <>
                  <span className="badge font-mono tabular-nums">
                    Eye {Math.round(active.vision.eyeContactScore)}%
                  </span>
                  <span className="badge font-mono tabular-nums">
                    Posture {Math.round(active.vision.postureScore)}%
                  </span>
                </>
              )}
            </div>

            {active.followUp && (
              <div className="rounded-[var(--radius-control)] border border-[var(--border-accent)] bg-[var(--accent-soft)]/45 px-3.5 py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-ink)]">
                    <span className="material-symbols-outlined text-[15px]">
                      forum
                    </span>
                    Interviewer follow-up · {active.followUp.pillarLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {typeof active.followUp.wpm === "number" && (
                      <span className="badge font-mono tabular-nums">
                        {active.followUp.wpm} WPM
                      </span>
                    )}
                    {typeof active.followUp.fillerCount === "number" && (
                      <span className="badge font-mono tabular-nums">
                        {active.followUp.fillerCount} fillers
                      </span>
                    )}
                    {typeof active.followUp.fluencyScore === "number" && (
                      <span className="badge font-mono tabular-nums">
                        Fluency {active.followUp.fluencyScore}%
                      </span>
                    )}
                    {typeof active.followUp.durationSec === "number" &&
                      active.followUp.durationSec > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-[var(--muted)]">
                          {Math.round(active.followUp.durationSec)}s
                        </span>
                      )}
                  </div>
                </div>
                <p className="text-[13px] font-medium text-[var(--text)] leading-snug">
                  &ldquo;{active.followUp.prompt}&rdquo;
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] border-l-2 border-[var(--accent)] pl-2.5 leading-relaxed">
                  {active.followUp.transcript}
                </p>
              </div>
            )}
          </div>

          {/* Executive Summary: What to Improve + Above-the-Fold AI Stronger Rewrite */}
          <div
            className={`grid grid-cols-1 ${
              hasRewrite ? "lg:grid-cols-12" : ""
            } gap-4 items-stretch`}
          >
            <section
              className={`card space-y-3 ${hasRewrite ? "lg:col-span-6" : ""}`}
            >
              <h2 className="text-[15px] font-medium text-[var(--text)]">
                What to improve
              </h2>
              {active.analysis.coaching.length > 0 ? (
                <ol className="space-y-2.5">
                  {active.analysis.coaching.slice(0, 3).map((tip, i) => (
                    <li
                      key={tip}
                      className="flex items-baseline gap-3 text-[14px] text-[var(--text)] leading-relaxed"
                    >
                      <span className="text-[12px] font-mono tabular-nums text-[var(--muted)] shrink-0 w-5">
                        0{i + 1}
                      </span>
                      <span>{stripTrailingPeriod(tip)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-[var(--muted)]">
                  No improvements needed for this response
                </p>
              )}
            </section>

            {hasRewrite && rewrite && (
              <section className="lg:col-span-6 rounded-[var(--radius-card)] border border-[var(--border-accent)] bg-[var(--accent-soft)]/50 p-5 flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[var(--accent-ink)]">
                        auto_fix_high
                      </span>
                      <h2 className="text-[14px] font-medium text-[var(--accent-ink)]">
                        How to say it better · Strengthen your{" "}
                        {PILLAR_LABEL_MAP[rewrite.targetPillar]}
                      </h2>
                    </div>
                  </div>
                  <blockquote className="text-[14px] text-[var(--text)] leading-relaxed border-l-2 border-[var(--accent)] pl-3">
                    &ldquo;{rewrite.example}&rdquo;
                  </blockquote>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  Grounded in your own story — plug in real numbers where bracketed
                </p>
              </section>
            )}
          </div>

          {/* Detailed Breakdown Accordion with Expand/Collapse All */}
          <section className="card !p-0 overflow-hidden">
            <div className="px-5 h-11 flex items-center justify-between border-b border-[var(--border)] bg-[var(--raised)]/50">
              <span className="text-[12px] font-medium text-[var(--muted)]">
                Detailed breakdown
              </span>
              <button
                type="button"
                onClick={toggleAllSections}
                className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline cursor-pointer no-print"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>

            <ControlledDisclosure
              title="STAR breakdown"
              open={forceExpandAll || openMap.star}
              onToggle={() => toggleSection("star")}
            >
              <div className="space-y-4">
                {active.analysis.llmEvaluation && (
                  <StarFeedbackExtras
                    evaluation={active.analysis.llmEvaluation}
                    hideRewrite
                  />
                )}
                {STAR_LABELS.map(([key, label]) => {
                  const section = active.analysis.star[key];
                  const pillarScore = activeMetrics.starPillarScores[key];
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-medium text-[var(--text)]">
                          {label} ·{" "}
                          <span
                            className={
                              section.found
                                ? "text-[var(--positive)]"
                                : "text-[var(--negative)]"
                            }
                          >
                            {section.found ? "Found" : "Missing"}
                          </span>
                        </span>
                        <span
                          className={`tabular-nums font-medium font-mono ${scoreTone(pillarScore)}`}
                        >
                          {pillarScore}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--ring-track)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${pillarScore}%`,
                            backgroundColor:
                              pillarScore >= 80
                                ? "var(--accent)"
                                : pillarScore >= 70
                                  ? "var(--warning-ink)"
                                  : "var(--negative)",
                          }}
                        />
                      </div>
                      <p className="text-[13px] text-[var(--muted)]">
                        {section.explanation}
                      </p>
                      {section.sentences.length > 0 && (
                        <ul className="space-y-1 pt-0.5">
                          {section.sentences.map((sent, sIdx) => (
                            <li
                              key={sIdx}
                              className="text-[12px] text-[var(--text-secondary)] border-l-2 border-[var(--accent)] pl-2.5"
                            >
                              {sent}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-[12px] text-[var(--accent-ink)]">
                        {section.suggestion}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ControlledDisclosure>

            {active.analysis.keywordGroups.length > 0 && (
              <ControlledDisclosure
                title={`Keyword coverage (${active.analysis.coverage}%)`}
                open={forceExpandAll || openMap.keywords}
                onToggle={() => toggleSection("keywords")}
              >
                <div className="space-y-3">
                  {active.analysis.keywordGroups.map((group) => (
                    <div
                      key={group.category}
                      className="border-t border-[var(--rule)] pt-3 first:border-0 first:pt-0 space-y-2"
                    >
                      <div className="text-[13px] font-medium text-[var(--text)]">
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
              </ControlledDisclosure>
            )}

            <ControlledDisclosure
              title="Speech & presence details"
              open={forceExpandAll || openMap.speech}
              onToggle={() => toggleSection("speech")}
            >
              <div className="space-y-3">
                {active.speech ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                    <div>
                      <dt className="text-[var(--muted)]">Pace</dt>
                      <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                        {active.speech.wpm} WPM
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Fillers / min</dt>
                      <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                        {active.speech.fillersPerMin.toFixed(1)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Long pauses</dt>
                      <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                        {active.speech.longPauses}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Words used</dt>
                      <dd className="text-[var(--text)] font-medium mt-0.5">
                        {active.speech.fillers.length
                          ? active.speech.fillers.join(", ")
                          : "None"}
                      </dd>
                    </div>
                    {(active.speech.manglishCount ?? 0) > 0 && (
                      <div className="col-span-2 sm:col-span-4 rounded-[var(--radius-control)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3 py-2 text-[12px] text-[var(--pill-warning-ink)]">
                        <strong className="font-medium">
                          Manglish particles ({active.speech.manglishCount}):
                        </strong>{" "}
                        {active.speech.manglishFillers?.join(", ") || "Detected"} — trim
                        informal particles in formal English interviews.
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">
                    Text-only answer — no audio delivery metrics recorded
                  </p>
                )}

                {active.vision ? (
                  <div className="space-y-3 pt-3 border-t border-[var(--rule)]">
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                      <div>
                        <dt className="text-[var(--muted)]">Eye contact</dt>
                        <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                          {Math.round(active.vision.eyeContactScore)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Posture</dt>
                        <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                          {Math.round(active.vision.postureScore)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Eye nudges</dt>
                        <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                          {active.vision.eyeNudges}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Posture nudges</dt>
                        <dd className="text-[var(--text)] font-medium font-mono tabular-nums mt-0.5">
                          {active.vision.postureNudges}
                        </dd>
                      </div>
                    </dl>

                    {active.vision.timeline && active.vision.timeline.length >= 2 && (() => {
                      const timeline = active.vision.timeline;
                      const lowestEye = timeline.reduce((min, b) =>
                        b.eyeContact < min.eyeContact ? b : min
                      );
                      const lowestPosture = timeline.reduce((min, b) =>
                        b.posture < min.posture ? b : min
                      );
                      const fmtSec = (s: number) =>
                        `${Math.floor(s / 60)}:${s % 60 < 10 ? "0" : ""}${s % 60}`;
                      return (
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/50 p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                            <span className="font-medium text-[var(--text)]">
                              Presence timeline (5s intervals)
                            </span>
                            <span className="text-[var(--muted)]">
                              {lowestEye.eyeContact < 75
                                ? `Eye contact dipped around ${fmtSec(lowestEye.sec)} (${lowestEye.eyeContact}%)`
                                : lowestPosture.posture < 75
                                  ? `Posture dipped around ${fmtSec(lowestPosture.sec)} (${lowestPosture.posture}%)`
                                  : "Steady eye contact and posture throughout"}
                            </span>
                          </div>
                          <div
                            className="flex items-end gap-1 h-12"
                            role="img"
                            aria-label="5-second interval eye contact and posture presence bars"
                          >
                            {timeline.map((bucket) => {
                              const avg = Math.round(
                                (bucket.eyeContact + bucket.posture) / 2
                              );
                              return (
                                <div
                                  key={bucket.sec}
                                  title={`${fmtSec(bucket.sec)} · Eye ${bucket.eyeContact}% · Posture ${bucket.posture}%`}
                                  className="flex-1 min-w-[4px] rounded-t-[3px] transition-all"
                                  style={{
                                    height: `${Math.max(12, avg)}%`,
                                    backgroundColor:
                                      avg >= 80
                                        ? "var(--positive)"
                                        : avg >= 60
                                          ? "var(--warning-ink)"
                                          : "var(--negative)",
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] font-mono tabular-nums text-[var(--muted)]">
                            <span>0:00</span>
                            <span>{fmtSec(timeline[timeline.length - 1].sec + 5)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">
                    Camera was off or paused — no vision metrics captured
                  </p>
                )}
              </div>
            </ControlledDisclosure>

            <ControlledDisclosure
              title="Annotated transcript"
              open={forceExpandAll || openMap.transcript}
              onToggle={() => toggleSection("transcript")}
            >
              <AnnotatedTranscript
                transcript={active.transcript}
                sentences={active.analysis.sentences}
                speech={active.speech}
              />
            </ControlledDisclosure>

            {tailorReport && (
              <ControlledDisclosure
                title="Resume & job description alignment"
                open={forceExpandAll || openMap.tailor}
                onToggle={() => toggleSection("tailor")}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        !tailorReport.hasResume ||
                        tailorReport.matchScore === null
                          ? "badge"
                          : tailorReport.matchScore >= 75
                            ? "pill-positive"
                            : tailorReport.matchScore >= 45
                              ? "pill-warning"
                              : "pill-negative"
                      }
                    >
                      {tailorReport.matchScore !== null
                        ? `${tailorReport.matchScore}% match · ${tailorReport.verdict}`
                        : tailorReport.verdict}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {tailorReport.summary}
                  </p>
                  {tailorReport.matchedSkills.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[12px] font-medium text-[var(--positive)]">
                        Matched on resume
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tailorReport.matchedSkills.map((skill) => (
                          <span key={skill} className="pill-positive">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tailorReport.missingSkills.length > 0 && (
                    <div className="space-y-1.5">
                      <div
                        className={`text-[12px] font-medium ${
                          tailorReport.hasResume
                            ? "text-[var(--negative)]"
                            : "text-[var(--accent-ink)]"
                        }`}
                      >
                        {tailorReport.hasResume
                          ? "Missing or gap areas"
                          : "Target skills"}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tailorReport.missingSkills.map((skill) => (
                          <span
                            key={skill}
                            className={
                              tailorReport.hasResume ? "pill-negative" : "badge"
                            }
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tailorReport.tailoringTips.length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t border-[var(--rule)]">
                      {tailorReport.tailoringTips.map((tip, idx) => (
                        <li
                          key={idx}
                          className="flex gap-2 text-[13px] text-[var(--text-secondary)]"
                        >
                          <span className="text-[var(--muted)]">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ControlledDisclosure>
            )}
          </section>
        </>
      )}
    </>
  );
}

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("session");

  const {
    summaries,
    total,
    hasMore,
    loadingList,
    loadingMore,
    listError,
    search,
    setSearch,
    modeFilter,
    setModeFilter,
    sortBy,
    setSortBy,
    selectedId,
    activeSession,
    loadingDetail,
    detailError,
    activeIdx,
    previousSummary,
    selectSession,
    loadMore,
    removeSession,
    reload,
  } = useSessionReportBrowser(requestedId);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [forceExpandForPrint, setForceExpandForPrint] = useState(false);

  // Restore disclosure state after print dialog closes
  useEffect(() => {
    if (!forceExpandForPrint) return;
    const onAfterPrint = () => setForceExpandForPrint(false);
    window.addEventListener("afterprint", onAfterPrint);
    const frame = window.setTimeout(() => window.print(), 60);
    return () => {
      window.clearTimeout(frame);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [forceExpandForPrint]);

  const handleSelectSession = useCallback(
    (id: string) => {
      setConfirmDeleteId(null);
      setDeleteError(null);
      selectSession(id);
      router.replace(`/reports?session=${encodeURIComponent(id)}`, {
        scroll: false,
      });
    },
    [selectSession, router]
  );

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await removeSession(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete session"
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loadingList) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card py-12 text-center text-[14px] text-[var(--muted)]">
          Loading session reports…
        </div>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card space-y-3">
          <p className="text-[14px] font-medium text-[var(--negative)]">
            Could not load session reports
          </p>
          <p className="text-[13px] text-[var(--muted)]">{listError}</p>
          <button
            type="button"
            onClick={reload}
            className="btn-secondary h-9 px-4 text-[13px] font-medium cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasActiveFilters = Boolean(search.trim() || modeFilter !== "all");
  if (total === 0 && !hasActiveFilters) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card !p-6 sm:!p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-[540px]">
            <h1 className="text-[24px] font-medium text-[var(--text)]">
              Session report
            </h1>
            <p className="text-[14px] text-[var(--muted)] leading-relaxed">
              No session reports yet. Complete a practice interview to review
              your STAR structure, speech pacing, and presence breakdown.
            </p>
          </div>
          <Link
            href="/interview"
            className="btn-primary h-10 px-4 text-[14px] font-medium flex items-center justify-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              play_arrow
            </span>
            Start practice
          </Link>
        </div>
      </div>
    );
  }

  const activeSummary =
    (selectedId ? summaries.find((s) => s.id === selectedId) : null) ??
    summaries[0] ??
    null;

  const retryHref = (() => {
    if (!activeSession || activeSession.answers.length === 0) return null;
    const perAns = activeSession.answers.map(computeAnswerMetrics);
    let weakestIdx = 0;
    for (let i = 1; i < perAns.length; i++) {
      if (perAns[i].overallScore < perAns[weakestIdx].overallScore) {
        weakestIdx = i;
      }
    }
    const weakestAns = activeSession.answers[weakestIdx];
    const params = new URLSearchParams({
      retryPrompt: weakestAns.question,
      retryRole: activeSession.role || "Software Engineer",
    });
    const retryKeywords = weakestAns.analysis.keywordGroups
      .flatMap((g) => [...g.missing, ...g.matched])
      .slice(0, 6);
    if (retryKeywords.length > 0) {
      params.set("retryKeywords", retryKeywords.join(","));
    }
    return {
      href: `/interview?${params.toString()}`,
      label: `Retry Q${weakestIdx + 1}`,
    };
  })();

  const subtitle = activeSession
    ? `${formatTarget(activeSession)} · ${activeSession.answers.length} ${
        activeSession.answers.length === 1 ? "answer" : "answers"
      } · ${formatDate(activeSession.completedAt)}`
    : activeSummary
      ? `${activeSummary.role || "Practice Session"} · ${formatDate(activeSummary.completedAt)}`
      : "Browse your saved sessions";

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-[24px] font-medium text-[var(--text)]">
            Session report
          </h1>
          <p className="text-[14px] text-[var(--muted)] truncate">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          <SessionSwitcher
            summaries={summaries}
            total={total}
            hasMore={hasMore}
            loadingMore={loadingMore}
            selectedId={selectedId}
            activeSummary={activeSummary}
            activeIdx={activeIdx}
            search={search}
            onSearchChange={setSearch}
            modeFilter={modeFilter}
            onModeFilterChange={setModeFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onSelect={handleSelectSession}
            onLoadMore={() => void loadMore()}
          />

          {activeSession && (
            <>
              <button
                type="button"
                onClick={() => setForceExpandForPrint(true)}
                title="Expand all sections and print or save as PDF"
                className="btn-secondary h-9 px-3 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  print
                </span>
                <span className="hidden sm:inline">PDF</span>
              </button>

              {retryHref && (
                <Link
                  href={retryHref.href}
                  title="Practice your lowest-scoring question from this session"
                  className="btn-secondary h-9 px-3 text-[13px] font-medium flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    target
                  </span>
                  <span>{retryHref.label}</span>
                </Link>
              )}

              {confirmDeleteId === activeSession.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete(activeSession.id)}
                    className="h-9 px-3 rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] text-[12px] font-medium cursor-pointer disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmDeleteId(null)}
                    className="btn-secondary h-9 px-2.5 text-[12px] font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDeleteId(activeSession.id);
                  }}
                  title="Delete this session"
                  aria-label="Delete this session"
                  className="w-9 h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--pill-negative-bg)] hover:border-[var(--pill-negative-border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--negative)] cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    delete
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] px-4 py-3 text-[13px]"
        >
          {deleteError}
        </div>
      )}

      {detailError ? (
        <div className="card space-y-3">
          <p className="text-[14px] font-medium text-[var(--negative)]">
            Could not load this session
          </p>
          <p className="text-[13px] text-[var(--muted)]">{detailError}</p>
          <button
            type="button"
            onClick={reload}
            className="btn-secondary h-9 px-4 text-[13px] font-medium cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : loadingDetail || !activeSession ? (
        <div className="card py-12 text-center text-[14px] text-[var(--muted)]">
          Loading session details…
        </div>
      ) : (
        <SavedSessionReport
          key={activeSession.id}
          session={activeSession}
          previousSummary={previousSummary}
          forceExpandAll={forceExpandForPrint}
        />
      )}

      <div className="flex justify-end no-print">
        <Link
          href="/interview"
          className="btn-primary h-10 px-4 text-[13px] font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">replay</span>
          Start new practice
        </Link>
      </div>
    </div>
  );
}

/** Module 6 — searchable session performance report. */
export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto py-8 text-[13px] text-[var(--muted)]">
          Loading session report…
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
