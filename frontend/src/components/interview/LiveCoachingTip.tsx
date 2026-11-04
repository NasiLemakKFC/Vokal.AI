"use client";

import { useState } from "react";

interface LiveCoachingTipProps {
  tip: string;
}

/** One-line coaching hint, hidden until clicked so it never distracts mid-answer. */
export default function LiveCoachingTip({ tip }: LiveCoachingTipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-[8px] border border-[#e8eaec] bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full px-4 h-[40px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer rounded-[8px]"
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-[#131416]">
          <span className="material-symbols-outlined text-[16px] text-[#1b6c80]">lightbulb</span>
          Coaching tip
        </span>
        <span className="material-symbols-outlined text-[16px] text-[#5d5f60]">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>
      {isOpen && <p className="px-4 pb-3 text-[13px] text-[#45474a] leading-relaxed">{tip}</p>}
    </div>
  );
}
