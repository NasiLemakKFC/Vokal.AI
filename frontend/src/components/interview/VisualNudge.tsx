"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { playNudgeChime } from "@/lib/vision/nudgeSound";
import type { VisionNudgeCode, VisionNudgeCue } from "@/lib/vision/visionCoach";

export interface VisualNudgeProps {
  eyeCue: VisionNudgeCue | null;
  postureCue: VisionNudgeCue | null;
  soundEnabled?: boolean;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function getCueIcon(cue: VisionNudgeCue): string {
  if (cue.phase === "resolved") return "check_circle";
  const map: Record<VisionNudgeCode, string> = {
    eye_yaw: "center_focus_strong",
    eye_gaze_side: "center_focus_strong",
    eye_down: "arrow_upward",
    eye_up: "arrow_downward",
    face_missing: "face_retouching_natural",
    posture_tilt: "balance",
    posture_slouch: "arrow_upward",
    posture_close: "zoom_out_map",
  };
  return map[cue.code];
}

function getBannerStyle(cue: VisionNudgeCue): string {
  if (cue.phase === "resolved") {
    return "bg-zinc-950/90 border-[#4cc38a]/70 text-white";
  }
  if (cue.kind === "eye") {
    return "bg-zinc-950/90 border-[#e5484d]/75 text-white";
  }
  return "bg-zinc-950/90 border-amber-400/75 text-white";
}

function getIconBadgeStyle(cue: VisionNudgeCue): string {
  if (cue.phase === "resolved") {
    return "bg-[#4cc38a]/20 text-[#72d6a6]";
  }
  if (cue.kind === "eye") {
    return "bg-[#e5484d]/20 text-[#f28588]";
  }
  return "bg-amber-400/20 text-amber-300";
}

/**
 * Top-center camera-anchored visual nudge system + peripheral edge indicator
 * + optional earphone chime for Module 4 (Eye Contact & Posture).
 */
export default function VisualNudge({
  eyeCue,
  postureCue,
  soundEnabled = true,
}: VisualNudgeProps) {
  const lastResolvedEyeIdRef = useRef<number | null>(null);
  const lastResolvedPostureIdRef = useRef<number | null>(null);

  const activeEye = eyeCue?.phase === "active";
  const activePosture = postureCue?.phase === "active";

  // Repeat alert chime every 1s continuously until user fixes eye/posture
  useEffect(() => {
    if (!soundEnabled || (!activeEye && !activePosture)) return;

    let tick = 0;
    const ring = () => {
      if (activeEye && activePosture) {
        playNudgeChime(tick % 2 === 0 ? "eye" : "posture");
        tick += 1;
      } else if (activeEye) {
        playNudgeChime("eye");
      } else {
        playNudgeChime("posture");
      }
    };

    ring();
    const timer = window.setInterval(ring, 1000);
    return () => window.clearInterval(timer);
  }, [soundEnabled, activeEye, activePosture]);

  // One-shot pleasant confirmation ping when resolved
  useEffect(() => {
    if (!soundEnabled || !eyeCue || eyeCue.phase !== "resolved") return;
    if (eyeCue.id !== lastResolvedEyeIdRef.current) {
      lastResolvedEyeIdRef.current = eyeCue.id;
      playNudgeChime("resolved");
    }
  }, [eyeCue, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled || !postureCue || postureCue.phase !== "resolved") return;
    if (postureCue.id !== lastResolvedPostureIdRef.current) {
      lastResolvedPostureIdRef.current = postureCue.id;
      playNudgeChime("resolved");
    }
  }, [postureCue, soundEnabled]);

  const hasResolvedOnly =
    !activeEye &&
    !activePosture &&
    (eyeCue?.phase === "resolved" || postureCue?.phase === "resolved");

  const cues = [eyeCue, postureCue].filter(
    (c): c is VisionNudgeCue => c !== null
  );

  const edgeColorClass = activeEye
    ? "border-[#e5484d]"
    : activePosture
      ? "border-amber-400"
      : "border-[#4cc38a]";

  return (
    <>
      {/* 1. Crisp 2px peripheral edge indicator (animates opacity only) */}
      {(activeEye || activePosture || hasResolvedOnly) && (
        <motion.div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 rounded-[var(--radius-card)] border-2 ${edgeColorClass}`}
          animate={
            activeEye || activePosture
              ? { opacity: [0.5, 1, 0.5] }
              : { opacity: 0.85 }
          }
          transition={
            activeEye || activePosture
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2, ease: EASE_OUT }
          }
        />
      )}

      {/* 2. Top-Center Camera Lens Anchor Dot (guides eyes back to webcam lens) */}
      <AnimatePresence>
        {activeEye && (
          <motion.div
            key="camera-anchor-dot"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            aria-hidden="true"
            className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#e5484d] ring-2 ring-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Top-Center Camera-Anchored Nudge Banner Stack */}
      <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 w-max max-w-[88%]">
        <AnimatePresence mode="popLayout">
          {cues.map((cue) => (
            <motion.div
              key={`${cue.kind}-${cue.phase}`}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={`flex items-center gap-2.5 rounded-[8px] border px-3.5 py-2 shadow-lg ${getBannerStyle(
                cue
              )}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] ${getIconBadgeStyle(
                  cue
                )}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {getCueIcon(cue)}
                </span>
              </span>

              <div className="flex flex-col leading-tight">
                <span className="text-[14px] font-medium">
                  {cue.action}
                </span>
                <span className="text-[12px] text-white/80">
                  {cue.detail}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
