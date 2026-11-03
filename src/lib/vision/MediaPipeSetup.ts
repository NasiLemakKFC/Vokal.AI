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
  FilesetResolver,
  type FaceLandmarkerOptions,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ─── Singleton Reference ─────────────────────────────────────────────────────
// We keep a module-level reference so we only load the ~4 MB WASM + model once.
let faceLandmarkerInstance: FaceLandmarker | null = null;

// ─── Default Configuration ───────────────────────────────────────────────────
const DEFAULT_OPTIONS: FaceLandmarkerOptions = {
  baseOptions: {
    // The model file is served from the MediaPipe CDN.
    // In production you may want to self-host for reliability.
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    delegate: "GPU", // Use WebGL acceleration when available
  },
  runningMode: "VIDEO", // Continuous video stream mode (vs. single IMAGE)
  numFaces: 1, // We only track the interviewee
  outputFaceBlendshapes: true, // Enables expression classification
  outputFacialTransformationMatrixes: true, // Enables head-pose estimation

  // TODO: Configure refineLandmarks: true to capture exact iris positions
  //       for eye-contact tracking. When enabled the model outputs an
  //       additional 10 iris landmarks (indices 468-477) per eye.
};

/**
 * Initialises and returns the FaceLandmarker singleton.
 *
 * Call this once when the interview session begins (e.g. inside a
 * useEffect). Subsequent calls return the already-loaded instance.
 *
 * @returns A promise that resolves to the ready-to-use FaceLandmarker.
 *
 * @example
 * ```ts
 * const landmarker = await initFaceLandmarker();
 * const result = landmarker.detectForVideo(videoEl, performance.now());
 * ```
 */
export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  // Return cached instance if already initialised
  if (faceLandmarkerInstance) {
    return faceLandmarkerInstance;
  }

  // 1. Load the MediaPipe WASM runtime
  const vision = await FilesetResolver.forVisionTasks(
    // CDN path for the WASM binaries
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  // 2. Create the FaceLandmarker with our configuration
  faceLandmarkerInstance = await FaceLandmarker.createFromOptions(
    vision,
    DEFAULT_OPTIONS
  );

  console.log("[MediaPipe] FaceLandmarker initialised successfully");
  return faceLandmarkerInstance;
}

/**
 * Tears down the FaceLandmarker and frees GPU/WASM resources.
 * Call this when the interview session ends or the component unmounts.
 */
export function destroyFaceLandmarker(): void {
  if (faceLandmarkerInstance) {
    faceLandmarkerInstance.close();
    faceLandmarkerInstance = null;
    console.log("[MediaPipe] FaceLandmarker destroyed");
  }
}

// Re-export the result type so consumers don't need to import from the
// mediapipe package directly.
export type { FaceLandmarkerResult };
