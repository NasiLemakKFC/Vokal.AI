"use client";

import { motion } from "framer-motion";

interface ControlDockProps {
  isMicOn: boolean;
  isVideoOn: boolean;
  isSessionActive: boolean;
  /** Live microphone voice level (0–100) while recording. */
  audioLevel?: number;
  disabled?: boolean;
  hasRecordedCurrent?: boolean;
  isLastQuestion?: boolean;
  readyAnswerCount?: number;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleSession: () => void;
  onOpenSettings: () => void;
  onNextQuestion?: () => void;
  onFinishSession?: () => void;
}

function IconToggle({
  on,
  iconOn,
  iconOff,
  label,
  disabled = false,
  onClick,
}: {
  on: boolean;
  iconOn: string;
  iconOff: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`w-10 h-10 rounded-[var(--radius-control)] border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        on
          ? "bg-[var(--surface)] text-[var(--text)] border-[var(--control)] hover:bg-[var(--raised)]"
          : "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] border-[var(--pill-negative-border)]"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {on ? iconOn : iconOff}
      </span>
    </motion.button>
  );
}

/** Floating bottom dock: devices on left, record action in center, next/finish on right. */
export default function ControlDock({
  isMicOn,
  isVideoOn,
  isSessionActive,
  audioLevel = 0,
  disabled = false,
  hasRecordedCurrent = false,
  isLastQuestion = false,
  readyAnswerCount = 0,
  onToggleMic,
  onToggleVideo,
  onToggleSession,
  onOpenSettings,
  onNextQuestion,
  onFinishSession,
}: ControlDockProps) {
  const canHighlightFinish = readyAnswerCount > 0 || isSessionActive;
  const barThresholds = [10, 28, 48, 70];

  return (
    <div
      className={`sticky bottom-4 z-30 mt-5 control-dock px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 ${
        isSessionActive ? "control-dock-recording" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <IconToggle
          on={isMicOn}
          iconOn="mic"
          iconOff="mic_off"
          label={isMicOn ? "Mute mic (M)" : "Unmute mic (M)"}
          disabled={disabled}
          onClick={onToggleMic}
        />
        <IconToggle
          on={isVideoOn}
          iconOn="videocam"
          iconOff="videocam_off"
          label={isVideoOn ? "Turn camera off" : "Turn camera on"}
          disabled={disabled}
          onClick={onToggleVideo}
        />
        <motion.button
          type="button"
          whileTap={disabled ? undefined : { scale: 0.97 }}
          disabled={disabled}
          onClick={onOpenSettings}
          aria-label="Device settings"
          title="Device settings"
          className="w-10 h-10 rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </motion.button>

        {/* Live Mic Confidence Pill while recording */}
        {isSessionActive && (
          <div
            aria-live="polite"
            title={
              isMicOn
                ? "Live microphone input level"
                : "Microphone is muted — click Mic or press M to unmute"
            }
            className={`hidden sm:flex h-9 px-3 rounded-[var(--radius-control)] border items-center gap-2 text-[12px] font-medium transition-colors ${
              !isMicOn
                ? "bg-[var(--pill-negative-bg)] border-[var(--pill-negative-border)] text-[var(--pill-negative-ink)]"
                : "bg-[var(--raised)] border-[var(--border)] text-[var(--text)]"
            }`}
          >
            {!isMicOn ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--negative)]" />
                <span>Mic muted</span>
              </>
            ) : (
              <>
                <div className="flex items-end gap-[2.5px] h-3.5" aria-hidden="true">
                  {barThresholds.map((threshold, idx) => {
                    const active = audioLevel >= threshold;
                    const heightPx = 5 + idx * 3;
                    return (
                      <span
                        key={threshold}
                        className={`w-[3px] rounded-full transition-colors duration-75 ${
                          active ? "bg-[var(--positive)]" : "bg-[var(--control)]"
                        }`}
                        style={{
                          height: `${active ? Math.min(14, heightPx + 2) : heightPx}px`,
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-[var(--text-secondary)]">
                  {audioLevel >= 12 ? "Voice detected" : "Listening…"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Primary Record / Stop Action */}
      <motion.button
        type="button"
        whileTap={disabled ? undefined : { scale: 0.98 }}
        disabled={disabled}
        onClick={onToggleSession}
        title="Shortcut: Spacebar"
        className={`relative h-10 px-4 rounded-[var(--radius-control)] text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isSessionActive
            ? "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] border border-[var(--pill-negative-border)]"
            : hasRecordedCurrent
              ? "border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "btn-primary"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {isSessionActive
            ? "stop"
            : hasRecordedCurrent
              ? "replay"
              : "play_arrow"}
        </span>
        <span>
          {isSessionActive
            ? "Stop answering"
            : hasRecordedCurrent
              ? "Re-record answer"
              : "Start answering"}
        </span>
        <kbd
          aria-hidden="true"
          className={`hidden md:inline-block ml-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono leading-none ${
            isSessionActive
              ? "bg-[var(--negative)]/15 text-[var(--pill-negative-ink)]"
              : hasRecordedCurrent
                ? "bg-[var(--accent)]/15 text-[var(--accent-ink)]"
                : "bg-black/15 text-[var(--accent-fg)]"
          }`}
        >
          Space
        </kbd>
      </motion.button>

      {isLastQuestion ? (
        <motion.button
          type="button"
          whileTap={disabled ? undefined : { scale: 0.98 }}
          disabled={disabled}
          onClick={() => onFinishSession?.()}
          className={`h-10 px-4 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            canHighlightFinish ? "btn-primary" : "btn-secondary"
          }`}
        >
          <span>Finish &amp; analyze</span>
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </motion.button>
      ) : (
        <motion.button
          type="button"
          whileTap={disabled ? undefined : { scale: 0.98 }}
          disabled={disabled}
          onClick={() => onNextQuestion?.()}
          title="Shortcut: Alt + Right Arrow"
          className="btn-secondary h-10 px-4 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
          <kbd
            aria-hidden="true"
            className="hidden md:inline-block ml-0.5 px-1.5 py-0.5 rounded-[4px] bg-[var(--raised)] border border-[var(--border)] text-[10px] font-mono text-[var(--muted)] leading-none"
          >
            Alt+→
          </kbd>
        </motion.button>
      )}
    </div>
  );
}
