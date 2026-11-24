/**
 * =============================================================================
 * MediaPipeSetup.ts — MediaPipe Face Landmarker Initialization
 * =============================================================================
 *
 * This module initialises the Google MediaPipe FaceLandmarker model for
 * real-time face-mesh inference directly in the browser (client-side).
 *
 * The FaceLandmarker returns 478 face landmarks per detected face, which
 * downstream modules will use to compute:
 *   • Eye-contact / gaze direction (iris landmarks 468-477)
 *   • Head pose estimation (pitch, yaw, roll)
 *   • Facial expression classification (smile, frown, etc.)
 *
 * ARCHITECTURE NOTE:
 *   Running vision inference on the client avoids round-trip latency to a
 *   backend server and keeps the video feed entirely local (privacy-first).
 *   The Python/FastAPI backend will handle Audio/NLP only.
 *
 * TODO: Configure refineLandmarks: true to capture exact iris positions
 *       for eye-contact tracking.
 *
 * References:
 *   - https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
 *   - https://github.com/google-ai-edge/mediapipe
 * =============================================================================
 */

import {
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type FaceLandmarkerOptions,
  type FaceLandmarkerResult,
  type PoseLandmarkerOptions,
  type PoseLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// ─── Singleton References ────────────────────────────────────────────────────
// We keep module-level references so we only load the WASM + models once.
let visionFilesetPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
let faceLandmarkerInstance: FaceLandmarker | null = null;
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;
let poseLandmarkerInstance: PoseLandmarker | null = null;
let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;
let modelAssetsPrefetched = false;

const WASM_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

function getVisionFileset() {
  if (!visionFilesetPromise) {
    visionFilesetPromise = FilesetResolver.forVisionTasks(WASM_CDN_URL);
  }
  return visionFilesetPromise;
}

/**
 * Yields back to the browser event & paint loop for at least one animation frame
 * so UI transitions and video frames never freeze before heavy WebGL compilation.
 */
export function yieldToMainThread(frames = 1): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let remaining = Math.max(1, frames);
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) {
        window.setTimeout(resolve, 0);
      } else {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  });
}

/**
 * Returns true when both FaceLandmarker and PoseLandmarker singletons are already
 * compiled in memory (e.g., when navigating back to the Practice Room).
 */
export function areVisionModelsLoaded(): boolean {
  return Boolean(faceLandmarkerInstance && poseLandmarkerInstance);
}

// ─── Default Configurations ──────────────────────────────────────────────────
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

function createFaceOptions(delegate: "GPU" | "CPU"): FaceLandmarkerOptions {
  return {
    baseOptions: {
      modelAssetPath: FACE_MODEL_URL,
      delegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  };
}

function createPoseOptions(delegate: "GPU" | "CPU"): PoseLandmarkerOptions {
  return {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
      delegate,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
}

const MEDIAPIPE_BENIGN_STDERR_PREFIXES = [
  "INFO: Created TensorFlow Lite XNNPACK delegate for CPU",
];

let stderrFilterRefCount = 0;
let baseConsoleError: typeof console.error | null = null;
let mediaPipeStderrWrapper: typeof console.error | null = null;

function isBenignMediaPipeStderr(args: unknown[]): boolean {
  const first = args[0];
  return (
    typeof first === "string" &&
    MEDIAPIPE_BENIGN_STDERR_PREFIXES.some((prefix) =>
      first.trimStart().startsWith(prefix)
    )
  );
}

/**
 * Emscripten binds `var err = console.error.bind(console)` inside
 * `vision_wasm_internal.js` when a landmarker is instantiated. Wrapping
 * `console.error` during `createFromOptions` captures this filter in the
 * WASM closure while restoring the global `console.error` as soon as
 * concurrent Face/Pose initialization finishes.
 */
async function withMediaPipeStderrFilter<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof console === "undefined") {
    return fn();
  }

  if (stderrFilterRefCount === 0) {
    const capturedBase = console.error;
    baseConsoleError = capturedBase;
    const wrapper: typeof console.error = (...args: unknown[]) => {
      if (isBenignMediaPipeStderr(args)) {
        return;
      }
      const target = console.error === wrapper ? capturedBase : console.error;
      target.apply(console, args);
    };
    mediaPipeStderrWrapper = wrapper;
    console.error = wrapper;
  }
  stderrFilterRefCount += 1;

  try {
    return await fn();
  } finally {
    stderrFilterRefCount -= 1;
    if (stderrFilterRefCount === 0 && baseConsoleError) {
      if (console.error === mediaPipeStderrWrapper) {
        console.error = baseConsoleError;
      }
      baseConsoleError = null;
      mediaPipeStderrWrapper = null;
    }
  }
}

