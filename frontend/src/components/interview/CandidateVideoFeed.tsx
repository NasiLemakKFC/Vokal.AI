"use client";

import { forwardRef, useState } from "react";
import WebcamFeed, { type WebcamFeedHandle } from "@/components/interview/WebcamFeed";
import VisualNudge from "@/components/interview/VisualNudge";
import {
  DEFAULT_VISION_CONFIG,
  type VisionDebugMetrics,
  type VisionNudgeCue,
} from "@/lib/vision/visionCoach";

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
  /** Module 4 structured eye-contact nudge cue (sticky + resolved state). */
  eyeNudgeCue?: VisionNudgeCue | null;
  /** Module 4 structured posture nudge cue (sticky + resolved state). */
  postureNudgeCue?: VisionNudgeCue | null;
  /** Module 4 live debug telemetry (FPS, tilt, neck ratio, yaw, pitch, gaze). */
  visionDebug?: VisionDebugMetrics | null;
  /** True once MediaPipe FaceLandmarker & PoseLandmarker have loaded. */
  isVisionReady?: boolean;
  /** True during initial 1.5s posture auto-calibration. */
  isCalibrating?: boolean;
  /** Optional error message if MediaPipe vision failed to load. */
  visionError?: string | null;
  /** Toggle minimal eye & body structure wireframe overlay. */
  showOverlay?: boolean;
  onToggleOverlay?: () => void;
  /** Active nudge debounce delay in seconds (1.5s / 3s / 5s). */
  nudgeDelaySec?: number;
  onCycleNudgeDelay?: () => void;
  /** Toggle soft Web Audio earphone chimes on nudges. */
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  /** Callback to recalibrate upright posture baseline. */
  onCalibratePosture?: () => boolean;
}

/**
 * Webcam + Module 4 cues (eye contact, posture nudge, wireframe overlay, calibration & debug HUD).
 * Speech figures (Module 5) are shown below the video by the page, not on it.
 */
