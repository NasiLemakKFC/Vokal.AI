"use client";

import { useState, useRef, useEffect } from "react";
import type { MediaDeviceItem } from "@/hooks/useMediaDevices";

interface ControlDockProps {
  isMicOn: boolean;
  isVideoOn: boolean;
  isSessionActive: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleSession: () => void;
  onRereadPrompt?: () => void;
  onSkipQuestion?: () => void;
  onNextQuestion?: () => void;
  audioDevices?: MediaDeviceItem[];
  videoDevices?: MediaDeviceItem[];
  selectedAudioId?: string;
  selectedVideoId?: string;
  onSelectAudio?: (deviceId: string) => void;
  onSelectVideo?: (deviceId: string) => void;
  onOpenSettings?: () => void;
}

export default function ControlDock({
  isMicOn,
  isVideoOn,
  isSessionActive,
  onToggleMic,
  onToggleVideo,
  onToggleSession,
  onRereadPrompt,
  onSkipQuestion,
  onNextQuestion,
  audioDevices = [],
  videoDevices = [],
  selectedAudioId = "",
  selectedVideoId = "",
  onSelectAudio,
  onSelectVideo,
  onOpenSettings,
}: ControlDockProps) {
  const [openMenu, setOpenMenu] = useState<"mic" | "cam" | null>(null);
  const dockRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  const handleReread = () => {
    if (onRereadPrompt) {
      onRereadPrompt();
    } else if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        "Tell me about a time you faced a critical bug in production right before a project deadline. How did you diagnose the issue and communicate with your team?"
      );
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <footer
      ref={dockRef}
      className="w-full bg-white border-t border-[#e8eaec] mt-auto py-2.5 px-4 lg:px-6 sticky bottom-0 z-40"
    >
      <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Hardware Controls & Primary Recording Action */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mic Split Control (32px height, 6px radius per framed-sheet spec) */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={onToggleMic}
              className={`h-[32px] px-3 rounded-l-[6px] text-[12px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isMicOn
                  ? "bg-white text-[#131416] border-[#cdced1] hover:bg-[#f4f6f8]"
                  : "bg-[#ffedea] text-[#831c1e] border-[#f5c2c7]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                {isMicOn ? "mic" : "mic_off"}
              </span>
              <span>{isMicOn ? "Mic On" : "Muted"}</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === "mic" ? null : "mic")}
              aria-label="Select microphone device"
              aria-expanded={openMenu === "mic"}
              className={`h-[32px] px-1.5 rounded-r-[6px] border-t border-r border-b flex items-center justify-center transition-colors cursor-pointer ${
                isMicOn
                  ? "bg-white text-[#5d5f60] border-[#cdced1] hover:bg-[#f4f6f8]"
                  : "bg-[#ffedea] text-[#831c1e] border-[#f5c2c7]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px] leading-none">
                keyboard_arrow_up
              </span>
            </button>

            {openMenu === "mic" && (
              <div className="absolute bottom-full mb-2 left-0 min-w-[260px] bg-white text-[#131416] rounded-[8px] border border-[#e8eaec] py-1.5 z-50 shadow-lg">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#f0f1f2]">
                  <span className="text-[12px] font-medium text-[#5d5f60]">
                    Microphone Input
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#5d5f60]">
                    {audioDevices.length}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                  {audioDevices.length === 0 ? (
                    <div className="px-2.5 py-2 text-[12px] text-[#5d5f60]">
                      Default system microphone
                    </div>
                  ) : (
                    audioDevices.map((dev, idx) => {
                      const isSelected = dev.deviceId === selectedAudioId;
                      return (
                        <button
                          key={dev.deviceId || idx}
                          type="button"
                          onClick={() => {
                            onSelectAudio?.(dev.deviceId);
                            setOpenMenu(null);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-[4px] flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-[#ebedee] text-[#131416] font-medium"
                              : "text-[#131416] hover:bg-[#f9fbfc]"
                          }`}
                        >
                          <span className="truncate pr-2">
                            {dev.label || `Microphone ${idx + 1}`}
                          </span>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[15px] text-[#1b6c80]">
                              check
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Camera Split Control */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={onToggleVideo}
              className={`h-[32px] px-3 rounded-l-[6px] text-[12px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isVideoOn
                  ? "bg-white text-[#131416] border-[#cdced1] hover:bg-[#f4f6f8]"
                  : "bg-[#ffedea] text-[#831c1e] border-[#f5c2c7]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                {isVideoOn ? "videocam" : "videocam_off"}
              </span>
              <span>{isVideoOn ? "Camera On" : "Camera Off"}</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === "cam" ? null : "cam")}
              aria-label="Select camera device"
              aria-expanded={openMenu === "cam"}
              className={`h-[32px] px-1.5 rounded-r-[6px] border-t border-r border-b flex items-center justify-center transition-colors cursor-pointer ${
                isVideoOn
                  ? "bg-white text-[#5d5f60] border-[#cdced1] hover:bg-[#f4f6f8]"
                  : "bg-[#ffedea] text-[#831c1e] border-[#f5c2c7]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px] leading-none">
                keyboard_arrow_up
              </span>
            </button>

            {openMenu === "cam" && (
              <div className="absolute bottom-full mb-2 left-0 min-w-[260px] bg-white text-[#131416] rounded-[8px] border border-[#e8eaec] py-1.5 z-50 shadow-lg">
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#f0f1f2]">
                  <span className="text-[12px] font-medium text-[#5d5f60]">
                    Camera Input
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#5d5f60]">
                    {videoDevices.length}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                  {videoDevices.length === 0 ? (
                    <div className="px-2.5 py-2 text-[12px] text-[#5d5f60]">
                      Default HD webcam
                    </div>
                  ) : (
                    videoDevices.map((dev, idx) => {
                      const isSelected = dev.deviceId === selectedVideoId;
                      return (
                        <button
                          key={dev.deviceId || idx}
                          type="button"
                          onClick={() => {
                            onSelectVideo?.(dev.deviceId);
                            setOpenMenu(null);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-[4px] flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-[#ebedee] text-[#131416] font-medium"
                              : "text-[#131416] hover:bg-[#f9fbfc]"
                          }`}
                        >
                          <span className="truncate pr-2">
                            {dev.label || `Camera ${idx + 1}`}
                          </span>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[15px] text-[#1b6c80]">
                              check
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="h-[32px] px-2.5 rounded-[6px] bg-white border border-[#cdced1] text-[#131416] hover:bg-[#f4f6f8] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-[#5d5f60]">
                tune
              </span>
              <span className="hidden sm:inline">AV Setup</span>
            </button>
          )}

          {/* Start / Pause Analysis Button */}
          <button
            type="button"
            onClick={onToggleSession}
            className={`h-[32px] px-3.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSessionActive
                ? "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]"
                : "bg-[#1b6c80] text-white hover:bg-[#134e5e]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] leading-none">
              {isSessionActive ? "pause" : "play_arrow"}
            </span>
            <span>{isSessionActive ? "Pause Analysis" : "Start Answering"}</span>
          </button>
        </div>

        {/* Right: Prompt Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReread}
            className="h-[32px] px-3 rounded-[6px] bg-white border border-[#cdced1] text-[#131416] hover:bg-[#f4f6f8] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-[#5d5f60]">
              volume_up
            </span>
            <span>Read Aloud</span>
          </button>

          <button
            type="button"
            onClick={() => onSkipQuestion?.()}
            className="h-[32px] px-3 rounded-[6px] bg-white border border-[#cdced1] text-[#5d5f60] hover:text-[#131416] hover:bg-[#f4f6f8] text-[12px] font-medium transition-colors cursor-pointer"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={() => onNextQuestion?.()}
            className="h-[32px] px-3.5 rounded-[6px] bg-[#131416] text-white hover:bg-[#25272a] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Submit &amp; Next</span>
            <span className="material-symbols-outlined text-[15px] leading-none">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}
