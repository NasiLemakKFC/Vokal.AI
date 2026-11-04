"use client";

import { forwardRef } from "react";
import WebcamFeed, { type WebcamFeedHandle } from "@/components/interview/WebcamFeed";

export interface CandidateMetrics {
  wpm: number;
  eyeContact: number;
  postureAlert: string | null;
  fillerCount: number;
}

interface CandidateVideoFeedProps {
  metrics: CandidateMetrics;
  isSessionActive: boolean;
  className?: string;
  selectedVideoId?: string;
  isVideoOn?: boolean;
  onDevicesDiscovered?: () => void;
}

/**
 * Webcam + Module 4 cues only (eye contact, posture nudge).
 * Speech figures (Module 5) are shown below the video by the page, not on it.
 */
const CandidateVideoFeed = forwardRef<WebcamFeedHandle, CandidateVideoFeedProps>(
  function CandidateVideoFeed(
    { metrics, isSessionActive, className = "", selectedVideoId, isVideoOn = true, onDevicesDiscovered },
    ref
  ) {
    const eyeOk = metrics.eyeContact >= 70;

    return (
      <div
        className={`relative w-full aspect-video rounded-[8px] overflow-hidden bg-[#131416] border border-[#e8eaec] ${className}`}
      >
        <WebcamFeed
          ref={ref}
          deviceId={selectedVideoId}
          isVideoOn={isVideoOn}
          onDevicesDiscovered={onDevicesDiscovered}
          className="absolute inset-0 w-full h-full rounded-none border-0"
        />

        {isSessionActive && (
          <>
            {/* Eye contact (top-right) */}
            <div className="absolute top-3 right-3 z-20 h-[28px] px-2.5 rounded-[4px] bg-black/70 text-white text-[12px] flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${eyeOk ? "bg-[#4edea3]" : "bg-[#ffb4ab]"}`} />
              Eye contact <span className="font-medium tabular-nums">{metrics.eyeContact}%</span>
            </div>

            {/* Posture nudge (bottom-left) — only when there is something to fix */}
            {metrics.postureAlert && (
              <div className="absolute bottom-3 left-3 z-20 h-[30px] px-3 rounded-[4px] bg-[#fffbeb] text-[#92400e] border border-[#fde68a] text-[12px] font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">accessibility_new</span>
                {metrics.postureAlert}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

export default CandidateVideoFeed;
