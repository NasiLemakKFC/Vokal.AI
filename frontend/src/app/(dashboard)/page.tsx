"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useSessions } from "@/hooks/useSessions";
import {
  computeAnswerMetrics,
  computeSessionMetrics,
  type SavedSession,
} from "@/lib/nlp/sessionStore";
import { STAR_LABELS, type StarKey, type StarPillar } from "@/lib/nlp/types";
import { scoreTone, stripTrailingPeriod } from "@/lib/format";
import { prewarmVisionFileset } from "@/lib/vision/MediaPipeSetup";
import ScoreRing from "@/components/ui/ScoreRing";
import ProgressTrendChart, {
  type TrendPoint,
} from "@/components/ui/ProgressTrendChart";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface UnifiedHomeSession {
  id: string;
  question: string;
  roleLabel: string;
  dateLabel: string;
  answerCount: number;
  overall: number;
  starScore: number;
  deliveryScore: number | null;
  eyeContact: number | null;
  fillersPerMin: number;
  star: Record<StarKey, StarPillar>;
  topImprovement: string;
}

function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function mapSavedToUnified(s: SavedSession): UnifiedHomeSession {
  const metrics = computeSessionMetrics(s.answers);
  const perAnswer = s.answers.map(computeAnswerMetrics);

  const avgPillar = (key: StarKey): number => {
    if (perAnswer.length === 0) return 0;
    return Math.round(
      perAnswer.reduce((sum, a) => sum + a.starPillarScores[key], 0) /
        perAnswer.length
    );
  };

  const weakestAnswerFor = (key: StarKey) => {
    if (s.answers.length === 0) return null;
    let bestIdx = 0;
    let lowestScore = perAnswer[0]?.starPillarScores[key] ?? 100;
    for (let i = 1; i < s.answers.length; i++) {
      const sc = perAnswer[i]?.starPillarScores[key] ?? 100;
      if (sc < lowestScore) {
        lowestScore = sc;
        bestIdx = i;
      }
    }
    return s.answers[bestIdx];
  };

  const star: Record<StarKey, StarPillar> = {
    situation: {
      score: avgPillar("situation"),
      note:
        weakestAnswerFor("situation")?.analysis.star.situation.suggestion ||
        weakestAnswerFor("situation")?.analysis.star.situation.explanation ||
        "Clarify the project context and constraints",
    },
    task: {
      score: avgPillar("task"),
      note:
        weakestAnswerFor("task")?.analysis.star.task.suggestion ||
        weakestAnswerFor("task")?.analysis.star.task.explanation ||
        "State your specific responsibility and success goal",
    },
    action: {
      score: avgPillar("action"),
      note:
        weakestAnswerFor("action")?.analysis.star.action.suggestion ||
        weakestAnswerFor("action")?.analysis.star.action.explanation ||
        "Detail the concrete engineering decisions you took",
    },
    result: {
      score: avgPillar("result"),
      note:
        weakestAnswerFor("result")?.analysis.star.result.suggestion ||
        weakestAnswerFor("result")?.analysis.star.result.explanation ||
        "Quantify the final outcome with a concrete number or percentage",
    },
  };

  const speechAnswers = s.answers.filter((a) => Boolean(a.speech));
  const fillersPerMin =
    speechAnswers.length > 0
      ? +(
          speechAnswers.reduce(
            (sum, a) => sum + (a.speech?.fillersPerMin ?? 0),
            0
          ) / speechAnswers.length
        ).toFixed(1)
      : 0;

  const roleLabel =
    s.mode === "general"
      ? "General Interview"
      : s.company.trim()
        ? `${s.company.trim()} · ${s.role}`
        : s.role;

  // Pick the top coaching recommendation from the lowest-scoring answer across the entire session
  let lowestAnswerIdx = 0;
  for (let i = 1; i < perAnswer.length; i++) {
    if (perAnswer[i].overallScore < perAnswer[lowestAnswerIdx].overallScore) {
      lowestAnswerIdx = i;
    }
  }
  const firstAns = s.answers[0];
  const lowestAns = s.answers[lowestAnswerIdx] ?? firstAns;
  const topImprovement =
    lowestAns?.analysis.llmEvaluation?.topCoaching?.[0] ||
    lowestAns?.analysis.coaching[0] ||
    firstAns?.analysis.coaching[0] ||
    "Finish your STAR response with a measurable outcome";

  return {
    id: s.id,
    question: firstAns?.question || "Practice session",
    roleLabel,
    dateLabel: formatSavedDate(s.completedAt),
    answerCount: s.answers.length,
    overall: s.overallScore ?? metrics.overallScore,
    starScore: s.starScore ?? metrics.starScore,
    deliveryScore:
      s.deliveryScore !== undefined ? s.deliveryScore : metrics.deliveryScore,
    eyeContact: metrics.avgEyeContact,
    fillersPerMin,
    star,
    topImprovement,
  };
}

