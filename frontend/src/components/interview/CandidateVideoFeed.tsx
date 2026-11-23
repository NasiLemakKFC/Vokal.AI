"use client";

import { forwardRef, useState } from "react";
import WebcamFeed, { type WebcamFeedHandle } from "@/components/interview/WebcamFeed";
import VisualNudge from "@/components/interview/VisualNudge";
import type { VisionBootStage } from "@/hooks/useVisionCoach";
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
  /** Progressive vision boot stage for smooth non-blocking load feedback. */
  visionBootStage?: VisionBootStage;
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
  /** When false, vision tracking & nudges stay paused during preview (auto-resumes on Start answering). */
  trackInPreview?: boolean;
  onToggleTrackInPreview?: () => void;
}

/**
 * Webcam + Module 4 cues (eye contact, posture nudge, wireframe overlay, calibration & debug HUD).
 * Speech figures (Module 5) are shown below the video by the page, not on it.
 */
const CandidateVideoFeed = forwardRef<WebcamFeedHandle, CandidateVideoFeedProps>(
  function CandidateVideoFeed(
    {
      metrics,
      isSessionActive,
      className = "",
      selectedVideoId,
      isVideoOn = true,
      onDevicesDiscovered,
      eyeNudgeCue = null,
      postureNudgeCue = null,
      visionDebug = null,
      isVisionReady = false,
      visionBootStage = "idle",
      isCalibrating = false,
      visionError = null,
      showOverlay = true,
      onToggleOverlay,
      nudgeDelaySec = DEFAULT_VISION_CONFIG.nudgeDelaySec,
      onCycleNudgeDelay,
      soundEnabled = true,
      onToggleSound,
      onCalibratePosture,
      trackInPreview = true,
      onToggleTrackInPreview,
    },
    ref
  ) {
    const [showDebug, setShowDebug] = useState(false);
    const [calibratedFlash, setCalibratedFlash] = useState(false);

    const isPreviewPaused = !isSessionActive && !trackInPreview;
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
        className={`relative w-full aspect-video rounded-[var(--radius-card)] overflow-hidden bg-zinc-950 border transition-colors duration-200 ${
          isSessionActive ? "border-[var(--accent)]" : "border-[var(--border)]"
        } ${className}`}
      >
        <WebcamFeed
          ref={ref}
          deviceId={selectedVideoId}
          isVideoOn={isVideoOn}
          showDebugOverlay={showOverlay && !isPreviewPaused}
          onDevicesDiscovered={onDevicesDiscovered}
          className="absolute inset-0 w-full h-full rounded-none border-0"
        />

        {/* Top-center camera-anchored visual nudges + peripheral edge cue + earphone chime */}
        {isVideoOn && !isPreviewPaused && (
          <VisualNudge
            eyeCue={eyeNudgeCue}
            postureCue={postureNudgeCue}
            soundEnabled={soundEnabled}
          />
        )}

        {/* Top-right: Eye contact score (or Vision loading / paused status) */}
        {isVideoOn && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {visionError && (
              <div className="h-7 px-2.5 rounded-[6px] bg-black/80 text-[#f28588] text-[12px] flex items-center gap-1.5 border border-white/15">
                Vision error
              </div>
            )}
            {isPreviewPaused ? (
              <div className="h-7 px-2.5 rounded-[6px] bg-black/75 text-white/85 text-[12px] flex items-center gap-1.5 border border-white/15">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Tracker paused
              </div>
            ) : (
              <>
                {!isVisionReady && !visionError && (
                  <div className="h-7 px-2.5 rounded-[6px] bg-black/75 border border-white/15 text-white/95 text-[12px] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
                    <span className="tabular-nums">
                      {visionBootStage === "waiting_camera"
                        ? "Syncing camera…"
                        : visionBootStage === "loading_wasm"
                          ? "Starting vision engine…"
                          : visionBootStage === "loading_face"
                            ? "Loading eye model (1/2)…"
                            : visionBootStage === "loading_pose"
                              ? "Loading posture model (2/2)…"
                              : "Loading vision…"}
                    </span>
                    <span className="w-8 h-1 rounded-full bg-white/15 overflow-hidden shrink-0">
                      <span
                        className="block h-full bg-[#4cc38a] transition-[width] duration-200 ease-out"
                        style={{
                          width:
                            visionBootStage === "waiting_camera"
                              ? "20%"
                              : visionBootStage === "loading_wasm"
                                ? "40%"
                                : visionBootStage === "loading_face"
                                  ? "65%"
                                  : visionBootStage === "loading_pose"
                                    ? "90%"
                                    : "30%",
                        }}
                      />
                    </span>
                  </div>
                )}
                {isVisionReady && isCalibrating && (
                  <div className="h-7 px-2.5 rounded-[6px] bg-black/75 border border-white/15 text-amber-200 text-[12px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    Calibrating…
                  </div>
                )}
                {isVisionReady && (
                  <div className="h-7 px-2.5 rounded-[6px] bg-black/75 border border-white/15 text-white text-[12px] flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        eyeOk ? "bg-[#4cc38a]" : "bg-[#e5484d]"
                      }`}
                    />
                    <span>Eye contact</span>
                    <span className="font-mono font-medium tabular-nums">
                      {metrics.eyeContact}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Bottom-left: Optional Module 4 Debug HUD */}
        {isVideoOn && !isPreviewPaused && showDebug && visionDebug && (
          <div className="absolute bottom-3 left-3 z-20 rounded-[6px] bg-black/85 border border-white/15 px-3 py-2 text-[11px] font-mono text-zinc-200 leading-snug space-y-0.5 tabular-nums">
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

        {/* Bottom-right: Calibrate, Lines, Delay, Chime, HUD & Preview */}
        {isVideoOn && (isVisionReady || onToggleTrackInPreview) && (
          <div className="absolute bottom-3 right-3 z-20 flex flex-wrap justify-end max-w-[calc(100%-24px)] items-center gap-1.5">
            {isVisionReady && !isPreviewPaused && onCalibratePosture && (
              <button
                type="button"
                onClick={handleCalibrate}
                title="Set your current upright posture as the baseline"
                className="h-7 px-2.5 rounded-[6px] bg-black/75 hover:bg-black/90 text-white text-[12px] font-medium border border-white/15 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">
                  straighten
                </span>
                {calibratedFlash ? "Calibrated" : "Calibrate"}
              </button>
            )}
            {isVisionReady && onToggleOverlay && (
              <button
                type="button"
                onClick={onToggleOverlay}
                title="Toggle eye & body tracking wireframe lines"
                className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                  showOverlay
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
                    : "bg-black/75 hover:bg-black/90 text-white border-white/15"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  polyline
                </span>
                Lines
              </button>
            )}
            {isVisionReady && onCycleNudgeDelay && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={onCycleNudgeDelay}
                  aria-label="Nudge delay grace period"
                  className="h-7 px-2.5 rounded-[6px] bg-black/75 hover:bg-black/90 text-white text-[12px] font-medium border border-white/15 flex items-center gap-1 cursor-pointer transition-colors font-mono tabular-nums"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    timer
                  </span>
                  {nudgeDelaySec}s
                  <span className="material-symbols-outlined text-[14px] opacity-75">
                    info
                  </span>
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 w-60 rounded-[8px] bg-zinc-950/95 border border-white/15 p-3 text-left shadow-lg z-40"
                >
                  <p className="text-[12px] font-medium text-white">
                    Nudge delay (grace period)
                  </p>
                  <p className="text-[12px] text-white/75 mt-1 leading-snug">
                    How long you must look away or slouch before an alert triggers
                  </p>
                  <p className="text-[11px] text-white/60 mt-1.5">
                    1.5s Strict · 3s Balanced · 5s Relaxed (click to switch)
                  </p>
                </div>
              </div>
            )}
            {isVisionReady && onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                title={
                  soundEnabled
                    ? "Mute earphone nudge chime"
                    : "Enable earphone nudge chime"
                }
                className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                  soundEnabled
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
                    : "bg-black/75 hover:bg-black/90 text-white border-white/15"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {soundEnabled ? "volume_up" : "volume_off"}
                </span>
                Chime
              </button>
            )}
            {isVisionReady && (
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                title="Toggle vision telemetry HUD"
                className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                  showDebug
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
                    : "bg-black/75 hover:bg-black/90 text-white border-white/15"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  tune
                </span>
                HUD
              </button>
            )}
            {onToggleTrackInPreview && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={onToggleTrackInPreview}
                  aria-pressed={trackInPreview}
                  aria-label={
                    trackInPreview
                      ? "Turn off vision tracker during preview"
                      : "Turn on vision tracker during preview"
                  }
                  className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                    trackInPreview
                      ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
                      : "bg-black/75 hover:bg-black/90 text-white border-white/15"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {trackInPreview ? "visibility" : "visibility_off"}
                  </span>
                  {trackInPreview ? "Preview" : "Preview Off"}
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 w-60 rounded-[8px] bg-zinc-950/95 border border-white/15 p-3 text-left shadow-lg z-40"
                >
                  <p className="text-[12px] font-medium text-white">
                    {trackInPreview
                      ? "Preview tracking (on)"
                      : "Preview tracking (off)"}
                  </p>
                  <p className="text-[12px] text-white/75 mt-1 leading-snug">
                    Turn off to pause eye and posture alerts while reading or pasting a job description
                  </p>
                  <p className="text-[11px] text-white/60 mt-1.5">
                    {isSessionActive
                      ? "Active now — always runs while answering"
                      : "Resumes automatically when you start answering"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default CandidateVideoFeed;
