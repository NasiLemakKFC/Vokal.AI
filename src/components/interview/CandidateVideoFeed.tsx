"use client";

import { forwardRef, useState } from "react";
import WebcamFeed, { type WebcamFeedHandle } from "@/components/interview/WebcamFeed";

export interface CandidateMetrics {
  wpm: number;
  wpmStatus: string;
  eyeContact: number;
  eyeContactStatus: string;
  postureAlert: string | null;
  fillerWords: string[];
  volumeConsistency: number;
  clarityIndex: number;
  confidenceSignal: string;
}

interface CandidateVideoFeedProps {
  metrics: CandidateMetrics;
  isSessionActive: boolean;
  className?: string;
  selectedVideoId?: string;
  isVideoOn?: boolean;
  onDevicesDiscovered?: () => void;
}

const CandidateVideoFeed = forwardRef<WebcamFeedHandle, CandidateVideoFeedProps>(
  function CandidateVideoFeed(
    {
      metrics,
      isSessionActive,
      className = "",
      selectedVideoId,
      isVideoOn = true,
      onDevicesDiscovered,
    },
    ref
  ) {
    const [useMockStream, setUseMockStream] = useState(false);
    const [showHudDetails, setShowHudDetails] = useState(true);

    return (
      <div
        className={`relative w-full aspect-video min-h-[420px] rounded-[8px] overflow-hidden bg-[#131416] group border border-[#e8eaec] ${className}`}
      >
        {/* Live Webcam Stream or Fallback Simulation */}
        {!useMockStream ? (
          <WebcamFeed
            ref={ref}
            deviceId={selectedVideoId}
            isVideoOn={isVideoOn}
            onDevicesDiscovered={onDevicesDiscovered}
            className="absolute inset-0 w-full h-full rounded-none border-0"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            alt="Candidate responding to interview question"
            className="w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80"
          />
        )}

        {/* Dark Scrims for HUD Readability (Black/60 per AGENTS.md rule) */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" /* taste-skill-ignore */ />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" /* taste-skill-ignore */ />

        {/* Top-Left: Compact Telemetry Pill Bar */}
        <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
          {isSessionActive && (
            <div className="h-[26px] px-2.5 rounded-[4px] bg-[#c4242a] text-white text-[11px] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>REC</span>
            </div>
          )}

          <div className="h-[26px] px-2.5 rounded-[4px] bg-white/95 text-[#131416] text-[12px] font-mono tabular-nums flex items-center gap-1.5 border border-[#e8eaec]">
            <span className="font-medium">{metrics.wpm} WPM</span>
            <span className="text-[#5d5f60] font-sans text-[11px]">
              ({metrics.wpmStatus})
            </span>
          </div>

          <div className="h-[26px] px-2.5 rounded-[4px] bg-white/95 text-[#131416] text-[12px] flex items-center gap-1.5 border border-[#e8eaec]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e7b4f]" />
            <span className="text-[11px] text-[#5d5f60]">Eye:</span>
            <span className="font-mono tabular-nums font-medium text-[#1e7b4f]">
              {metrics.eyeContact}%
            </span>
          </div>
        </div>

        {/* Top-Right: HUD Toggle Button to Save Visual Space on Video */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHudDetails((prev) => !prev)}
            className="h-[26px] px-2.5 rounded-[4px] bg-white/95 hover:bg-white text-[#131416] text-[11px] font-medium border border-[#e8eaec] flex items-center gap-1 cursor-pointer"
          >
            <span>{showHudDetails ? "Hide HUD" : "Show HUD"}</span>
            <span className="material-symbols-outlined text-[14px]">
              {showHudDetails ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>

        {/* Bottom HUD Overlays (Only shown when showHudDetails is active) */}
        {showHudDetails && (
          <>
            {/* Bottom-Left: Posture Status */}
            {metrics.postureAlert && (
              <div className="absolute bottom-3 left-3 z-20 h-[28px] px-2.5 rounded-[4px] bg-[#fffbeb] text-[#92400e] border border-[#fde68a] text-[12px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#92400e]" />
                <span>Posture:</span>
                <span className="font-medium">{metrics.postureAlert}</span>
              </div>
            )}

            {/* Bottom-Right: Filler Word Counter */}
            <div className="absolute bottom-3 right-3 z-20 h-[28px] px-2.5 rounded-[4px] bg-white/95 text-[#131416] border border-[#e8eaec] text-[12px] flex items-center gap-1.5">
              <span className="text-[#5d5f60] text-[11px]">Fillers:</span>
              <span className="font-mono tabular-nums font-medium">
                {metrics.fillerWords.length}
              </span>
              <span className="text-[#5d5f60] text-[11px]">
                ({metrics.fillerWords.map((w) => `"${w}"`).join(", ")})
              </span>
            </div>
          </>
        )}

        {/* Camera stream source toggle button (hover only) */}
        <button
          type="button"
          onClick={() => setUseMockStream((prev) => !prev)}
          title="Toggle camera / demo simulation"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-black text-white text-[11px] px-2.5 py-1 rounded-[4px] cursor-pointer"
        >
          {useMockStream ? "Switch to Live Camera" : "Switch to Demo Stream"}
        </button>
      </div>
    );
  }
);

export default CandidateVideoFeed;