export default function Home() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { sessions: savedSessions, loading, error, reload } = useSessions();

  // Pre-warm MediaPipe WASM fileset & model cache during idle time on Home
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void prewarmVisionFileset();
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  const unifiedSessions = useMemo<UnifiedHomeSession[]>(
    () => savedSessions.map(mapSavedToUnified),
    [savedSessions]
  );

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card py-12 text-center text-[14px] text-[var(--muted)]">
          Loading your practice sessions…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card space-y-3">
          <p className="text-[14px] font-medium text-[var(--negative)]">
            Could not load practice sessions
          </p>
          <p className="text-[13px] text-[var(--muted)]">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="btn-secondary h-9 px-4 text-[13px] font-medium cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (unifiedSessions.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="card !p-6 sm:!p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-[540px]">
            <h1 className="text-[24px] font-medium text-[var(--text)]">
              Practice overview
            </h1>
            <p className="text-[14px] text-[var(--muted)] leading-relaxed">
              No practice sessions recorded yet. Complete your first mock
              interview to track your STAR structure, eye contact, posture, and
              speech pacing over time.
            </p>
          </div>

          <Link
            href="/interview"
            onMouseEnter={() => void prewarmVisionFileset()}
            className="btn-primary h-10 px-4 text-[14px] font-medium flex items-center justify-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              play_arrow
            </span>
            Start your first practice
          </Link>
        </motion.section>
      </div>
    );
  }

  const last = unifiedSessions[0];
  const prev = unifiedSessions[1] ?? null;

  const weakest = STAR_LABELS.reduce((min, cur) =>
    last.star[cur[0]].score < last.star[min[0]].score ? cur : min
  );

  const starDelta = prev ? last.starScore - prev.starScore : null;
  const eyeDelta =
    prev && last.eyeContact !== null && prev.eyeContact !== null
      ? last.eyeContact - prev.eyeContact
      : null;
  const fillerDelta = prev
    ? +(last.fillersPerMin - prev.fillersPerMin).toFixed(1)
    : null;

  const trendPoints: TrendPoint[] = unifiedSessions.map((s) => ({
    id: s.id,
    dateLabel: s.dateLabel,
    overall: s.overall,
    star: s.starScore,
    delivery: s.deliveryScore,
    eyeContact: s.eyeContact,
  }));

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Hero Summary Card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="card !p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4 min-w-0">
          <ScoreRing value={last.overall} size={72} strokeWidth={5} label="Last" />
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-[24px] font-medium text-[var(--text)]">
                Practice overview
              </h1>
              <span className="text-[12px] font-mono tabular-nums text-[var(--muted)]">
                {savedSessions.length}{" "}
                {savedSessions.length === 1 ? "session" : "sessions"} recorded · Latest{" "}
                {last.dateLabel}
              </span>
            </div>
            <p className="text-[14px] text-[var(--muted)] leading-relaxed">
              Focus next on your{" "}
              <span className="font-medium text-[var(--text)]">
                {weakest[1]}
              </span>{" "}
              — {stripTrailingPeriod(last.star[weakest[0]].note).toLowerCase()}
            </p>
          </div>
        </div>

        <Link
          href="/interview"
          onMouseEnter={() => void prewarmVisionFileset()}
          className="btn-primary h-10 px-4 text-[14px] font-medium flex items-center justify-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">
            play_arrow
          </span>
          Start practice
        </Link>
      </motion.section>

      {/* Three Clean KPI Cards (Numbers Only) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-card p-5 flex flex-col justify-between gap-3">
          <span className="text-[13px] text-[var(--muted)]">STAR score</span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[28px] font-medium text-[var(--text)] tabular-nums leading-none">
              {last.starScore}%
            </span>
            {starDelta !== null && (
              <span
                className={`text-[12px] font-medium tabular-nums ${
                  starDelta >= 0
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {starDelta > 0 ? "+" : ""}
                {starDelta}%
              </span>
            )}
          </div>
          <span className="text-[12px] text-[var(--muted)]">
            {prev ? "vs previous session" : "First session"}
          </span>
        </div>

        <div className="kpi-card p-5 flex flex-col justify-between gap-3">
          <span className="text-[13px] text-[var(--muted)]">Eye contact</span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[28px] font-medium text-[var(--text)] tabular-nums leading-none">
              {last.eyeContact !== null ? `${last.eyeContact}%` : "—"}
            </span>
            {eyeDelta !== null && (
              <span
                className={`text-[12px] font-medium tabular-nums ${
                  eyeDelta >= 0
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {eyeDelta > 0 ? "+" : ""}
                {eyeDelta}%
              </span>
            )}
          </div>
          <span className="text-[12px] text-[var(--muted)]">
            {last.eyeContact !== null ? "Camera presence" : "Camera off"}
          </span>
        </div>

        <div className="kpi-card p-5 flex flex-col justify-between gap-3">
          <span className="text-[13px] text-[var(--muted)]">Fillers per min</span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[28px] font-medium text-[var(--text)] tabular-nums leading-none">
              {last.fillersPerMin.toFixed(1)}
            </span>
            {fillerDelta !== null && (
              <span
                className={`text-[12px] font-medium tabular-nums ${
                  fillerDelta <= 0
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {fillerDelta > 0 ? "+" : ""}
                {fillerDelta}
              </span>
            )}
          </div>
          <span className="text-[12px] text-[var(--muted)]">
            {last.fillersPerMin <= 2 ? "Clean pacing" : "Above 2.0 target"}
          </span>
        </div>
      </section>

      {/* Cross-Session Progress Trend Chart (when >= 2 sessions exist) */}
      <ProgressTrendChart points={trendPoints} />

      {/* Recent sessions */}
      <section className="card !p-0 overflow-hidden">
        <div className="px-5 h-12 flex items-center justify-between border-b border-[var(--border)] bg-[var(--raised)]/50">
          <h2 className="text-[15px] font-medium text-[var(--text)]">
            Recent sessions
          </h2>
          <Link
            href="/reports"
            className="text-[13px] font-medium text-[var(--accent-ink)] hover:text-[var(--accent)] flex items-center gap-1 transition-colors"
          >
            All reports
            <span className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </Link>
        </div>

        <ul className="divide-y divide-[var(--rule)]">
          {unifiedSessions.map((s) => {
            const isOpen = openId === s.id;
            return (
              <li
                key={s.id}
                className="transition-colors hover:bg-[var(--raised)]/40"
              >
                <div className="px-5 py-3.5 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[14px] font-medium text-[var(--text)] truncate">
                        {s.question}
                      </div>
                      {s.answerCount > 1 && (
                        <span className="text-[12px] font-mono tabular-nums text-[var(--muted)] shrink-0">
                          {s.answerCount}Q
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[var(--muted)] mt-0.5">
                      {s.roleLabel} · {s.dateLabel}
                    </div>
                  </div>

                  <span
                    className={`w-12 text-right text-[15px] font-medium font-mono tabular-nums shrink-0 ${scoreTone(s.overall)}`}
                  >
                    {s.overall}%
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                      aria-expanded={isOpen}
                      className={`h-8 px-3 rounded-[var(--radius-control)] border text-[12px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                        isOpen
                          ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                          : "border-[var(--control)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--text)]"
                      }`}
                    >
                      STAR
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.16, ease: EASE_OUT }}
                        className="material-symbols-outlined text-[16px]"
                      >
                        expand_more
                      </motion.span>
                    </button>
                    <Link
                      href={`/reports?session=${encodeURIComponent(s.id)}`}
                      title="Open full session report"
                      className="h-8 px-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] hover:bg-[var(--accent-soft)] hover:border-[var(--border-accent)] text-[12px] font-medium text-[var(--accent-ink)] flex items-center gap-1 transition-colors"
                    >
                      Report
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_outward
                      </span>
                    </Link>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                      className="px-5 pb-4 pt-3 space-y-3 border-t border-[var(--rule)] bg-[var(--raised)]/30"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {STAR_LABELS.map(([key, label]) => {
                          const p = s.star[key];
                          return (
                            <div key={key} className="space-y-1.5">
                              <div className="flex justify-between text-[12px]">
                                <span className="font-medium text-[var(--text)]">
                                  {label}
                                </span>
                                <span
                                  className={`tabular-nums font-medium ${scoreTone(p.score)}`}
                                >
                                  {p.score}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-[var(--ring-track)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${p.score}%`,
                                    backgroundColor:
                                      p.score >= 80
                                        ? "var(--accent)"
                                        : p.score >= 70
                                          ? "var(--warning-ink)"
                                          : "var(--negative)",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[13px] text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text)]">
                          Next focus:{" "}
                        </span>
                        {stripTrailingPeriod(s.topImprovement)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
