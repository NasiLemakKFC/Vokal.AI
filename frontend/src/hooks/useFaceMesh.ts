/**
 * =============================================================================
 * useFaceMesh.ts — Custom React Hook for Real-Time Face Mesh Inference
 * =============================================================================
 *
 * This hook bridges the webcam video feed (HTMLVideoElement) with the
 * MediaPipe FaceLandmarker inference loop using requestAnimationFrame.
 *
 * USAGE:
 *   const { landmarks, blendshapes, isReady } = useFaceMesh(videoRef);
 *
 * HOW IT WORKS:
 *   1. On mount, it calls initFaceLandmarker() to load the WASM + model.
 *   2. Once the model is ready AND the video is playing, it enters a
 *      requestAnimationFrame loop.
 *   3. Each frame calls landmarker.detectForVideo(video, timestamp).
 *   4. The latest FaceLandmarkerResult is exposed via React state so
 *      downstream components can react to gaze direction, expressions, etc.
 *
 * PERFORMANCE NOTES:
 *   - The rAF loop runs at display refresh rate (~60 fps).
 *   - MediaPipe inference typically takes 5-15 ms on a modern GPU.
 *   - We avoid setState on every single frame for landmarks (too expensive);
 *     instead we use a ref and only update state at a throttled rate.
 *
 * TODO: Add throttle/debounce to control how often React re-renders with
 *       new landmark data (e.g. 15 fps is sufficient for nudge logic).
 * TODO: Pipe the raw landmarks into an eye-contact scoring function.
 * =============================================================================
 */

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  initFaceLandmarker,
  destroyFaceLandmarker,
  type FaceLandmarkerResult,
} from "@/lib/vision/MediaPipeSetup";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

// ─── Hook Return Type ────────────────────────────────────────────────────────
export interface UseFaceMeshReturn {
  /** The most recent inference result (landmarks, blendshapes, matrices). */
  result: FaceLandmarkerResult | null;

  /** True once the MediaPipe model has finished loading. */
  isModelReady: boolean;

  /** True while the rAF inference loop is actively running. */
  isDetecting: boolean;

  /** Any error that occurred during init or inference. */
  error: string | null;
}

// ─── Configuration ───────────────────────────────────────────────────────────
/** How often (in ms) we push a new result into React state. ~15 fps. */
const STATE_UPDATE_INTERVAL_MS = 66;

/**
 * Custom React hook that runs MediaPipe FaceLandmarker inference on every
 * animation frame against a provided <video> element.
 *
 * @param videoRef - A React ref pointing to the HTMLVideoElement with the
 *                   webcam stream attached.
 * @returns An object with the latest result, loading state, and errors.
 */
export function useFaceMesh(
  videoRef: RefObject<HTMLVideoElement | null>
): UseFaceMeshReturn {
  // ── State ──────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<FaceLandmarkerResult | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs (avoid triggering re-renders) ─────────────────────────────────────
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // ── Lifecycle: Init model → start loop → cleanup ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    // ── Inference Loop ────────────────────────────────────────────────────────
    function detect() {
      if (cancelled) return;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        // Video not ready yet — schedule next attempt
        rafIdRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const now = performance.now();
        const faceResult = landmarker.detectForVideo(video, now);

        // Throttle React state updates to avoid excessive re-renders
        if (now - lastUpdateRef.current > STATE_UPDATE_INTERVAL_MS) {
          setResult(faceResult);
          lastUpdateRef.current = now;
        }
      } catch (err) {
        console.error("[useFaceMesh] Inference error:", err);
        // Don't crash the loop on transient errors
      }

      // Schedule next frame
      rafIdRef.current = requestAnimationFrame(detect);
    }

    async function setup() {
      try {
        const landmarker = await initFaceLandmarker();
        if (cancelled) return;

        landmarkerRef.current = landmarker;
        setIsModelReady(true);
        setIsDetecting(true);

        // Kick off the detection loop
        rafIdRef.current = requestAnimationFrame(detect);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to init MediaPipe";
          setError(message);
          console.error("[useFaceMesh] Init error:", message);
        }
      }
    }

    setup();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      setIsDetecting(false);
      destroyFaceLandmarker();
    };
  }, [videoRef]);

  return { result, isModelReady, isDetecting, error };
}
