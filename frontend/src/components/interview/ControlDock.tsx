"use client";

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
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`w-[36px] h-[36px] rounded-[6px] border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        on
          ? "bg-white text-[#131416] border-[#cdced1] hover:bg-[#f4f6f8]"
          : "bg-[#ffedea] text-[#831c1e] border-[#f5c2c7]"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{on ? iconOn : iconOff}</span>
    </button>
  );
}

/** Bottom controls: devices on the left, record action in the middle, next/finish on the right. */
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
    <div className="sticky bottom-4 z-30 mt-5 rounded-[8px] border border-[#e8eaec] bg-white/95 backdrop-blur-sm px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
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
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenSettings}
          aria-label="Device settings"
          title="Device settings"
          className="w-[36px] h-[36px] rounded-[6px] border border-[#cdced1] bg-white text-[#5d5f60] hover:bg-[#f4f6f8] flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>

        {/* Live Mic Confidence Pill while recording */}
        {isSessionActive && (
          <div
            aria-live="polite"
            title={
              isMicOn
                ? "Live microphone input level"
                : "Microphone is muted — click Mic or press M to unmute"
            }
            className={`hidden sm:flex h-[32px] px-2.5 rounded-[6px] border items-center gap-2 text-[11.5px] font-medium transition-colors ${
              !isMicOn
                ? "bg-[#ffedea] border-[#f5c2c7] text-[#831c1e]"
                : "bg-[#f9fbfc] border-[#e8eaec] text-[#131416]"
            }`}
          >
            {!isMicOn ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#c4242a]" />
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
                        className={`w-[3px] rounded-full transition-all duration-75 ${
                          active ? "bg-[#1e7b4f]" : "bg-[#cdced1]"
                        }`}
                        style={{
                          height: `${active ? Math.min(14, heightPx + 2) : heightPx}px`,
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-[#45474a]">
                  {audioLevel >= 12 ? "Voice detected" : "Listening…"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onToggleSession}
        title="Shortcut: Spacebar"
        className={`h-[36px] px-4 rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isSessionActive
            ? "bg-[#ffedea] text-[#831c1e] hover:bg-[#fbd7d1]"
            : hasRecordedCurrent
              ? "border border-[#b8d4dc] bg-[#eef4f6] text-[#134e5e] hover:bg-[#dfecef]"
              : "bg-[#1b6c80] text-white hover:bg-[#134e5e]"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {isSessionActive ? "stop" : hasRecordedCurrent ? "replay" : "play_arrow"}
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
              ? "bg-[#fbd7d1] text-[#831c1e]"
              : hasRecordedCurrent
                ? "bg-[#dfecef] text-[#134e5e]"
                : "bg-white/20 text-white"
          }`}
        >
          Space
        </kbd>
      </button>

      {isLastQuestion ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFinishSession?.()}
          className={`h-[36px] px-3.5 rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            canHighlightFinish
              ? "bg-[#1b6c80] text-white hover:bg-[#134e5e]"
              : "border border-[#cdced1] bg-white text-[#131416] hover:bg-[#f4f6f8]"
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
          Finish &amp; analyze
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onNextQuestion?.()}
          title="Shortcut: Alt + Right Arrow"
          className="h-[36px] px-3 rounded-[6px] border border-[#cdced1] bg-white text-[#131416] hover:bg-[#f4f6f8] text-[13px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          <kbd
            aria-hidden="true"
            className="hidden md:inline-block ml-0.5 px-1.5 py-0.5 rounded-[4px] bg-[#f4f6f8] border border-[#e8eaec] text-[10px] font-mono text-[#5d5f60] leading-none"
          >
            Alt+→
          </kbd>
        </button>
      )}
    </div>
  );
}
