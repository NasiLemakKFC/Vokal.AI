"use client";

import { useState, type ReactNode } from "react";
import type { AnswerSentence, StarKey } from "@/lib/nlp/types";
import type { SpeechPauseEvent, SpeechUi } from "@/lib/speechApi";

interface AnnotatedTranscriptProps {
  transcript: string;
  sentences: AnswerSentence[];
  speech?: SpeechUi | null;
}

const STAR_LABELS: Record<StarKey, { label: string; badgeClass: string; borderClass: string }> = {
  situation: {
    label: "Situation",
    badgeClass: "bg-[var(--star-s-bg)] text-[var(--text)] border-[var(--star-s-border)]",
    borderClass: "border-[var(--star-s-border)] bg-[var(--star-s-bg)]",
  },
  task: {
    label: "Task",
    badgeClass: "bg-[var(--star-t-bg)] text-[var(--text)] border-[var(--star-t-border)]",
    borderClass: "border-[var(--star-t-border)] bg-[var(--star-t-bg)]",
  },
  action: {
    label: "Action",
    badgeClass: "bg-[var(--star-a-bg)] text-[var(--text)] border-[var(--star-a-border)]",
    borderClass: "border-[var(--star-a-border)] bg-[var(--star-a-bg)]",
  },
  result: {
    label: "Result",
    badgeClass: "bg-[var(--star-r-bg)] text-[var(--text)] border-[var(--star-r-border)]",
    borderClass: "border-[var(--star-r-border)] bg-[var(--star-r-bg)]",
  },
};

const HARD_FILLERS = new Set([
  "um",
  "umm",
  "ummm",
  "ummp",
  "uh",
  "uhh",
  "ah",
  "er",
  "erm",
  "em",
  "emm",
  "ehm",
  "eh",
  "hmm",
  "hm",
  "mm",
  "mmm",
]);

const MANGLISH_FILLERS = new Set([
  "lah",
  "la",
  "leh",
  "lor",
  "mah",
  "kan",
  "wei",
  "weh",
  "bro",
  "sis",
  "ya",
]);

const PHRASE_FILLERS: readonly [string, string][] = [
  ["you", "know"],
  ["i", "mean"],
  ["sort", "of"],
  ["kind", "of"],
];

