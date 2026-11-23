"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LiveCoachingTipProps {
  tip: string;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** One-line coaching hint, hidden until clicked so it never distracts mid-answer. */
export default function LiveCoachingTip({ tip }: LiveCoachingTipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full px-4 h-12 flex items-center justify-between text-left hover:bg-[var(--raised)]/60 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
          <span className="material-symbols-outlined text-[18px] text-[var(--muted)]">
            lightbulb
          </span>
          Coaching tip
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="material-symbols-outlined text-[18px] text-[var(--muted)]"
        >
          expand_more
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <p className="px-4 pb-4 pt-3 text-[13px] text-[var(--text-secondary)] leading-relaxed border-t border-[var(--rule)]">
              {tip}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
