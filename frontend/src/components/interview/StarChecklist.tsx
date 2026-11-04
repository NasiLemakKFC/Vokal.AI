"use client";

import { useState } from "react";

export interface StarStepState {
  detected: boolean;
  inProgress?: boolean;
  summary: string;
}

export interface StarProgress {
  situation: StarStepState;
  task: StarStepState;
  action: StarStepState;
  result: StarStepState;
}

interface StarChecklistProps {
  progress: StarProgress;
}

const STEPS: { key: keyof StarProgress; letter: string; label: string }[] = [
  { key: "situation", letter: "S", label: "Situation" },
  { key: "task", letter: "T", label: "Task" },
  { key: "action", letter: "A", label: "Action" },
  { key: "result", letter: "R", label: "Result" },
];

/** Module 3 — live STAR coverage as four chips; click a chip to see what was detected. */
export default function StarChecklist({ progress }: StarChecklistProps) {
  const [openKey, setOpenKey] = useState<keyof StarProgress | null>(null);
  const open = openKey ? progress[openKey] : null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[#131416]">STAR structure</h2>
        <span className="text-[12px] text-[#5d5f60]">Tap a letter for details</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((step) => {
          const item = progress[step.key];
          const isOpen = openKey === step.key;
          const tone = item.detected
            ? "bg-[#dcfae5] text-[#04250e] border-[#b5e8c5]"
            : item.inProgress
            ? "bg-[#eef4f6] text-[#134e5e] border-[#b8d4dc]"
            : "bg-white text-[#5d5f60] border-[#e8eaec]";
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => setOpenKey(isOpen ? null : step.key)}
              aria-expanded={isOpen}
              title={step.label}
              className={`h-[52px] rounded-[6px] border flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${tone} ${
                isOpen ? "ring-1 ring-[#1b6c80]" : ""
              }`}
            >
              <span className="text-[16px] font-semibold leading-none">{step.letter}</span>
              <span className="text-[11px] leading-none">
                {item.detected ? "Done" : item.inProgress ? "Now" : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {open && openKey && (
        <p className="text-[13px] text-[#45474a] leading-relaxed bg-[#f9fbfc] border border-[#e8eaec] rounded-[6px] px-3 py-2">
          <span className="font-medium text-[#131416]">
            {STEPS.find((s) => s.key === openKey)?.label}:{" "}
          </span>
          {open.summary}
        </p>
      )}
    </div>
  );
}
