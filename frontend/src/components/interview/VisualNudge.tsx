"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff } from "lucide-react";

interface VisualNudgeProps {
  isEyeContactLost: boolean;
  message?: string;
  className?: string;
}

const nudgeVariants = {
  hidden: {
    opacity: 0,
    y: -12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15,
    },
  },
};

export default function VisualNudge({
  isEyeContactLost,
  message = "Maintain eye contact with the camera",
  className = "",
}: VisualNudgeProps) {
  return (
    <AnimatePresence mode="wait">
      {isEyeContactLost && (
        <motion.div
          key="eye-contact-nudge"
          variants={nudgeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`flex items-center gap-3 rounded-[8px] border border-[#f5c2c7] bg-[#ffedea] px-4 py-2.5 ${className}`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-white/80">
            <EyeOff className="h-4 w-4 text-[#831c1e]" />
          </div>

          <div className="flex flex-col">
            <span className="text-[13px] font-medium text-[#831c1e]">
              {message}
            </span>
            <span className="text-[12px] text-[#831c1e]/80">
              Align your gaze within the camera lens frame.
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
