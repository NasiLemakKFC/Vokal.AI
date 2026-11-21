"use client";

import { useState } from "react";
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
          <span className="flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
            <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-[#c4242a]" : "bg-[#cdced1]"}`} />
            {isRecording ? "Listening" : "Not recording"}
          </span>
          {questionType && (
            <span className="badge !text-[11px]">
              {QUESTION_TYPE_LABELS[questionType]}
            </span>
          )}
        </div>
        {keywords.length > 0 && (
          <button
            type="button"
            onClick={() => setShowKeywords((prev) => !prev)}
            aria-expanded={showKeywords}
            className="h-[26px] px-2 rounded-[6px] text-[12px] font-medium text-[#1b6c80] hover:bg-[#eef4f6] flex items-center gap-0.5 cursor-pointer"
          >
            Keywords
            <span className="material-symbols-outlined text-[16px]">
              {showKeywords ? "expand_less" : "expand_more"}
            </span>
          </button>
        )}
      </div>

      <h2 className="text-[18px] text-[#131416] font-semibold leading-snug tracking-tight">{question}</h2>

      {rationale && (
        <p className="text-[12px] text-[#5d5f60] leading-snug">{rationale}</p>
      )}

      {showKeywords && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {keywords.map((kw) => (
            <span key={kw} className="badge">
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
