"use client";

import { useState } from "react";

interface LiveCoachingTipProps {
  tip: string;
}

export default function LiveCoachingTip({ tip }: LiveCoachingTipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full px-4 h-[40px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#1b6c80] leading-none">
            lightbulb
          </span>
          <span className="text-[13px] font-medium text-[#131416]">
            AI Coaching Hint
          </span>
          <span className="badge">1 tip available</span>
        </div>

        <div className="flex items-center gap-1 text-[12px] text-[#5d5f60]">
          <span>{isOpen ? "Hide" : "Show"}</span>
          <span className="material-symbols-outlined text-[16px]">
            {isOpen ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 py-3 bg-[#f9fbfc] border-t border-[#f0f1f2]">
          <p className="text-[13px] text-[#131416] leading-relaxed">{tip}</p>
        </div>
      )}
    </div>
  );
}
