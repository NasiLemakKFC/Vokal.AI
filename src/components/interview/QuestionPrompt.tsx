"use client";

import { useState } from "react";

interface QuestionPromptProps {
  question: string;
  isRecording?: boolean;
}

const WAVEFORM_BARS = [
  12, 18, 28, 34, 22, 16, 26, 36, 30, 20, 28, 14, 24, 34, 28, 18, 22, 12, 26,
  16, 32, 36, 22, 28, 18, 24, 14, 20, 30, 16,
];

export default function QuestionPrompt({
  question,
  isRecording = true,
}: QuestionPromptProps) {
  const [showCriteria, setShowCriteria] = useState(false);

  return (
    <div className="card space-y-3.5">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[#5d5f60]">
            Behavioral Prompt
          </span>
          <span className="badge">STAR Method</span>
        </div>

        {/* Dropdown Button for Target Keywords & Rubric Criteria */}
        <button
          type="button"
          onClick={() => setShowCriteria((prev) => !prev)}
          aria-expanded={showCriteria}
          className="h-[26px] px-2 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Rubric Keywords</span>
          <span className="material-symbols-outlined text-[15px] text-[#5d5f60]">
            {showCriteria ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {/* Main Prompt Question */}
      <h1 className="text-[16px] md:text-[18px] text-[#131416] font-semibold leading-snug tracking-tight">
        {question}
      </h1>

      {/* Collapsible Rubric Criteria & Target Keywords Drawer */}
      {showCriteria && (
        <div className="p-3 rounded-[6px] bg-[#f9fbfc] border border-[#e8eaec] space-y-2">
          <div className="text-[12px] font-medium text-[#131416]">
            Target Industry Keywords (Syafiq NLP Module 3)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Root-cause isolation",
              "APM / logs",
              "Rollback plan",
              "Stakeholder update",
              "Post-mortem metric",
            ].map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-[4px] bg-white border border-[#e8eaec] text-[11px] text-[#45474a] font-mono"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compact Studio Audio Monitor */}
      <div className="bg-[#f9fbfc] rounded-[6px] px-3 py-2.5 border border-[#e8eaec] space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 font-medium text-[#131416]">
            <span
              className={`w-2 h-2 rounded-full ${
                isRecording ? "bg-[#1e7b4f]" : "bg-[#cdced1]"
              }`}
            />
            {isRecording ? "Whisper ASR Stream Active" : "Microphone Standby"}
          </span>
          <span className="text-[11px] text-[#5d5f60] tabular-nums font-mono">
            48.0 kHz · −14.2 dBFS
          </span>
        </div>

        {/* Clean SVG / Bar Level Meter */}
        <div className="h-7 w-full flex items-end gap-1 overflow-hidden">
          {WAVEFORM_BARS.map((heightPx, index) => (
            <div
              key={index}
              className={`flex-1 rounded-[1px] transition-all duration-300 ${
                isRecording
                  ? index % 5 === 0
                    ? "bg-[#1b6c80]"
                    : "bg-[#b8d4dc]"
                  : "bg-[#e8eaec]"
              }`}
              style={{
                height: isRecording ? `${heightPx}px` : "6px",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
