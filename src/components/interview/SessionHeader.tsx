"use client";

import Link from "next/link";

interface SessionHeaderProps {
  elapsedTime: string;
  questionNumber: number;
  totalQuestions: number;
  role: string;
  track: string;
  isAiListening: boolean;
  onEndSession: () => void;
}

export default function SessionHeader({
  elapsedTime,
  questionNumber,
  totalQuestions,
  role,
  track,
  isAiListening,
  onEndSession,
}: SessionHeaderProps) {
  return (
    <header className="w-full h-[48px] bg-[#f9fbfc] border-b border-[#e8eaec] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back to Overview */}
        <Link
          href="/"
          className="h-[30px] px-2.5 rounded-[6px] bg-white border border-[#cdced1] hover:bg-[#f4f6f8] text-[#131416] text-[12px] font-medium flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-[15px] leading-none">
            arrow_back
          </span>
          <span>Overview</span>
        </Link>

        <div className="w-px h-4 bg-[#e8eaec] hidden sm:block" />

        {/* Question & Role Scope */}
        <div className="hidden sm:flex items-center gap-2 text-[13px] min-w-0">
          <span className="font-medium text-[#131416] font-mono tabular-nums">
            Q{questionNumber}/{totalQuestions}
          </span>
          <span className="text-[#cdced1]">·</span>
          <span className="text-[#131416] font-medium truncate">{role}</span>
          <span className="text-[#5d5f60] hidden md:inline truncate">
            ({track})
          </span>
        </div>
      </div>

      {/* Right: Studio Timer, AI Status & End Session */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Live Timer */}
        <div className="h-[30px] px-2.5 rounded-[6px] bg-white border border-[#e8eaec] flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isAiListening ? "bg-[#c4242a]" : "bg-[#cdced1]"
            }`}
          />
          <span className="font-mono tabular-nums text-[13px] font-medium text-[#131416]">
            {elapsedTime}
          </span>
        </div>

        {/* AI Pipeline Status */}
        <div className="hidden md:flex h-[30px] px-2.5 rounded-[6px] bg-white border border-[#e8eaec] items-center gap-1.5 text-[12px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAiListening ? "bg-[#1e7b4f]" : "bg-[#5d5f60]"
            }`}
          />
          <span className="text-[#5d5f60]">Pipeline:</span>
          <span className="font-medium text-[#131416]">
            {isAiListening ? "Active" : "Standby"}
          </span>
        </div>

        {/* End Session Action */}
        <button
          type="button"
          onClick={onEndSession}
          className="h-[30px] px-3 rounded-[6px] bg-[#ffedea] text-[#831c1e] hover:bg-[#fbd7d1] transition-colors text-[12px] font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px] leading-none">
            stop_circle
          </span>
          <span>End Session</span>
        </button>
      </div>
    </header>
  );
}
