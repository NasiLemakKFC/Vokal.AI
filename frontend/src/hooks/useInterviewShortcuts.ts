"use client";

import { useEffect, useRef } from "react";

export interface UseInterviewShortcutsOptions {
  toggleSession: () => void | Promise<void>;
  nextQuestion: () => void;
  prevQuestion: () => void;
  toggleMic: () => void;
  disabled: boolean;
}

/**
 * Keyboard shortcuts for the Practice Room:
 *   Space        = start / stop recording
 *   M            = mute / unmute mic
 *   Alt + Right  = next question
 *   Alt + Left   = previous question
 */
export function useInterviewShortcuts(options: UseInterviewShortcutsOptions) {
  const actionsRef = useRef(options);
  useEffect(() => {
    actionsRef.current = options;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (actionsRef.current.disabled) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (el && el.tagName === "BUTTON") return;
        e.preventDefault();
        void actionsRef.current.toggleSession();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        actionsRef.current.nextQuestion();
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        actionsRef.current.prevQuestion();
      } else if (
        (e.key === "m" || e.key === "M") &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        actionsRef.current.toggleMic();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
