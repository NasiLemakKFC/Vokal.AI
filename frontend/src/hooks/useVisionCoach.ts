/**
 * =============================================================================
 * useVisionCoach.ts — React Hook for Module 4 (Eye Contact & Posture)
 * =============================================================================
 *
 * Bridges WebcamFeed's <video> + <canvas> elements with MediaPipe
 * FaceLandmarker + PoseLandmarker, feeding landmarks and face blendshapes
 * into VisionCoachAnalyzer and rendering the minimal wireframe overlay.
 *
 * All inference runs 100% client-side in the browser (privacy-first).
 * =============================================================================
 */

"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { WebcamFeedHandle } from "@/components/interview/WebcamFeed";
import {
  areVisionModelsLoaded,
  initFaceLandmarker,
  initPoseLandmarker,
  prewarmVisionFileset,
  yieldToMainThread,
} from "@/lib/vision/MediaPipeSetup";
import {
  VisionCoachAnalyzer,
  type VisionCoachConfig,
  type VisionCoachFrameResult,
} from "@/lib/vision/visionCoach";
import { drawVisionOverlay } from "@/lib/vision/visionOverlay";

export type VisionBootStage =
  | "idle"
  | "waiting_camera"
  | "loading_wasm"
  | "loading_face"
  | "loading_pose"
  | "ready"
  | "error";

export interface UseVisionCoachOptions {
  /** Whether the camera is currently active and vision tracking should run. */
  enabled?: boolean;
  /** When true, pauses the rAF inference loop and clears live nudges/overlay without unloading models. */
  paused?: boolean;
  /** When true, frames count toward the session's cumulative scores & nudges. */
  trackSession?: boolean;
  /** When true, draws the minimal eye & body wireframe onto the canvas overlay. */
  showOverlay?: boolean;
  /** Debounce duration (seconds) before visual nudges trigger. */
  nudgeDelaySec?: number;
  /** Optional threshold overrides for VisionCoachAnalyzer. */
  config?: Partial<VisionCoachConfig>;
}

export interface UseVisionCoachReturn {
  /** Latest Module 4 vision analysis result (throttled to ~10 fps for React). */
  vision: VisionCoachFrameResult | null;
  /** True once both FaceLandmarker and PoseLandmarker are loaded. */
  isModelReady: boolean;
  /** Current progressive loading stage for smooth non-blocking boot UX. */
  bootStage: VisionBootStage;
  /** True while the requestAnimationFrame loop is actively running. */
  isDetecting: boolean;
  /** Non-null if MediaPipe failed to initialise. */
  error: string | null;
  /** Recalibrates upright posture baseline to the user's current sitting position. */
  calibratePosture: () => boolean;
  /** Resets cumulative session counters and nudge timers. */
  resetSession: () => void;
}

/** Push React state updates at ~10 fps to keep UI smooth without over-rendering. */
const STATE_UPDATE_INTERVAL_MS = 100;

