"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { InterviewQuestionType } from "@/lib/interview/types";

interface QuestionPromptProps {
  question: string;
  keywords?: string[];
  isRecording?: boolean;
  questionType?: InterviewQuestionType;
  rationale?: string;
}

const QUESTION_TYPE_LABELS: Record<InterviewQuestionType, string> = {
  resume_deep_dive: "Resume deep-dive",
  jd_gap: "JD gap probe",
  role_behavioral: "Role behavioral",
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Module 1 — the interview question, with optional target keywords behind a toggle. */
export default function QuestionPrompt({
  question,
  keywords = [],
  isRecording = false,
  questionType,
  rationale,
}: QuestionPromptProps) {
  const [showKeywords, setShowKeywords] = useState(false);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-2 text-[12px] font-medium ${
              isRecording ? "text-[var(--negative)]" : "text-[var(--muted)]"
            }`}
          >
            <span
              className={`inline-block rounded-full h-2 w-2 ${
                isRecording ? "bg-[var(--negative)]" : "bg-[var(--control)]"
              }`}
            />
            {isRecording ? "Listening" : "Ready"}
          </span>
          {questionType && (
            <span className="badge">{QUESTION_TYPE_LABELS[questionType]}</span>
          )}
        </div>
        {keywords.length > 0 && (
          <button
            type="button"
            onClick={() => setShowKeywords((prev) => !prev)}
            aria-expanded={showKeywords}
            className={`h-8 px-2.5 rounded-[var(--radius-control)] text-[12px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              showKeywords
                ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]/70"
            }`}
          >
            Keywords
            <motion.span
              animate={{ rotate: showKeywords ? 180 : 0 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="material-symbols-outlined text-[16px]"
            >
              expand_more
            </motion.span>
          </button>
        )}
      </div>

      <h2 className="text-[18px] font-medium text-[var(--text)] leading-snug">
        {question}
      </h2>

      {rationale && (
        <p className="text-[13px] text-[var(--muted)] leading-snug">
          {rationale}
        </p>
      )}

      <AnimatePresence initial={false}>
        {showKeywords && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex flex-wrap gap-1.5 pt-1"
          >
            {keywords.map((kw) => (
              <span key={kw} className="badge">
                {kw}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
