"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Module 3 — live STAR coverage as four interactive chips; click a chip to see what was detected. */
export default function StarChecklist({ progress }: StarChecklistProps) {
  const [openKey, setOpenKey] = useState<keyof StarProgress | null>(null);
  const open = openKey ? progress[openKey] : null;
  const detectedCount = STEPS.filter((s) => progress[s.key].detected).length;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[14px] font-medium text-[var(--text)]">
            STAR structure
          </h2>
          <span
            className={`text-[12px] font-mono tabular-nums ${
              detectedCount >= 3
                ? "text-[var(--positive)] font-medium"
                : "text-[var(--muted)]"
            }`}
          >
            {detectedCount}/4
          </span>
        </div>
        <span className="text-[12px] text-[var(--muted)]">Select a letter</span>
      </div>

      {/* Progress Hairline */}
      <div className="h-1 w-full rounded-full bg-[var(--ring-track)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-[var(--accent)]"
          animate={{ width: `${detectedCount * 25}%` }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((step) => {
          const item = progress[step.key];
          const isOpen = openKey === step.key;
          const tone = item.detected
            ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)] border-[var(--pill-positive-border)]"
            : item.inProgress
              ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--border-accent)]"
              : "bg-[var(--raised)]/60 text-[var(--muted)] border-[var(--border)] hover:bg-[var(--raised)]";
          return (
            <motion.button
              key={step.key}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setOpenKey(isOpen ? null : step.key)}
              aria-expanded={isOpen}
              title={step.label}
              className={`h-14 rounded-[var(--radius-control)] border flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${tone} ${
                isOpen ? "!border-[var(--text)]" : ""
              }`}
            >
              <span className="text-[16px] font-medium leading-none flex items-center gap-1">
                {step.letter}
                {item.detected && (
                  <span className="material-symbols-outlined text-[14px]">
                    check
                  </span>
                )}
              </span>
              <span className="text-[11px] font-normal leading-none opacity-85">
                {item.detected
                  ? "Done"
                  : item.inProgress
                    ? "Now"
                    : step.label.slice(0, 4)}
              </span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {open && openKey && (
          <motion.p
            key={openKey}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="text-[13px] text-[var(--text-secondary)] leading-relaxed bg-[var(--raised)] border border-[var(--border)] rounded-[var(--radius-control)] px-3.5 py-2.5"
          >
            <span className="font-medium text-[var(--text)]">
              {STEPS.find((s) => s.key === openKey)?.label}:{" "}
            </span>
            {open.summary}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
