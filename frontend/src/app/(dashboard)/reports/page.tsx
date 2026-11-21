"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SESSIONS, STAR_LABELS, type PracticeSession } from "@/lib/mockSessions";
import {
  EMPTY_SESSIONS,
  computeAnswerMetrics,
  computeSessionMetrics,
  getSessionsSnapshot,
  starCount,
  subscribeSessions,
  type SavedSession,
} from "@/lib/nlp/sessionStore";

function scoreTone(score: number) {
  return score >= 80
    ? "text-[#1e7b4f]"
    : score >= 70
      ? "text-[#92400e]"
      : "text-[#c4242a]";
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
    <div className="border-t border-[#e8eaec] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 h-[46px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
      >
        <span className="text-[14px] font-medium text-[#131416]">{title}</span>
        <span className="material-symbols-outlined text-[18px] text-[#5d5f60]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
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
    { label: "Overall", value: overall },
    { label: "Content (STAR)", value: starScore },
    { label: "Delivery", value: delivery },
    { label: "Eye contact & posture", value: presence },
  ];

  return (
    <>
      {/* Scores */}
      <section className="rounded-[8px] border border-[#e8eaec] grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e8eaec]">
        {scores.map((sc, i) => (
          <div
            key={sc.label}
            className={`p-4 ${i >= 2 ? "border-t sm:border-t-0 border-[#e8eaec]" : ""}`}
          >
            <div className="text-[13px] text-[#5d5f60]">{sc.label}</div>
            <div
              className={`mt-1 tabular-nums leading-tight ${
                i === 0
                  ? "text-[30px] text-[#131416]"
                  : sc.value !== null
                    ? `text-[24px] ${scoreTone(sc.value)}`
                    : "text-[24px] text-[#8b8d90]"
              }`}
            >
              {sc.value !== null ? `${sc.value}%` : "—"}
            </div>
          </div>
        ))}
      </section>

      {/* Question tabs for multi-question sessions */}
      {answers.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-1 rounded-[8px] bg-[#f4f6f8] border border-[#e8eaec]">
          {answers.map((ans, idx) => (
            <button
              key={`${ans.question}-${idx}`}
              type="button"
              onClick={() => setAnswerTab(idx)}
              className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                idx === safeIdx
                  ? "bg-white text-[#131416] shadow-sm border border-[#e8eaec]"
                  : "text-[#5d5f60] hover:text-[#131416]"
              }`}
            >
              <span className="tabular-nums">Q{idx + 1}</span>
              <span className="text-[11px] text-[#5d5f60] tabular-nums">
                {starCount(ans.analysis)}/4 STAR
              </span>
            </button>
          ))}
        </div>
      )}

      {active && activeMetrics && (
        <>
          <div className="rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1b6c80]">
              Question {safeIdx + 1} of {answers.length}
            </div>
            <p className="text-[14px] font-medium text-[#131416] mt-0.5">
              {active.question}
            </p>
          </div>

          {/* What to improve */}
          <section className="rounded-[8px] border border-[#e8eaec] p-4 space-y-2">
            <h2 className="text-[15px] font-semibold text-[#131416]">
              What to improve
            </h2>
            {active.analysis.coaching.length > 0 ? (
              <ol className="space-y-1.5">
                {active.analysis.coaching.slice(0, 3).map((tip, i) => (
                  <li key={tip} className="flex gap-2.5 text-[14px] text-[#131416]">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#eef4f6] text-[#134e5e] text-[12px] font-medium flex items-center justify-center tabular-nums">
                      {i + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-[#5d5f60]">
                No improvements needed for this response.
              </p>
            )}
          </section>

          {/* Details */}
          <section className="rounded-[8px] border border-[#e8eaec] overflow-hidden">
            <Disclosure title="STAR breakdown" defaultOpen>
              <div className="space-y-3">
                {STAR_LABELS.map(([key, label]) => {
                  const section = active.analysis.star[key];
                  const pillarScore = activeMetrics.starPillarScores[key];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-medium text-[#131416]">
                          {label} ·{" "}
                          <span
                            className={
                              section.found ? "text-[#1e7b4f]" : "text-[#c4242a]"
                            }
                          >
                            {section.found ? "Found" : "Missing"}
                          </span>
                        </span>
                        <span
                          className={`tabular-nums font-medium ${scoreTone(pillarScore)}`}
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
                      <p className="text-[12px] text-[#5d5f60]">
                        {section.explanation}
                      </p>
                      {section.sentences.length > 0 && (
                        <ul className="space-y-1 pt-0.5">
                          {section.sentences.map((sent, sIdx) => (
                            <li
                              key={sIdx}
                              className="text-[11.5px] text-[#25272a] border-l-2 border-[#1b6c80] pl-2"
                            >
                              {sent}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-[12px] text-[#134e5e]">
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
                      className="border-t border-[#f0f1f2] pt-2.5 first:border-0 first:pt-0 space-y-1.5"
                    >
                      <div className="text-[12.5px] font-medium text-[#131416]">
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
              </Disclosure>
            )}

            <Disclosure title="Speech & presence details">
              <div className="space-y-3">
                {active.speech ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                    <div>
                      <dt className="text-[#5d5f60]">Pace</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {active.speech.wpm} WPM
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5d5f60]">Fillers / min</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {active.speech.fillersPerMin.toFixed(1)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5d5f60]">Long pauses</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {active.speech.longPauses}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5d5f60]">Words used</dt>
                      <dd className="text-[#131416] font-medium">
                        {active.speech.fillers.length
                          ? active.speech.fillers.join(", ")
                          : "None"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-[13px] text-[#5d5f60]">
                    Text-only answer — no audio delivery metrics recorded.
                  </p>
                )}

                {active.vision ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] pt-2 border-t border-[#f0f1f2]">
                    <div>
                      <dt className="text-[#5d5f60]">Eye contact</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {Math.round(active.vision.eyeContactScore)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5d5f60]">Posture</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {Math.round(active.vision.postureScore)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5d5f60]">Eye nudges</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {active.vision.eyeNudges}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5d5f60]">Posture nudges</dt>
                      <dd className="text-[#131416] font-medium tabular-nums">
                        {active.vision.postureNudges}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-[12.5px] text-[#5d5f60]">
                    Camera was off or paused — no vision metrics captured.
                  </p>
                )}
              </div>
            </Disclosure>

            <Disclosure title="Transcript">
              <p className="text-[14px] text-[#45474a] leading-relaxed">
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
                  <p className="text-[13px] text-[#45474a]">
                    {tailorReport.summary}
                  </p>
                  {tailorReport.matchedSkills.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1e7b4f]">
                        Matched on resume
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tailorReport.matchedSkills.map((skill) => (
                          <span key={skill} className="pill-positive">
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tailorReport.missingSkills.length > 0 && (
                    <div className="space-y-1">
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-wide ${
                          tailorReport.hasResume ? "text-[#c4242a]" : "text-[#134e5e]"
                        }`}
                      >
                        {tailorReport.hasResume
                          ? "Missing / gap areas"
                          : "Target skills"}
                      </div>
                      <div className="flex flex-wrap gap-1">
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
                    <ul className="space-y-1 pt-1 border-t border-[#f0f1f2]">
                      {tailorReport.tailoringTips.map((tip, idx) => (
                        <li key={idx} className="flex gap-2 text-[12.5px] text-[#25272a]">
                          <span className="text-[#1b6c80]">•</span>
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

function SampleSessionReport({ s }: { s: PracticeSession }) {
  const delivery = Math.round(
    Math.max(
      0,
      100 -
        s.fillersPerMin * 10 -
        s.longPauses * 4 -
        Math.abs(s.wpm - 135) / 2
    )
  );
  const presence = Math.round(Math.max(0, s.eyeContact - s.postureAlerts * 5));

  const scores = [
    { label: "Overall", value: s.overall },
    { label: "Content (STAR)", value: s.starScore },
    { label: "Delivery", value: delivery },
    { label: "Eye contact & posture", value: presence },
  ];

  return (
    <>
      {/* Scores */}
      <section className="rounded-[8px] border border-[#e8eaec] grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e8eaec]">
        {scores.map((sc, i) => (
          <div
            key={sc.label}
            className={`p-4 ${i >= 2 ? "border-t sm:border-t-0 border-[#e8eaec]" : ""}`}
          >
            <div className="text-[13px] text-[#5d5f60]">{sc.label}</div>
            <div
              className={`mt-1 tabular-nums leading-tight ${
                i === 0
                  ? "text-[30px] text-[#131416]"
                  : `text-[24px] ${scoreTone(sc.value)}`
              }`}
            >
              {sc.value}%
            </div>
          </div>
        ))}
      </section>

      {/* What to improve */}
      <section className="rounded-[8px] border border-[#e8eaec] p-4 space-y-2">
        <h2 className="text-[15px] font-semibold text-[#131416]">
          What to improve
        </h2>
        <ol className="space-y-1.5">
          {s.improvements.slice(0, 3).map((tip, i) => (
            <li key={tip} className="flex gap-2.5 text-[14px] text-[#131416]">
              <span className="w-5 h-5 shrink-0 rounded-full bg-[#eef4f6] text-[#134e5e] text-[12px] font-medium flex items-center justify-center">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ol>
      </section>

      {/* Details, closed by default */}
      <section className="rounded-[8px] border border-[#e8eaec] overflow-hidden">
        <Disclosure title="STAR breakdown">
          <div className="space-y-3">
            {STAR_LABELS.map(([key, label]) => {
              const p = s.star[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium text-[#131416]">{label}</span>
                    <span className={`tabular-nums font-medium ${scoreTone(p.score)}`}>
                      {p.score}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#f0f1f2] rounded-[2px] overflow-hidden">
                    <div
                      className={`h-full ${
                        p.score >= 80 ? "bg-[#1b6c80]" : "bg-[#c4242a]"
                      }`}
                      style={{ width: `${p.score}%` }}
                    />
                  </div>
                  <p className="text-[12px] text-[#5d5f60]">{p.note}</p>
                </div>
              );
            })}
          </div>
        </Disclosure>

        <Disclosure title="Speech details">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
            <div>
              <dt className="text-[#5d5f60]">Pace</dt>
              <dd className="text-[#131416] font-medium tabular-nums">
                {s.wpm} WPM
              </dd>
            </div>
            <div>
              <dt className="text-[#5d5f60]">Fillers / min</dt>
              <dd className="text-[#131416] font-medium tabular-nums">
                {s.fillersPerMin.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-[#5d5f60]">Long pauses</dt>
              <dd className="text-[#131416] font-medium tabular-nums">
                {s.longPauses}
              </dd>
            </div>
            <div>
              <dt className="text-[#5d5f60]">Words used</dt>
              <dd className="text-[#131416] font-medium">
                {s.fillers.join(", ")}
              </dd>
            </div>
          </dl>
        </Disclosure>

        <Disclosure title="Transcript">
          <p className="text-[14px] text-[#45474a] leading-relaxed">
            {s.transcript}
          </p>
        </Disclosure>
      </section>
    </>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const savedSessions = useSyncExternalStore(
    subscribeSessions,
    getSessionsSnapshot,
    () => EMPTY_SESSIONS
  );

  const [manualSelectionId, setManualSelectionId] = useState<string | null>(null);
  const requestedId = searchParams.get("session");

  const selectedId =
    manualSelectionId ??
    (requestedId &&
    (savedSessions.some((s) => s.id === requestedId) ||
      SESSIONS.some((s) => s.id === requestedId))
      ? requestedId
      : savedSessions[0]?.id ?? SESSIONS[0].id);

  const activeSaved = savedSessions.find((s) => s.id === selectedId);
  const activeSample =
    SESSIONS.find((s) => s.id === selectedId) ?? SESSIONS[0];

  const subtitle = activeSaved
    ? `${formatTarget(activeSaved)} · ${activeSaved.answers.length} ${
        activeSaved.answers.length === 1 ? "answer" : "answers"
      }`
    : activeSample.question;

  return (
    <div className="max-w-[880px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-[22px] font-semibold text-[#131416] tracking-tight">
            Session report
          </h1>
          <p className="text-[14px] text-[#5d5f60] truncate">{subtitle}</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#5d5f60] shrink-0">
          Session
          <select
            value={activeSaved ? activeSaved.id : activeSample.id}
            onChange={(e) => setManualSelectionId(e.target.value)}
            className="h-[34px] px-2 rounded-[6px] border border-[#cdced1] bg-white text-[13px] text-[#131416] cursor-pointer focus:outline-none focus:border-[#1b6c80]"
          >
            {savedSessions.length > 0 && (
              <optgroup label="Your practice sessions">
                {savedSessions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {formatDate(x.completedAt)} · {formatTarget(x)} (
                    {x.answers.length}Q)
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Sample sessions">
              {SESSIONS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.date} · {x.role}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      {activeSaved ? (
        <SavedSessionReport key={activeSaved.id} session={activeSaved} />
      ) : (
        <SampleSessionReport s={activeSample} />
      )}

      <div className="flex justify-end">
        <Link
          href="/interview"
          className="h-[36px] px-4 rounded-[6px] bg-[#1b6c80] text-white text-[13px] font-medium hover:bg-[#134e5e] flex items-center gap-1.5"
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
        <div className="max-w-[880px] mx-auto py-8 text-[13px] text-[#5d5f60]">
          Loading session report…
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