function normToken(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

function renderSpeechAnnotatedTokens(
  text: string,
  pauseEvents: SpeechPauseEvent[]
): ReactNode[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const remainingPauses = pauseEvents.map((p) => ({
    ...p,
    normAfter: normToken(p.afterWord),
    used: false,
  }));

  const nodes: ReactNode[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const tok = normToken(word);
    const nextTok = i + 1 < words.length ? normToken(words[i + 1]) : "";

    let consumedPhrase = false;
    for (const [a, b] of PHRASE_FILLERS) {
      if (tok === a && nextTok === b) {
        nodes.push(
          <span
            key={`pf-${i}`}
            title="Phrase filler"
            className="inline-block rounded-[4px] px-1.5 py-0.5 mx-0.5 text-[12px] font-medium bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)] border border-[var(--pill-warning-border)]"
          >
            {word} {words[i + 1]}
          </span>
        );
        consumedPhrase = true;
        i += 1;
        break;
      }
    }

    if (!consumedPhrase) {
      if (MANGLISH_FILLERS.has(tok)) {
        nodes.push(
          <span
            key={`mf-${i}`}
            title="Malaysian conversational particle"
            className="inline-block rounded-[4px] px-1.5 py-0.5 mx-0.5 text-[12px] font-medium bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] border border-[var(--pill-negative-border)]"
          >
            {word}
          </span>
        );
      } else if (HARD_FILLERS.has(tok)) {
        nodes.push(
          <span
            key={`hf-${i}`}
            title="Filler word"
            className="inline-block rounded-[4px] px-1.5 py-0.5 mx-0.5 text-[12px] font-medium bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)] border border-[var(--pill-warning-border)]"
          >
            {word}
          </span>
        );
      } else {
        nodes.push(<span key={`w-${i}`}>{word} </span>);
      }
    }

    // Attach matching long pause marker right after the word where it occurred
    const matchTok = consumedPhrase ? nextTok : tok;
    const matchedPause = remainingPauses.find(
      (p) => !p.used && p.normAfter && p.normAfter === matchTok
    );
    if (matchedPause) {
      matchedPause.used = true;
      nodes.push(
        <span
          key={`pause-${i}-${matchedPause.atSec}`}
          title={`Long pause at ${matchedPause.atSec}s`}
          className="inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 mx-1 text-[11px] font-mono tabular-nums bg-[var(--raised)] text-[var(--muted)] border border-[var(--border)]"
        >
          {matchedPause.lengthSec.toFixed(1)}s pause
        </span>
      );
    }
  }

  return nodes;
}

export default function AnnotatedTranscript({
  transcript,
  sentences,
  speech,
}: AnnotatedTranscriptProps) {
  const rawText = speech?.rawTranscript?.trim() || "";
  const pauseEvents = speech?.pauseEvents ?? [];
  const hasSpeechMarkers = Boolean(
    rawText &&
      ((speech?.fillerCount ?? 0) > 0 ||
        (speech?.manglishCount ?? 0) > 0 ||
        pauseEvents.length > 0)
  );

  const [viewMode, setViewMode] = useState<"star" | "speech">(
    hasSpeechMarkers ? "speech" : "star"
  );

  const manglishCount = speech?.manglishCount ?? 0;
  const manglishFillers = speech?.manglishFillers ?? [];

  if (!transcript.trim() && !rawText) {
    return (
      <p className="text-[13px] text-[var(--muted)]">No transcript recorded.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle + legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--active)]/80 p-1">
          <button
            type="button"
            onClick={() => setViewMode("star")}
            className={`h-7 px-2.5 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium cursor-pointer transition-colors ${
              viewMode === "star"
                ? "bg-[var(--surface)] text-[var(--text)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            STAR tags ({sentences.length})
          </button>
          {speech && (
            <button
              type="button"
              onClick={() => setViewMode("speech")}
              className={`h-7 px-2.5 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium cursor-pointer transition-colors ${
                viewMode === "speech"
                  ? "bg-[var(--surface)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Fillers &amp; pauses
            </button>
          )}
        </div>

        {viewMode === "speech" && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--pill-warning-bg)] border border-[var(--pill-warning-border)]" />
              Filler
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--pill-negative-bg)] border border-[var(--pill-negative-border)]" />
              Manglish particle
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--raised)] border border-[var(--border)]" />
              Pause ≥2s
            </span>
          </div>
        )}
      </div>

      {/* Malaysian English / Manglish formality callout */}
      {manglishCount > 0 && (
        <div className="rounded-[var(--radius-control)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3 py-2 text-[12px] text-[var(--pill-warning-ink)] flex flex-wrap items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] shrink-0">
            record_voice_over
          </span>
          <span>
            Detected{" "}
            <strong className="font-medium">
              {manglishCount} Malaysian conversational{" "}
              {manglishCount === 1 ? "particle" : "particles"}
            </strong>
            {manglishFillers.length > 0 ? ` (${manglishFillers.join(", ")})` : ""}. Trim
            informal particles when speaking in formal English interviews.
          </span>
        </div>
      )}

      {viewMode === "speech" && speech ? (
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-[14px] text-[var(--text-secondary)] leading-relaxed">
          {renderSpeechAnnotatedTokens(rawText || transcript, pauseEvents)}
        </div>
      ) : sentences.length > 0 ? (
        <div className="space-y-1.5">
          {sentences.map((item, sIdx) => {
            const meta =
              item.section === "unclassified" ? null : STAR_LABELS[item.section];
            return (
              <div
                key={sIdx}
                className={`rounded-[var(--radius-control)] border-l-[3px] px-3 py-2 ${
                  meta ? meta.borderClass : "border-[var(--control)] bg-[var(--raised)]"
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--muted)]">
                  {meta ? meta.label : "Supporting detail"}
                </div>
                <p className="text-[13px] text-[var(--text)] mt-0.5 leading-relaxed">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          {transcript}
        </p>
      )}
    </div>
  );
}
