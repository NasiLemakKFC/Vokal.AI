"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SESSIONS, STAR_LABELS, type PracticeSession, type StarPillar } from "@/lib/mockSessions";
import {
  EMPTY_SESSIONS,
  computeAnswerMetrics,
  computeSessionMetrics,
  getSessionsSnapshot,
  subscribeSessions,
  type SavedSession,
} from "@/lib/nlp/sessionStore";
import type { StarKey } from "@/lib/nlp/types";
import { prewarmVisionFileset } from "@/lib/vision/MediaPipeSetup";

function scoreTone(score: number) {
  return score >= 80 ? "text-[#1e7b4f]" : score >= 70 ? "text-[#92400e]" : "text-[#c4242a]";
}

interface UnifiedHomeSession {
  id: string;
  isSaved: boolean;
  question: string;
  roleLabel: string;
  dateLabel: string;
  answerCount: number;
  overall: number;
  starScore: number;
  eyeContact: number;
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
      perAnswer.reduce((sum, a) => sum + a.starPillarScores[key], 0) / perAnswer.length
    );
  };

  const firstAns = s.answers[0];
  const star: Record<StarKey, StarPillar> = {
    situation: {
      score: avgPillar("situation"),
      note:
        firstAns?.analysis.star.situation.suggestion ||
        firstAns?.analysis.star.situation.explanation ||
        "Clarify the project context and constraints.",
    },
    task: {
      score: avgPillar("task"),
      note:
        firstAns?.analysis.star.task.suggestion ||
        firstAns?.analysis.star.task.explanation ||
        "State your specific responsibility and success goal.",
    },
    action: {
      score: avgPillar("action"),
      note:
        firstAns?.analysis.star.action.suggestion ||
        firstAns?.analysis.star.action.explanation ||
        "Detail the concrete engineering decisions you took.",
    },
    result: {
      score: avgPillar("result"),
      note:
        firstAns?.analysis.star.result.suggestion ||
        firstAns?.analysis.star.result.explanation ||
        "Quantify the final outcome with a concrete number or percentage.",
    },
  };

  const speechAnswers = s.answers.filter((a) => Boolean(a.speech));
  const fillersPerMin =
    speechAnswers.length > 0
      ? +(
          speechAnswers.reduce((sum, a) => sum + (a.speech?.fillersPerMin ?? 0), 0) /
          speechAnswers.length
        ).toFixed(1)
      : 0;

  const roleLabel =
    s.mode === "general"
      ? "General Interview"
      : s.company.trim()
        ? `${s.company.trim()} · ${s.role}`
        : s.role;

  const topImprovement =
    firstAns?.analysis.coaching[0] ||
    "Finish your STAR response with a measurable outcome.";

  return {
    id: s.id,
    isSaved: true,
    question: firstAns?.question || "Practice session",
    roleLabel,
    dateLabel: formatSavedDate(s.completedAt),
    answerCount: s.answers.length,
    overall: s.overallScore ?? metrics.overallScore,
    starScore: s.starScore ?? metrics.starScore,
    eyeContact: metrics.avgEyeContact ?? 85,
    fillersPerMin,
    star,
    topImprovement,
  };
}

function mapSampleToUnified(s: PracticeSession): UnifiedHomeSession {
  return {
    id: s.id,
    isSaved: false,
    question: s.question,
    roleLabel: s.role,
    dateLabel: s.date,
    answerCount: 1,
    overall: s.overall,
    starScore: s.starScore,
    eyeContact: s.eyeContact,
    fillersPerMin: s.fillersPerMin,
    star: s.star,
    topImprovement: s.improvements[0] ?? "Quantify the final result with concrete metrics.",
  };
}

