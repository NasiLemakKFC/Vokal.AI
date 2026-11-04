"use client";

import { useState } from "react";

interface QuestionPromptProps {
  question: string;
  keywords?: string[];
  isRecording?: boolean;
}

/** Module 1 — the interview question, with optional target keywords behind a toggle. */
export default function QuestionPrompt({
  question,
  keywords = [],
  isRecording = false,
}: QuestionPromptProps) {
  const [showKeywords, setShowKeywords] = useState(false);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
          <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-[#c4242a]" : "bg-[#cdced1]"}`} />
          {isRecording ? "Listening" : "Not recording"}
        </span>
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