/**
 * Pre-warms the MediaPipe WASM fileset and prefetches the `.task` model binaries
 * into the browser HTTP cache during idle time (without running main-thread WebGL
 * shader compilation). Safe to call on Home idle or Sidebar hover.
 */
export async function prewarmVisionFileset(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await getVisionFileset();
    if (!modelAssetsPrefetched && typeof fetch === "function") {
      modelAssetsPrefetched = true;
      // Low-priority background cache warm-up for model binaries
      void fetch(FACE_MODEL_URL, { mode: "cors", credentials: "omit" }).catch(() => {});
      void fetch(POSE_MODEL_URL, { mode: "cors", credentials: "omit" }).catch(() => {});
    }
  } catch {
    // Ignore background prewarm failures; full init handles retries/errors.
  }
}

/**
 * Initialises and returns the FaceLandmarker singleton.
 * Falls back to CPU automatically if WebGL GPU delegate is unavailable.
 */
export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarkerInstance) {
    return faceLandmarkerInstance;
  }
  if (faceLandmarkerPromise) {
    return faceLandmarkerPromise;
  }

  faceLandmarkerPromise = (async () => {
    const vision = await getVisionFileset();
    await yieldToMainThread(1);
    faceLandmarkerInstance = await withMediaPipeStderrFilter(async () => {
      try {
        return await FaceLandmarker.createFromOptions(
          vision,
          createFaceOptions("GPU")
        );
      } catch {
        return await FaceLandmarker.createFromOptions(
          vision,
          createFaceOptions("CPU")
        );
      }
    });
    console.log("[MediaPipe] FaceLandmarker initialised successfully");
    return faceLandmarkerInstance;
  })();

  try {
    return await faceLandmarkerPromise;
  } catch (err) {
    faceLandmarkerPromise = null;
    throw err;
  }
}

/**
 * Initialises and returns the PoseLandmarker singleton (for Module 4 posture tracking).
 * Uses the lightweight `pose_landmarker_lite` model (matches Nabil's `model_complexity=0`).
 */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarkerInstance) {
    return poseLandmarkerInstance;
  }
  if (poseLandmarkerPromise) {
    return poseLandmarkerPromise;
  }

  poseLandmarkerPromise = (async () => {
    const vision = await getVisionFileset();
    await yieldToMainThread(1);
    poseLandmarkerInstance = await withMediaPipeStderrFilter(async () => {
      try {
        return await PoseLandmarker.createFromOptions(
          vision,
          createPoseOptions("GPU")
        );
      } catch {
        return await PoseLandmarker.createFromOptions(
          vision,
          createPoseOptions("CPU")
        );
      }
    });
    console.log("[MediaPipe] PoseLandmarker initialised successfully");
    return poseLandmarkerInstance;
  })();

  try {
    return await poseLandmarkerPromise;
  } catch (err) {
    poseLandmarkerPromise = null;
    throw err;
  }
}

// Re-export result types so consumers don't need to import from @mediapipe/tasks-vision directly.
export type { FaceLandmarkerResult, PoseLandmarkerResult, NormalizedLandmark };