export default function Home() {
  const [openId, setOpenId] = useState<string | null>(null);

  const savedSessions = useSyncExternalStore(
    subscribeSessions,
    getSessionsSnapshot,
    () => EMPTY_SESSIONS
  );

  // Pre-warm MediaPipe WASM fileset & model cache during idle time on Home
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void prewarmVisionFileset();
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  const unifiedSessions = useMemo<UnifiedHomeSession[]>(() => {
    const saved = savedSessions.map(mapSavedToUnified);
    const samples = SESSIONS.map(mapSampleToUnified);
    return saved.length > 0 ? [...saved, ...samples.slice(0, Math.max(0, 3 - saved.length))] : samples;
  }, [savedSessions]);

  const last = unifiedSessions[0];
  const prev = unifiedSessions[1] ?? unifiedSessions[0];
  const hasUserSessions = savedSessions.length > 0;

  const weakest = STAR_LABELS.reduce((min, cur) =>
    last.star[cur[0]].score < last.star[min[0]].score ? cur : min
  );

  const figures = [
    {
      label: "STAR score",
      value: `${last.starScore}%`,
      delta: last.starScore - prev.starScore,
      higherIsBetter: true,
    },
    {
      label: "Eye contact",
      value: `${last.eyeContact}%`,
      delta: last.eyeContact - prev.eyeContact,
      higherIsBetter: true,
    },
    {
      label: "Fillers per minute",
      value: last.fillersPerMin.toFixed(1),
      delta: +(last.fillersPerMin - prev.fillersPerMin).toFixed(1),
      higherIsBetter: false,
    },
  ];

  return (
    <div className="max-w-[880px] mx-auto space-y-6">
      {/* Title + one finding + main action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold text-[#131416] tracking-tight">
              Welcome back, Amirul
            </h1>
            {hasUserSessions && (
              <span className="pill-positive">
                {savedSessions.length} completed{" "}
                {savedSessions.length === 1 ? "session" : "sessions"}
              </span>
            )}
          </div>
          <p className="text-[14px] text-[#5d5f60]">
            Last session scored{" "}
            <span className="font-medium text-[#131416] tabular-nums">{last.overall}%</span>. Work
            on your <span className="font-medium text-[#131416]">{weakest[1]}</span> —{" "}
            {last.star[weakest[0]].note.toLowerCase()}
          </p>
        </div>
        <Link
          href="/interview"
          onMouseEnter={() => void prewarmVisionFileset()}
          className="h-[36px] px-4 rounded-[6px] bg-[#1b6c80] text-white text-[13px] font-medium hover:bg-[#134e5e] transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
          Start practice
        </Link>
      </div>

      {/* Three figures from the latest session */}
      <section className="rounded-[8px] border border-[#e8eaec] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#e8eaec]">
        {figures.map((f) => {
          const good = f.higherIsBetter ? f.delta >= 0 : f.delta <= 0;
          return (
            <div key={f.label} className="p-4">
              <div className="text-[13px] text-[#5d5f60]">{f.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[26px] text-[#131416] tabular-nums leading-tight">
                  {f.value}
                </span>
                <span
                  className={`text-[12px] tabular-nums ${
                    good ? "text-[#1e7b4f]" : "text-[#c4242a]"
                  }`}
                >
                  {f.delta > 0 ? "+" : ""}
                  {f.delta}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Recent sessions */}
      <section className="rounded-[8px] border border-[#e8eaec]">
        <div className="px-4 h-[48px] flex items-center justify-between border-b border-[#e8eaec]">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-[#131416]">Recent sessions</h2>
            {!hasUserSessions && (
              <span className="badge">Sample preview</span>
            )}
          </div>
          <Link href="/reports" className="text-[13px] font-medium text-[#1b6c80] hover:underline">
            All reports
          </Link>
        </div>

        <ul className="divide-y divide-[#f0f1f2]">
          {unifiedSessions.map((s) => {
            const isOpen = openId === s.id;
            return (
              <li key={s.id}>
                <div className="px-4 py-3 flex items-center gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[14px] font-medium text-[#131416] truncate">
                        {s.question}
                      </div>
                      {s.isSaved ? (
                        <span className="pill-positive shrink-0">
                          {s.answerCount > 1 ? `${s.answerCount}Q` : "Saved"}
                        </span>
                      ) : (
                        hasUserSessions && (
                          <span className="badge shrink-0">Sample</span>
                        )
                      )}
                    </div>
                    <div className="text-[12px] text-[#5d5f60]">
                      {s.roleLabel} · {s.dateLabel}
                    </div>
                  </div>
                  <span className={`text-[15px] font-medium tabular-nums ${scoreTone(s.overall)}`}>
                    {s.overall}%
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                      aria-expanded={isOpen}
                      className="h-[30px] px-2.5 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] flex items-center gap-0.5 cursor-pointer"
                    >
                      STAR
                      <span className="material-symbols-outlined text-[16px]">
                        {isOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                    <Link
                      href={`/reports?session=${encodeURIComponent(s.id)}`}
                      title="Open full session report"
                      className="h-[30px] px-2.5 rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] hover:bg-[#eef4f6] text-[12px] font-medium text-[#1b6c80] flex items-center gap-0.5"
                    >
                      Report
                      <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                    </Link>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {STAR_LABELS.map(([key, label]) => {
                        const p = s.star[key];
                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex justify-between text-[12px]">
                              <span className="text-[#131416]">{label}</span>
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
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[13px] text-[#45474a]">{s.topImprovement}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
