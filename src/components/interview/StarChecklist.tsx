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

interface StepConfig {
  key: keyof StarProgress;
  label: string;
  weight: string;
}

const STEPS: StepConfig[] = [
  { key: "situation", label: "Situation", weight: "20%" },
  { key: "task", label: "Task", weight: "20%" },
  { key: "action", label: "Action", weight: "35%" },
  { key: "result", label: "Result", weight: "25%" },
];

export default function StarChecklist({ progress }: StarChecklistProps) {
  // Space-saving state: summaries are collapsed by default and only shown when user clicks a row or "Summary Report"
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [isAllOpen, setIsAllOpen] = useState(false);

  const detectedCount = STEPS.filter((step) => progress[step.key]?.detected).length;
  const percentage = Math.round((detectedCount / STEPS.length) * 100);

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAll = () => {
    const next = !isAllOpen;
    setIsAllOpen(next);
    setExpandedKeys({
      situation: next,
      task: next,
      action: next,
      result: next,
    });
  };

  return (
    <div className="card !p-0 overflow-hidden">
      {/* Compact Header with "STAR Summary ▾" Dropdown Button */}
      <div className="px-4 py-3 border-b border-[#e8eaec] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-[#131416]">
            STAR Response Matrix
          </h2>
          <span className="text-[12px] font-mono tabular-nums text-[#1b6c80] font-medium">
            {percentage}% ({detectedCount}/4)
          </span>
        </div>

        <button
          type="button"
          onClick={toggleAll}
          aria-expanded={isAllOpen}
          className="h-[28px] px-2.5 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>{isAllOpen ? "Hide Summaries" : "STAR Summary"}</span>
          <span className="material-symbols-outlined text-[15px] text-[#5d5f60]">
            {isAllOpen ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {/* Segmented 4-Step Progress Track */}
      <div className="px-4 py-2.5 bg-[#f9fbfc] border-b border-[#f0f1f2] grid grid-cols-4 gap-1.5">
        {STEPS.map((step) => {
          const item = progress[step.key];
          let barColor = "bg-[#e8eaec]";
          if (item?.detected) {
            barColor = "bg-[#1e7b4f]";
          } else if (item?.inProgress) {
            barColor = "bg-[#1b6c80]";
          }
          return (
            <div key={step.key} className="space-y-1">
              <div className={`h-1.5 rounded-[2px] ${barColor}`} />
            </div>
          );
        })}
      </div>

      {/* Compact Click-to-Expand Pillar Rows */}
      <div className="divide-y divide-[#f0f1f2]">
        {STEPS.map((step) => {
          const item = progress[step.key];
          const isDetected = item?.detected;
          const isInProgress = item?.inProgress;
          const isOpen = !!expandedKeys[step.key];

          return (
            <div key={step.key} className="bg-white">
              <button
                type="button"
                onClick={() => toggleKey(step.key)}
                aria-expanded={isOpen}
                className="w-full px-4 h-[42px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isDetected
                        ? "bg-[#1e7b4f]"
                        : isInProgress
                        ? "bg-[#1b6c80]"
                        : "bg-[#cdced1]"
                    }`}
                  />
                  <span className="text-[13px] font-medium text-[#131416]">
                    {step.label}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#5d5f60]">
                    ({step.weight})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDetected ? (
                    <span className="pill-positive">Detected</span>
                  ) : isInProgress ? (
                    <span className="badge !bg-[#e6f2f5] !text-[#134e5e]">
                      In progress
                    </span>
                  ) : (
                    <span className="badge">Awaiting</span>
                  )}
                  <span className="material-symbols-outlined text-[16px] text-[#5d5f60]">
                    {isOpen ? "expand_less" : "expand_more"}
                  </span>
                </div>
              </button>

              {/* Collapsible Summary Drawer (Only visible when clicked) */}
              {isOpen && (
                <div className="px-4 pb-3 pt-1 bg-[#f9fbfc] border-t border-[#f0f1f2]">
                  <p className="text-[12px] text-[#45474a] leading-relaxed">
                    {item?.summary}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
