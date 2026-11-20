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

const WASM_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

function getVisionFileset() {
  if (!visionFilesetPromise) {
    visionFilesetPromise = FilesetResolver.forVisionTasks(WASM_CDN_URL);
  }
  return visionFilesetPromise;
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
    try {
      faceLandmarkerInstance = await FaceLandmarker.createFromOptions(
        vision,
        createFaceOptions("GPU")
      );
    } catch {
      faceLandmarkerInstance = await FaceLandmarker.createFromOptions(
        vision,
        createFaceOptions("CPU")
      );
    }
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
    try {
      poseLandmarkerInstance = await PoseLandmarker.createFromOptions(
        vision,
        createPoseOptions("GPU")
      );
    } catch {
      poseLandmarkerInstance = await PoseLandmarker.createFromOptions(
        vision,
        createPoseOptions("CPU")
      );
    }
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

/**
 * Tears down the FaceLandmarker and frees GPU/WASM resources.
 */
export function destroyFaceLandmarker(): void {
  if (faceLandmarkerInstance) {
    faceLandmarkerInstance.close();
    faceLandmarkerInstance = null;
    faceLandmarkerPromise = null;
    console.log("[MediaPipe] FaceLandmarker destroyed");
  }
}

/**
 * Tears down the PoseLandmarker and frees GPU/WASM resources.
 */
export function destroyPoseLandmarker(): void {
  if (poseLandmarkerInstance) {
    poseLandmarkerInstance.close();
    poseLandmarkerInstance = null;
    poseLandmarkerPromise = null;
    console.log("[MediaPipe] PoseLandmarker destroyed");
  }
}

// Re-export result types so consumers don't need to import from @mediapipe/tasks-vision directly.
export type { FaceLandmarkerResult, PoseLandmarkerResult, NormalizedLandmark };
