"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSessions } from "@/hooks/useSessions";
import {
  computeAnswerMetrics,
  computeSessionMetrics,
  starCount,
  type SavedSession,
} from "@/lib/nlp/sessionStore";
import { STAR_LABELS } from "@/lib/nlp/types";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function scoreTone(score: number) {
  return score >= 80
    ? "text-[var(--positive)]"
    : score >= 70
      ? "text-[var(--warning-ink)]"
      : "text-[var(--negative)]";
}

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

function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[var(--border)] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-5 h-12 flex items-center justify-between text-left hover:bg-[var(--raised)]/60 transition-colors cursor-pointer"
      >
        <span className="text-[14px] font-medium text-[var(--text)]">
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="material-symbols-outlined text-[18px] text-[var(--muted)]"
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
  scores: { label: string; value: number | null; note: string }[];
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
          <div
            className={`text-[28px] font-medium tabular-nums leading-none ${
              sc.value !== null ? scoreTone(sc.value) : "text-[var(--subtle)]"
            }`}
          >
            {sc.value !== null ? `${sc.value}%` : "—"}
          </div>
          <span className="text-[12px] text-[var(--muted)]">{sc.note}</span>
        </div>
      ))}
    </section>
  );
}

function SavedSessionReport({ session }: { session: SavedSession }) {
  const [answerTab, setAnswerTab] = useState(0);
  const answers = session.answers;
  const tailorReport = session.tailorReport ?? null;
  const safeIdx = Math.min(answerTab, Math.max(0, answers.length - 1));
  const active = answers[safeIdx];

  const sessionMetrics = computeSessionMetrics(answers);
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

  const activeMetrics = active ? computeAnswerMetrics(active) : null;

  const scores = [
    { label: "Overall", value: overall, note: "Composite score" },
    { label: "Content (STAR)", value: starScore, note: "STAR structure" },
    {
      label: "Delivery",
      value: delivery,
      note: delivery !== null ? "Speech fluency" : "No audio recorded",
    },
    {
      label: "Eye contact & posture",
      value: presence,
      note: presence !== null ? "Camera presence" : "Camera off",
    },
  ];

  return (
    <>
      <ScoreStrip scores={scores} />

      {/* Question tabs for multi-question sessions */}
      {answers.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-1.5 rounded-[var(--radius-card)] bg-[var(--raised)] border border-[var(--border)]">
          {answers.map((ans, idx) => {
            const isSelected = idx === safeIdx;
            return (
              <button
                key={`${ans.question}-${idx}`}
                type="button"
                onClick={() => setAnswerTab(idx)}
                className={`relative px-3.5 h-8 rounded-[var(--radius-control)] text-[13px] font-medium transition-colors flex items-center gap-2 cursor-pointer ${
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
                <span className="relative text-[12px] text-[var(--muted)] font-mono tabular-nums">
                  {starCount(ans.analysis)}/4 STAR
                </span>
              </button>
            );
          })}
        </div>
      )}

      {active && activeMetrics && (
        <>
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)] px-5 py-4">
            <div className="text-[12px] font-medium text-[var(--muted)] tabular-nums">
              Question {safeIdx + 1} of {answers.length}
            </div>
            <p className="text-[15px] font-medium text-[var(--text)] mt-1 leading-snug">
              {active.question}
            </p>
          </div>

          {/* What to improve */}
          <section className="card space-y-3">
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

          {/* Details */}
          <section className="card !p-0 overflow-hidden">
            <Disclosure title="STAR breakdown" defaultOpen>
              <div className="space-y-4">
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
            </Disclosure>

            {active.analysis.keywordGroups.length > 0 && (
              <Disclosure
                title={`Keyword coverage (${active.analysis.coverage}%)`}
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
              </Disclosure>
            )}

            <Disclosure title="Speech & presence details">
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
                  </dl>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">
                    Text-only answer — no audio delivery metrics recorded
                  </p>
                )}

                {active.vision ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] pt-3 border-t border-[var(--rule)]">
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
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">
                    Camera was off or paused — no vision metrics captured
                  </p>
                )}
              </div>
            </Disclosure>

            <Disclosure title="Transcript">
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                {active.transcript || "No transcript recorded."}
              </p>
            </Disclosure>

            {tailorReport && (
              <Disclosure title="Resume & job description alignment">
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
              </Disclosure>
            )}
          </section>
        </>
      )}
    </>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const {
    sessions: savedSessions,
    loading,
    error,
    reload,
    removeSession,
  } = useSessions();

  const [manualSelectionId, setManualSelectionId] = useState<string | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestedId = searchParams.get("session");

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card py-12 text-center text-[14px] text-[var(--muted)]">
          Loading session reports…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="card space-y-3">
          <p className="text-[14px] font-medium text-[var(--negative)]">
            Could not load session reports
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

  if (savedSessions.length === 0) {
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

  const selectedId =
    manualSelectionId && savedSessions.some((s) => s.id === manualSelectionId)
      ? manualSelectionId
      : requestedId && savedSessions.some((s) => s.id === requestedId)
        ? requestedId
        : savedSessions[0].id;

  const activeSaved =
    savedSessions.find((s) => s.id === selectedId) ?? savedSessions[0];

  const subtitle = `${formatTarget(activeSaved)} · ${activeSaved.answers.length} ${
    activeSaved.answers.length === 1 ? "answer" : "answers"
  }`;

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await removeSession(id);
      setConfirmDeleteId(null);
      if (manualSelectionId === id) {
        setManualSelectionId(null);
      }
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete session"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-[24px] font-medium text-[var(--text)]">
            Session report
          </h1>
          <p className="text-[14px] text-[var(--muted)] truncate">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            Session
            <select
              value={activeSaved.id}
              onChange={(e) => {
                setManualSelectionId(e.target.value);
                setConfirmDeleteId(null);
                setDeleteError(null);
              }}
              className="input-field h-9 px-3 text-[13px] cursor-pointer"
            >
              {savedSessions.map((x) => (
                <option key={x.id} value={x.id}>
                  {formatDate(x.completedAt)} · {formatTarget(x)} (
                  {x.answers.length}Q)
                </option>
              ))}
            </select>
          </label>

          {confirmDeleteId === activeSaved.id ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete(activeSaved.id)}
                className="h-9 px-3 rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] text-[13px] font-medium cursor-pointer disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteId(null)}
                className="btn-secondary h-9 px-3 text-[13px] font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmDeleteId(activeSaved.id);
              }}
              title="Delete this session"
              className="btn-secondary h-9 px-3 text-[13px] font-medium flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--negative)] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                delete
              </span>
              Delete
            </button>
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

      <SavedSessionReport key={activeSaved.id} session={activeSaved} />

      <div className="flex justify-end">
        <Link
          href="/interview"
          className="btn-primary h-10 px-4 text-[13px] font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">replay</span>
          Practice again
        </Link>
      </div>
    </div>
  );
}

/** Module 6 — one session's performance report. */
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
