"use client";

import type { LlmStarEvaluation, StarKey } from "@/lib/nlp/types";

interface StarFeedbackExtrasProps {
  evaluation: LlmStarEvaluation;
  hideRewrite?: boolean;
}

const PROVIDER_LABELS: Record<LlmStarEvaluation["provider"], string> = {
  groq: "Groq AI",
  gemini: "Gemini AI",
  ollama: "Local LLM",
};

const PILLAR_META: {
  key: StarKey;
  letter: string;
  label: string;
  colorVar: string;
  idealPct: number;
}[] = [
  { key: "situation", letter: "S", label: "Situation", colorVar: "var(--star-s-border)", idealPct: 15 },
  { key: "task", letter: "T", label: "Task", colorVar: "var(--star-t-border)", idealPct: 10 },
  { key: "action", letter: "A", label: "Action", colorVar: "var(--star-a-border)", idealPct: 55 },
  { key: "result", letter: "R", label: "Result", colorVar: "var(--star-r-border)", idealPct: 20 },
];

export default function StarFeedbackExtras({
  evaluation,
  hideRewrite = false,
}: StarFeedbackExtrasProps) {
  const targetMeta =
    PILLAR_META.find((p) => p.key === evaluation.strongerRewrite.targetPillar) ??
    PILLAR_META[3];

  const relevancePill =
    evaluation.relevanceScore >= 80
      ? "pill-positive"
      : evaluation.relevanceScore >= 60
        ? "pill-warning"
        : "pill-negative";

  return (
    <div className="space-y-3">
      {/* Relevance + Personal Ownership + STAR Balance */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)]/50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--text)]">
              AI STAR rubric insights
            </span>
            <span className={relevancePill}>
              Prompt relevance · {evaluation.relevanceScore}%
            </span>
          </div>
          <span className="text-[11px] font-mono text-[var(--muted)]">
            {PROVIDER_LABELS[evaluation.provider]} · {evaluation.model}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
            <div className="font-medium text-[var(--text)]">Question alignment</div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {evaluation.relevanceNote}
            </p>
          </div>
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
            <div className="font-medium text-[var(--text)]">
              Personal ownership (&ldquo;I&rdquo; vs &ldquo;We&rdquo;)
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {evaluation.ownershipNote}
            </p>
          </div>
        </div>

        {/* STAR Proportion Balance Bar */}
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="font-medium text-[var(--text)]">
              Answer time balance (S · T · A · R)
            </span>
            <span className="text-[11px] text-[var(--muted)] font-mono tabular-nums">
              Ideal ~15% · 10% · 55% · 20%
            </span>
          </div>

          <div
            className="h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--ring-track)]"
            role="img"
            aria-label={`STAR balance: Situation ${evaluation.starProportion.situation}%, Task ${evaluation.starProportion.task}%, Action ${evaluation.starProportion.action}%, Result ${evaluation.starProportion.result}%`}
          >
            {PILLAR_META.map((p) => {
              const pct = evaluation.starProportion[p.key];
              if (pct <= 0) return null;
              return (
                <div
                  key={p.key}
                  style={{ width: `${pct}%`, backgroundColor: p.colorVar }}
                  title={`${p.label}: ${pct}%`}
                  className="h-full transition-[width] duration-300"
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)] font-mono tabular-nums">
            {PILLAR_META.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: p.colorVar }}
                />
                <span>
                  {p.label} {evaluation.starProportion[p.key]}%
                </span>
              </span>
            ))}
          </div>

          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
            {evaluation.proportionFeedback}
          </p>
        </div>
      </div>

      {/* Stronger Rewrite Card */}
      {!hideRewrite && evaluation.strongerRewrite.example && (
        <div className="rounded-[var(--radius-card)] border border-[var(--border-accent)] bg-[var(--accent-soft)]/50 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[var(--accent-ink)]">
                auto_fix_high
              </span>
              <h4 className="text-[13px] font-medium text-[var(--accent-ink)]">
                How to say it better · Strengthen your {targetMeta.label}
              </h4>
            </div>
            <span className="text-[11px] text-[var(--muted)]">
              Grounded in your story
            </span>
          </div>
          <blockquote className="text-[13px] text-[var(--text)] leading-relaxed border-l-2 border-[var(--accent)] pl-3">
            &ldquo;{evaluation.strongerRewrite.example}&rdquo;
          </blockquote>
        </div>
      )}
    </div>
  );
}
