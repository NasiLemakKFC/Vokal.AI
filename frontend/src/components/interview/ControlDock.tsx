"use client";

interface ControlDockProps {
  isMicOn: boolean;
  isVideoOn: boolean;
  isSessionActive: boolean;
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

  return (
    <div className="sticky bottom-4 z-30 mt-5 rounded-[8px] border border-[#e8eaec] bg-white px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <IconToggle
          on={isMicOn}
          iconOn="mic"
          iconOff="mic_off"
          label={isMicOn ? "Mute mic" : "Unmute mic"}
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
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onToggleSession}
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
        {isSessionActive
          ? "Stop answering"
          : hasRecordedCurrent
            ? "Re-record answer"
            : "Start answering"}
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
          className="h-[36px] px-3 rounded-[6px] border border-[#cdced1] bg-white text-[#131416] hover:bg-[#f4f6f8] text-[13px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      )}
    </div>
  );
}
