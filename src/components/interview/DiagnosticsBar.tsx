"use client";

import { useState } from "react";

interface DiagnosticsBarProps {
  volumeConsistency: number;
  clarityIndex: number;
  confidenceSignal: string;
}

export default function DiagnosticsBar({
  volumeConsistency,
  clarityIndex,
  confidenceSignal,
}: DiagnosticsBarProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="card !p-0 overflow-hidden">
      {/* Divided 3-Column Telemetry Strip + Expand Button */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-[#e8eaec]">
        <div className="px-4 py-2.5">
          <span className="text-[11px] text-[#5d5f60] block">
            Volume Consistency
          </span>
          <span className="text-[14px] font-medium text-[#131416] font-mono tabular-nums">
            {volumeConsistency}%
          </span>
        </div>

        <div className="px-4 py-2.5">
          <span className="text-[11px] text-[#5d5f60] block">
            Speech Clarity Index
          </span>
          <span className="text-[14px] font-medium text-[#131416] font-mono tabular-nums">
            {clarityIndex}%
          </span>
        </div>

        <div className="px-4 py-2.5">
          <span className="text-[11px] text-[#5d5f60] block">
            Vocal Poise Signal
          </span>
          <span className="text-[14px] font-medium text-[#1e7b4f]">
            {confidenceSignal}
          </span>
        </div>

        <div className="px-4 py-2.5 flex items-center justify-end bg-[#f9fbfc]">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            aria-expanded={showDetails}
            className="h-[28px] px-2.5 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{showDetails ? "Hide Telemetry" : "Signal Report"}</span>
            <span className="material-symbols-outlined text-[15px] text-[#5d5f60]">
              {showDetails ? "expand_less" : "expand_more"}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Telemetry Details Drawer */}
      {showDetails && (
        <div className="px-4 py-3 bg-[#f9fbfc] border-t border-[#f0f1f2] grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
          <div>
            <span className="font-medium text-[#131416] block">
              Audio Gain &amp; Clipping
            </span>
            <span className="text-[#5d5f60]">
              RMS level steady at −14.2 dBFS; 0 clipping events across current response.
            </span>
          </div>
          <div>
            <span className="font-medium text-[#131416] block">
              Articulation &amp; Pause Ratio
            </span>
            <span className="text-[#5d5f60]">
              Pause ratio at 14.0% (target 12–18%); phoneme clarity index at {clarityIndex}%.
            </span>
          </div>
          <div>
            <span className="font-medium text-[#131416] block">
              Vision Inference Loop
            </span>
            <span className="text-[#5d5f60]">
              MediaPipe FaceLandmarker active at 15 FPS state throttle (WebGL GPU).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
