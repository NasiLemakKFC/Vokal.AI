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
    return "bg-[#064e3b]/95 border-[#6ee7b7]/75 text-white";
  }
  if (cue.kind === "eye") {
    return "bg-[#7f1d1d]/95 border-[#fca5a5]/75 text-white";
  }
  return "bg-[#78350f]/95 border-[#fcd34d]/75 text-white";
}

function getIconBadgeStyle(cue: VisionNudgeCue): string {
  if (cue.phase === "resolved") {
    return "bg-[#10b981]/25 text-[#6ee7b7]";
  }
  if (cue.kind === "eye") {
    return "bg-[#ef4444]/30 text-[#fecaca]";
  }
  return "bg-[#f59e0b]/30 text-[#fde68a]";
}

/**
 * Top-center camera-anchored visual nudge system + peripheral pulsing edge glow
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

  return (
    <>
      {/* 1. Peripheral Pulsing Edge Glow (caught in peripheral vision without looking down) */}
      {(activeEye || activePosture || hasResolvedOnly) && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-[8px]"
          animate={
            activeEye
              ? {
                  boxShadow: [
                    "inset 0 0 0 2px rgba(239,68,68,0.65), inset 0 0 24px rgba(239,68,68,0.22)",
                    "inset 0 0 0 4px rgba(239,68,68,0.95), inset 0 0 42px rgba(239,68,68,0.42)",
                    "inset 0 0 0 2px rgba(239,68,68,0.65), inset 0 0 24px rgba(239,68,68,0.22)",
                  ],
                }
              : activePosture
              ? {
                  boxShadow: [
                    "inset 0 0 0 2px rgba(245,158,11,0.6), inset 0 0 22px rgba(245,158,11,0.2)",
                    "inset 0 0 0 4px rgba(245,158,11,0.9), inset 0 0 38px rgba(245,158,11,0.38)",
                    "inset 0 0 0 2px rgba(245,158,11,0.6), inset 0 0 22px rgba(245,158,11,0.2)",
                  ],
                }
              : {
                  boxShadow:
                    "inset 0 0 0 2.5px rgba(78,222,163,0.75), inset 0 0 22px rgba(78,222,163,0.2)",
                }
          }
          transition={
            activeEye || activePosture
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.25 }
          }
        />
      )}

      {/* 2. Top-Center Camera Lens Anchor Dot (guides eyes back to webcam lens) */}
      <AnimatePresence>
        {activeEye && (
          <motion.div
            key="camera-anchor-dot"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
          >
            <span className="absolute h-4 w-4 rounded-full bg-[#ef4444]/60 animate-ping" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-white shadow-sm" />
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
              initial={{ opacity: 0, y: -12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={`flex items-center gap-2.5 rounded-[8px] border px-3.5 py-2 shadow-lg backdrop-blur-sm ${getBannerStyle(
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
                <span className="text-[14px] font-semibold tracking-tight">
                  {cue.action}
                </span>
                <span className="text-[11.5px] text-white/85">
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