const CandidateVideoFeed = forwardRef<WebcamFeedHandle, CandidateVideoFeedProps>(
  function CandidateVideoFeed(
    {
      metrics,
      className = "",
      selectedVideoId,
      isVideoOn = true,
      onDevicesDiscovered,
      eyeNudgeCue = null,
      postureNudgeCue = null,
      visionDebug = null,
      isVisionReady = false,
      isCalibrating = false,
      visionError = null,
      showOverlay = true,
      onToggleOverlay,
      nudgeDelaySec = DEFAULT_VISION_CONFIG.nudgeDelaySec,
      onCycleNudgeDelay,
      soundEnabled = true,
      onToggleSound,
      onCalibratePosture,
    },
    ref
  ) {
    const [showDebug, setShowDebug] = useState(false);
    const [calibratedFlash, setCalibratedFlash] = useState(false);

    const eyeOk = metrics.eyeContact >= 70;

    const handleCalibrate = () => {
      const ok = onCalibratePosture?.();
      if (ok) {
        setCalibratedFlash(true);
        setTimeout(() => setCalibratedFlash(false), 1800);
      }
    };

    return (
      <div
        className={`relative w-full aspect-video rounded-[8px] overflow-hidden bg-[#131416] border border-[#e8eaec] ${className}`}
      >
        <WebcamFeed
          ref={ref}
          deviceId={selectedVideoId}
          isVideoOn={isVideoOn}
          showDebugOverlay={showOverlay}
          onDevicesDiscovered={onDevicesDiscovered}
          className="absolute inset-0 w-full h-full rounded-none border-0"
        />

        {/* Top-center camera-anchored visual nudges + peripheral glow + earphone chime */}
        {isVideoOn && (
          <VisualNudge
            eyeCue={eyeNudgeCue}
            postureCue={postureNudgeCue}
            soundEnabled={soundEnabled}
          />
        )}

        {/* Top-right: Eye contact score (or Vision loading status) */}
        {isVideoOn && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            {!isVisionReady && !visionError && (
              <div className="h-[28px] px-2.5 rounded-[4px] bg-black/70 text-white/90 text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fde68a] animate-pulse" />
                Loading Vision AI…
              </div>
            )}
            {visionError && (
              <div className="h-[28px] px-2.5 rounded-[4px] bg-black/80 text-[#ffb4ab] text-[11px] flex items-center gap-1.5">
                Vision AI error
              </div>
            )}
            {isVisionReady && isCalibrating && (
              <div className="h-[28px] px-2.5 rounded-[4px] bg-black/70 text-[#fde68a] text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fde68a] animate-pulse" />
                Calibrating…
              </div>
            )}
            {isVisionReady && (
              <div className="h-[28px] px-2.5 rounded-[4px] bg-black/70 text-white text-[12px] flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    eyeOk ? "bg-[#4edea3]" : "bg-[#ffb4ab]"
                  }`}
                />
                Eye contact{" "}
                <span className="font-medium tabular-nums">
                  {metrics.eyeContact}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Bottom-left: Optional Module 4 Debug HUD */}
        {isVideoOn && showDebug && visionDebug && (
          <div className="absolute bottom-3 left-3 z-20 rounded-[6px] bg-black/80 border border-white/15 px-3 py-2 text-[11px] font-mono text-[#4edea3] leading-snug space-y-0.5 tabular-nums">
            <div>
              FPS: {visionDebug.fps.toFixed(1)} | Blink:{" "}
              {visionDebug.isBlinking ? "Yes" : "No"}
            </div>
            <div>
              Tilt: {visionDebug.tiltAngle.toFixed(1)}° (Max{" "}
              {DEFAULT_VISION_CONFIG.shoulderTiltDeg}°)
            </div>
            <div>
              Neck:{" "}
              {visionDebug.neckRatio !== null
                ? visionDebug.neckRatio.toFixed(2)
                : "N/A"}{" "}
              | Base:{" "}
              {visionDebug.baselineNeckRatio !== null
                ? visionDebug.baselineNeckRatio.toFixed(2)
                : "N/A"}
            </div>
            <div>
              Yaw: {visionDebug.yawRatio.toFixed(2)} (Max{" "}
              {DEFAULT_VISION_CONFIG.yawThreshold}) | Pitch:{" "}
              {visionDebug.pitchRatio.toFixed(2)}
            </div>
            <div>
              Gaze H: {visionDebug.gazeHorizontal.toFixed(2)} | D:{" "}
              {visionDebug.gazeDown.toFixed(2)} | U:{" "}
              {visionDebug.gazeUp.toFixed(2)}
            </div>
          </div>
        )}

        {/* Bottom-right: Calibrate, Lines, Delay (with hover info), Chime & Debug HUD */}
        {isVideoOn && isVisionReady && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
            {onCalibratePosture && (
              <button
                type="button"
                onClick={handleCalibrate}
                title="Set your current upright posture as the baseline"
                className="h-[26px] px-2 rounded-[4px] bg-black/70 hover:bg-black/85 text-white text-[11px] font-medium border border-white/15 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">
                  straighten
                </span>
                {calibratedFlash ? "Calibrated" : "Calibrate"}
              </button>
            )}
            {onToggleOverlay && (
              <button
                type="button"
                onClick={onToggleOverlay}
                title="Toggle eye & body tracking wireframe lines"
                className={`h-[26px] px-2 rounded-[4px] text-[11px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                  showOverlay
                    ? "bg-[#1b6c80] text-white border-[#1b6c80]"
                    : "bg-black/70 hover:bg-black/85 text-white border-white/15"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  polyline
                </span>
                Lines
              </button>
            )}
            {onCycleNudgeDelay && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={onCycleNudgeDelay}
                  aria-label="Nudge delay grace period"
                  className="h-[26px] px-2 rounded-[4px] bg-black/70 hover:bg-black/85 text-white text-[11px] font-medium border border-white/15 flex items-center gap-1 cursor-pointer transition-colors tabular-nums"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    timer
                  </span>
                  {nudgeDelaySec}s
                  <span className="material-symbols-outlined text-[13px] opacity-75">
                    info
                  </span>
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 w-[235px] rounded-[6px] bg-[#131416]/95 border border-white/15 p-2.5 text-left shadow-xl z-40"
                >
                  <p className="text-[11.5px] font-semibold text-white">
                    Nudge Delay (Grace Period)
                  </p>
                  <p className="text-[11px] text-white/80 mt-0.5 leading-snug">
                    How long you must look away or slouch before an alert triggers.
                  </p>
                  <p className="text-[10.5px] text-[#4edea3] mt-1.5 font-medium">
                    1.5s Strict · 3s Balanced · 5s Relaxed (click to switch)
                  </p>
                </div>
              </div>
            )}
            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                title={
                  soundEnabled
                    ? "Mute earphone nudge chime"
                    : "Enable earphone nudge chime"
                }
                className={`h-[26px] px-2 rounded-[4px] text-[11px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                  soundEnabled
                    ? "bg-[#1b6c80] text-white border-[#1b6c80]"
                    : "bg-black/70 hover:bg-black/85 text-white border-white/15"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {soundEnabled ? "volume_up" : "volume_off"}
                </span>
                Chime
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              title="Toggle Module 4 threshold debug HUD"
              className={`h-[26px] px-2 rounded-[4px] text-[11px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                showDebug
                  ? "bg-[#1b6c80] text-white border-[#1b6c80]"
                  : "bg-black/70 hover:bg-black/85 text-white border-white/15"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                tune
              </span>
              HUD
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default CandidateVideoFeed;