export function useVisionCoach(
  webcamRef: RefObject<WebcamFeedHandle | null>,
  options: UseVisionCoachOptions = {}
): UseVisionCoachReturn {
  const {
    enabled = true,
    paused = false,
    trackSession = true,
    showOverlay = true,
    nudgeDelaySec,
    config,
  } = options;

  const [vision, setVision] = useState<VisionCoachFrameResult | null>(null);
  const [isModelReady, setIsModelReady] = useState<boolean>(() =>
    areVisionModelsLoaded()
  );
  const [bootStage, setBootStage] = useState<VisionBootStage>(() =>
    areVisionModelsLoaded() ? "ready" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const analyzerRef = useRef<VisionCoachAnalyzer | null>(null);
  const initialConfigRef = useRef(config);

  const getAnalyzer = useCallback(() => {
    if (analyzerRef.current == null) {
      analyzerRef.current = new VisionCoachAnalyzer(initialConfigRef.current);
    }
    return analyzerRef.current;
  }, []);

  const trackSessionRef = useRef(trackSession);
  useEffect(() => {
    trackSessionRef.current = trackSession;
  }, [trackSession]);

  const showOverlayRef = useRef(showOverlay);
  useEffect(() => {
    showOverlayRef.current = showOverlay;
    if (!showOverlay) {
      const canvas = webcamRef.current?.canvasElement;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [showOverlay, webcamRef]);

  useEffect(() => {
    if (nudgeDelaySec !== undefined) {
      getAnalyzer().setNudgeDelay(nudgeDelaySec);
    }
  }, [nudgeDelaySec, getAnalyzer]);

  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateMsRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastTimestampMsRef = useRef<number>(0);

  const calibratePosture = useCallback(() => {
    return getAnalyzer().calibratePosture();
  }, [getAnalyzer]);

  const resetSession = useCallback(() => {
    getAnalyzer().resetSession();
  }, [getAnalyzer]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function waitForCameraOrPaint(maxWaitMs = 420): Promise<void> {
      const started = performance.now();
      while (!cancelled && performance.now() - started < maxWaitMs) {
        const video = webcamRef.current?.videoElement;
        if (video && video.readyState >= 2) {
          return;
        }
        await new Promise<void>((r) => window.setTimeout(r, 60));
      }
    }

    async function loadModelsStaged() {
      try {
        // Fast path: models are already compiled in singleton memory from an earlier visit
        if (areVisionModelsLoaded()) {
          const [face, pose] = await Promise.all([
            initFaceLandmarker(),
            initPoseLandmarker(),
          ]);
          if (cancelled) return;
          faceRef.current = face;
          poseRef.current = pose;
          setError(null);
          setBootStage("ready");
          setIsModelReady(true);
          return;
        }

        // Stage 1: Let the Practice Room UI paint and let the camera stream attach first
        setBootStage("waiting_camera");
        await yieldToMainThread(2);
        await waitForCameraOrPaint(420);
        if (cancelled) return;

        // Stage 2: Load WASM fileset runtime
        setBootStage("loading_wasm");
        await prewarmVisionFileset();
        await yieldToMainThread(1);
        if (cancelled) return;

        // Stage 3: Compile FaceLandmarker (Eye Contact AI) first, then yield frames
        setBootStage("loading_face");
        await yieldToMainThread(1);
        const face = await initFaceLandmarker();
        if (cancelled) return;
        faceRef.current = face;

        // Yield 2 animation frames so camera video & UI interactions stay silky-smooth
        // between the two WebGL shader compilations
        await yieldToMainThread(2);
        if (cancelled) return;

        // Stage 4: Compile PoseLandmarker (Posture AI)
        setBootStage("loading_pose");
        await yieldToMainThread(1);
        const pose = await initPoseLandmarker();
        if (cancelled) return;
        poseRef.current = pose;

        setError(null);
        setBootStage("ready");
        setIsModelReady(true);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : "Failed to load MediaPipe vision models.";
          setError(msg);
          setBootStage("error");
          console.error("[useVisionCoach] Init error:", msg);
        }
      }
    }

    void loadModelsStaged();

    return () => {
      cancelled = true;
    };
  }, [enabled, webcamRef]);

  useEffect(() => {
    const analyzer = getAnalyzer();

    if (!enabled || paused || !isModelReady) {
      const canvas = webcamRef.current?.canvasElement;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      analyzer.clearLiveState();
      lastVideoTimeRef.current = -1;
      return;
    }

    let cancelled = false;
    lastVideoTimeRef.current = -1;

    function detect() {
      if (cancelled) return;

      const video = webcamRef.current?.videoElement;
      const faceLandmarker = faceRef.current;
      const poseLandmarker = poseRef.current;

      if (
        !video ||
        !faceLandmarker ||
        !poseLandmarker ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        rafIdRef.current = requestAnimationFrame(detect);
        return;
      }

      // Only run inference when a new camera frame has arrived
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        const now = performance.now();
        // MediaPipe requires strictly increasing timestamps in VIDEO mode
        const ts = Math.max(now, lastTimestampMsRef.current + 1);
        lastTimestampMsRef.current = ts;

        try {
          const faceResult = faceLandmarker.detectForVideo(video, ts);
          const poseResult = poseLandmarker.detectForVideo(video, ts);

          const faceLandmarks = faceResult.faceLandmarks?.[0] ?? null;
          const faceBlendshapes =
            faceResult.faceBlendshapes?.[0]?.categories ?? null;
          const poseLandmarks = poseResult.landmarks?.[0] ?? null;

          const frameResult = analyzer.processLandmarks(
            faceLandmarks,
            faceBlendshapes,
            poseLandmarks,
            video.videoWidth,
            video.videoHeight,
            now,
            trackSessionRef.current
          );

          // Draw minimal eye & body wireframe at full camera FPS
          if (showOverlayRef.current) {
            const canvas = webcamRef.current?.canvasElement;
            if (canvas) {
              if (
                canvas.width !== video.videoWidth ||
                canvas.height !== video.videoHeight
              ) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
              }
              const ctx = canvas.getContext("2d");
              if (ctx) {
                drawVisionOverlay(
                  ctx,
                  canvas.width,
                  canvas.height,
                  faceLandmarks,
                  poseLandmarks,
                  frameResult
                );
              }
            }
          }

          if (now - lastUpdateMsRef.current >= STATE_UPDATE_INTERVAL_MS) {
            setVision(frameResult);
            lastUpdateMsRef.current = now;
          }
        } catch (err) {
          console.error("[useVisionCoach] Inference error:", err);
        }
      }

      rafIdRef.current = requestAnimationFrame(detect);
    }

    rafIdRef.current = requestAnimationFrame(detect);

    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      analyzer.clearLiveState();
      setVision(null);
    };
  }, [enabled, paused, isModelReady, webcamRef, getAnalyzer]);

  const isActive = enabled && !paused;

  return {
    vision: isActive ? vision : null,
    isModelReady,
    bootStage: !enabled ? "idle" : bootStage,
    isDetecting: isActive && isModelReady,
    error,
    calibratePosture,
    resetSession,
  };
}
