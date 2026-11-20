/**
 * =============================================================================
 * visionCoach.ts — Module 4: Real-Time Eye Contact & Posture Analysis
 * =============================================================================
 *
 * TypeScript port & upgrade of Nabil's `InterviewBehaviorAnalyzer` (vision_coach.py)
 * for client-side browser execution via MediaPipe FaceLandmarker + PoseLandmarker.
 *
 * HOW TO EDIT / TUNE IN THE FUTURE:
 *   All detection thresholds live in `DEFAULT_VISION_CONFIG` below.
 *   - Increase `shoulderTiltDeg` if posture nudges trigger too easily.
 *   - Adjust `slouchDropRatio` (0.18 = 18% neck drop from calibrated upright pose).
 *   - Adjust `leanInWidthRatio` (1.28 = 28% wider shoulders than calibrated pose).
 *   - Adjust `yawThreshold` / `pitchLow` / `pitchHigh` for head orientation.
 *   - Adjust `gazeHorizontalThreshold` / `gazeDownThreshold` / `gazeUpThreshold`
 *     for iris/blendshape eye gaze sensitivity.
 *   - Adjust `nudgeDelaySec` to change how long bad posture/gaze must persist
 *     before a visual nudge appears.
 * =============================================================================
 */

import type { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";

// ─── Editable Thresholds ─────────────────────────────────────────────────────
export interface VisionCoachConfig {
  /** Seconds of continuous bad posture/gaze before showing a nudge. */
  nudgeDelaySec: number;
  /** Maximum side-to-side shoulder tilt in degrees before nudging. */
  shoulderTiltDeg: number;
  /** Fractional drop in neck ratio from upright baseline to count as slouching. */
  slouchDropRatio: number;
  /** Shoulder width multiplier vs. baseline to detect leaning too close. */
  leanInWidthRatio: number;
  /** Max horizontal head turn ratio (0 = straight ahead). */
  yawThreshold: number;
  /** Min vertical nose-to-eye pitch ratio (below = looking up). */
  pitchLow: number;
  /** Max vertical nose-to-eye pitch ratio (above = looking down). */
  pitchHigh: number;
  /** Blendshape threshold for sideways eye glance (0–1). */
  gazeHorizontalThreshold: number;
  /** Blendshape threshold for looking down with eyes (0–1). */
  gazeDownThreshold: number;
  /** Blendshape threshold for looking up with eyes (0–1). */
  gazeUpThreshold: number;
  /** Iris landmark offset fallback threshold when blendshapes are unavailable. */
  irisOffsetThreshold: number;
  /** Both eyes above this blink score counts as a blink (ignored for penalties). */
  blinkThreshold: number;
  /** Minimum landmark visibility score (0–1) required for shoulder landmarks. */
  minVisibility: number;
  /** Rolling window length (ms) for responsive live Eye Contact % and Posture %. */
  rollingWindowMs: number;
  /** Duration (ms) to collect initial steady frames for auto-calibration. */
  autoCalibrateDurationMs: number;
  /** Minimum time (ms) an active nudge stays visible so it cannot vanish mid-read. */
  nudgeMinHoldMs: number;
  /** Duration (ms) to show the green "Fixed!" confirmation after correcting. */
  nudgeResolvedDisplayMs: number;
}

export const DEFAULT_VISION_CONFIG: VisionCoachConfig = {
  nudgeDelaySec: 3.0,
  shoulderTiltDeg: 8.0,
  slouchDropRatio: 0.18,
  leanInWidthRatio: 1.28,
  yawThreshold: 0.26,
  pitchLow: 0.25,
  pitchHigh: 0.62,
  gazeHorizontalThreshold: 0.48,
  gazeDownThreshold: 0.52,
  gazeUpThreshold: 0.45,
  irisOffsetThreshold: 0.18,
  blinkThreshold: 0.45,
  minVisibility: 0.5,
  rollingWindowMs: 6000,
  autoCalibrateDurationMs: 1500,
  nudgeMinHoldMs: 800,
  nudgeResolvedDisplayMs: 1300,
};

// ─── MediaPipe Landmark Indices ──────────────────────────────────────────────
const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
} as const;

const FACE_LANDMARK = {
  NOSE_TIP: 1,
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  CHIN: 152,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_INNER: 362,
  LEFT_IRIS: 468,
  RIGHT_IRIS: 473,
} as const;

// ─── Output Types ────────────────────────────────────────────────────────────
export interface VisionDebugMetrics {
  fps: number;
  tiltAngle: number;
  neckRatio: number | null;
  baselineNeckRatio: number | null;
  shoulderWidthRatio: number | null;
  yawRatio: number;
  pitchRatio: number;
  gazeHorizontal: number;
  gazeDown: number;
  gazeUp: number;
  isBlinking: boolean;
}

export interface VisionSessionSummary {
  postureScore: number;
  eyeContactScore: number;
  postureNudges: number;
  eyeNudges: number;
  totalFrames: number;
}

export type VisionNudgeKind = "eye" | "posture";
export type VisionNudgePhase = "active" | "resolved";
export type VisionNudgeCode =
  | "eye_yaw"
  | "eye_gaze_side"
  | "eye_down"
  | "eye_up"
  | "face_missing"
  | "posture_tilt"
  | "posture_slouch"
  | "posture_close";

export interface VisionNudgeCue {
  /** Monotonic ID per nudge lifecycle (used to fire chimes once on onset). */
  id: number;
  kind: VisionNudgeKind;
  code: VisionNudgeCode;
  phase: VisionNudgePhase;
  /** Short 2–3 word action command readable in 0.3s (e.g. "Look at camera"). */
  action: string;
  /** Brief reason/context subtitle (e.g. "Eyes drifted to the side"). */
  detail: string;
}

export interface VisionCoachFrameResult {
  postureOk: boolean;
  eyeContactOk: boolean;
  postureNudge: string | null;
  eyeNudge: string | null;
  eyeNudgeCue: VisionNudgeCue | null;
  postureNudgeCue: VisionNudgeCue | null;
  /** Responsive live Eye Contact % (rolling window). */
  eyeContactScore: number;
  /** Responsive live Posture % (rolling window). */
  postureScore: number;
  liveEyeContactScore: number;
  livePostureScore: number;
  isCalibrating: boolean;
  isBlinking: boolean;
  /** Signed horizontal eye gaze (-1 = viewer left, +1 = viewer right). */
  gazeX: number;
  /** Signed vertical eye gaze (-1 = up, +1 = down). */
  gazeY: number;
  baselineNeckRatio: number | null;
  baselineShoulderWidth: number | null;
  debug: VisionDebugMetrics;
  summary: VisionSessionSummary;
}

interface NudgeIssue {
  code: VisionNudgeCode;
  action: string;
  detail: string;
}

interface NudgeBannerState {
  activeCue: VisionNudgeCue | null;
  shownAtMs: number;
  resolvedCue: VisionNudgeCue | null;
  resolvedUntilMs: number;
}

interface PostureCheckResult {
  ok: boolean;
  issue: NudgeIssue | null;
  tiltAngle: number;
  neckRatio: number | null;
  shoulderWidthRatio: number | null;
}

interface EyeCheckResult {
  ok: boolean;
  issue: NudgeIssue | null;
  yawRatio: number;
  pitchRatio: number;
  gazeHorizontal: number;
  gazeDown: number;
  gazeUp: number;
  gazeX: number;
  gazeY: number;
  isBlinking: boolean;
}

function getBlendshapeScore(
  categories: Category[] | null,
  name: string
): number {
  if (!categories || categories.length === 0) return 0;
  const match = categories.find((c) => c.categoryName === name);
  return match ? match.score : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Stateful frame-by-frame analyzer for Module 4 (Eye Contact & Posture).
 * Combines Nabil's geometry + 3-second debounce timers with blendshape/iris
 * gaze tracking, blink filtering, 1.5s auto-calibration, and rolling live scores.
 */
export class VisionCoachAnalyzer {
  public config: VisionCoachConfig;

  // Calibration & debounce timers (in milliseconds)
  private baselineNeckRatio: number | null = null;
  private baselineShoulderWidth: number | null = null;
  private latestNeckRatio: number | null = null;
  private latestShoulderWidthRatio: number | null = null;
  private calibrationStartMs: number | null = null;
  private calibrationSamples: {
    neckRatio: number;
    shoulderWidthRatio: number;
  }[] = [];

  private badPostureStartMs: number | null = null;
  private badEyeStartMs: number | null = null;
  private lastEyeOk = true;
  private nextCueId = 1;
  private eyeBannerState: NudgeBannerState = {
    activeCue: null,
    shownAtMs: 0,
    resolvedCue: null,
    resolvedUntilMs: 0,
  };
  private postureBannerState: NudgeBannerState = {
    activeCue: null,
    shownAtMs: 0,
    resolvedCue: null,
    resolvedUntilMs: 0,
  };

  // Rolling window for responsive live score display
  private rollingSamples: {
    ts: number;
    eyeOk: boolean;
    postureOk: boolean;
  }[] = [];

  // Cumulative session metrics for Module 6 Dashboard / Reports
  private totalFrames = 0;
  private goodPostureFrames = 0;
  private goodEyeFrames = 0;
  private postureNudgeCount = 0;
  private eyeNudgeCount = 0;
  private postureNudgedFlag = false;
  private eyeNudgedFlag = false;

  // FPS tracking
  private prevTimeMs = 0;
  private currentFps = 0;

  constructor(config: Partial<VisionCoachConfig> = {}) {
    this.config = { ...DEFAULT_VISION_CONFIG, ...config };
  }

  /** Updates the nudge debounce delay (in seconds) without resetting calibration. */
  public setNudgeDelay(sec: number): void {
    if (Number.isFinite(sec) && sec >= 0.5) {
      this.config.nudgeDelaySec = sec;
    }
  }

  /** Converts normalized MediaPipe coordinates (0..1) into pixel space. */
  private toPx(
    landmark: NormalizedLandmark,
    width: number,
    height: number
  ): [number, number] {
    return [landmark.x * width, landmark.y * height];
  }

  /** Sets the user's current upright posture as the reference baseline. */
  public calibratePosture(
    neckRatio?: number,
    shoulderWidthRatio?: number
  ): boolean {
    const targetNeck = neckRatio ?? this.latestNeckRatio;
    if (targetNeck === null) return false;
    this.baselineNeckRatio = targetNeck;

    const targetWidth = shoulderWidthRatio ?? this.latestShoulderWidthRatio;
    if (targetWidth !== null) {
      this.baselineShoulderWidth = targetWidth;
    }

    this.calibrationSamples = [];
    this.calibrationStartMs = null;
    this.badPostureStartMs = null;
    this.postureNudgedFlag = false;
    this.postureBannerState = {
      activeCue: null,
      shownAtMs: 0,
      resolvedCue: null,
      resolvedUntilMs: 0,
    };
    return true;
  }

  /** Resets cumulative session counters and nudge timers (keeps calibration). */
  public resetSession(): void {
    this.totalFrames = 0;
    this.goodPostureFrames = 0;
    this.goodEyeFrames = 0;
    this.postureNudgeCount = 0;
    this.eyeNudgeCount = 0;
    this.badPostureStartMs = null;
    this.badEyeStartMs = null;
    this.postureNudgedFlag = false;
    this.eyeNudgedFlag = false;
    this.lastEyeOk = true;
    this.eyeBannerState = {
      activeCue: null,
      shownAtMs: 0,
      resolvedCue: null,
      resolvedUntilMs: 0,
    };
    this.postureBannerState = {
      activeCue: null,
      shownAtMs: 0,
      resolvedCue: null,
      resolvedUntilMs: 0,
    };
  }

  /** Manages sticky hold + green confirmation banner transitions for a channel. */
  private updateNudgeBanner(
    state: NudgeBannerState,
    kind: VisionNudgeKind,
    isOk: boolean,
    debouncedIssue: NudgeIssue | null,
    nowMs: number
  ): VisionNudgeCue | null {
    if (debouncedIssue) {
      state.resolvedCue = null;
      if (state.activeCue) {
        state.activeCue = {
          ...state.activeCue,
          code: debouncedIssue.code,
          action: debouncedIssue.action,
          detail: debouncedIssue.detail,
        };
      } else {
        state.activeCue = {
          id: this.nextCueId++,
          kind,
          code: debouncedIssue.code,
          phase: "active",
          action: debouncedIssue.action,
          detail: debouncedIssue.detail,
        };
        state.shownAtMs = nowMs;
      }
      return state.activeCue;
    }

    if (state.activeCue) {
      if (nowMs - state.shownAtMs < this.config.nudgeMinHoldMs) {
        return state.activeCue;
      }
      if (isOk) {
        const resolvedCode = state.activeCue.code;
        state.activeCue = null;
        state.resolvedCue = {
          id: this.nextCueId++,
          kind,
          code: resolvedCode,
          phase: "resolved",
          action: kind === "eye" ? "Good eye contact" : "Great posture",
          detail: "Back on target",
        };
        state.resolvedUntilMs = nowMs + this.config.nudgeResolvedDisplayMs;
        return state.resolvedCue;
      }
      return state.activeCue;
    }

    if (state.resolvedCue) {
      if (nowMs < state.resolvedUntilMs) {
        return state.resolvedCue;
      }
      state.resolvedCue = null;
    }

    return null;
  }

  /** Detects side-to-side shoulder leaning, slouching, and leaning too close. */
  private analyzePosture(
    poseLandmarks: NormalizedLandmark[],
    width: number,
    height: number,
    nowMs: number
  ): PostureCheckResult {
    const lSh = poseLandmarks[POSE_LANDMARK.LEFT_SHOULDER];
    const rSh = poseLandmarks[POSE_LANDMARK.RIGHT_SHOULDER];
    const nose = poseLandmarks[POSE_LANDMARK.NOSE];

    if (!lSh || !rSh || !nose) {
      return {
        ok: true,
        issue: null,
        tiltAngle: 0,
        neckRatio: null,
        shoulderWidthRatio: null,
      };
    }

    const lVis = lSh.visibility ?? 1;
    const rVis = rSh.visibility ?? 1;
    if (lVis < this.config.minVisibility || rVis < this.config.minVisibility) {
      return {
        ok: true,
        issue: null,
        tiltAngle: 0,
        neckRatio: null,
        shoulderWidthRatio: null,
      };
    }

    const [lx, ly] = this.toPx(lSh, width, height);
    const [rx, ry] = this.toPx(rSh, width, height);
    const [, ny] = this.toPx(nose, width, height);

    const shoulderWidth = Math.hypot(lx - rx, ly - ry);
    if (shoulderWidth < 1e-6) {
      return {
        ok: true,
        issue: null,
        tiltAngle: 0,
        neckRatio: null,
        shoulderWidthRatio: null,
      };
    }

    // 1. Side-to-side lean (degrees)
    const tiltAngle = Math.abs(
      (Math.atan2(ly - ry, Math.abs(lx - rx) + 1e-6) * 180) / Math.PI
    );

    // 2. Forward slouch (nose-to-shoulder vertical distance / shoulder width)
    const shoulderMidY = (ly + ry) / 2.0;
    const neckRatio = (shoulderMidY - ny) / shoulderWidth;
    const shoulderWidthRatio = shoulderWidth / Math.max(width, 1);

    this.latestNeckRatio = neckRatio;
    this.latestShoulderWidthRatio = shoulderWidthRatio;

    const isLeaning = tiltAngle > this.config.shoulderTiltDeg;

    // Smart 1.5s auto-calibration using median of steady frames
    if (this.baselineNeckRatio === null) {
      if (!isLeaning) {
        if (this.calibrationStartMs === null) {
          this.calibrationStartMs = nowMs;
        }
        this.calibrationSamples.push({ neckRatio, shoulderWidthRatio });

        const elapsed = nowMs - this.calibrationStartMs;
        if (
          elapsed >= this.config.autoCalibrateDurationMs &&
          this.calibrationSamples.length >= 8
        ) {
          this.baselineNeckRatio = median(
            this.calibrationSamples.map((s) => s.neckRatio)
          );
          this.baselineShoulderWidth = median(
            this.calibrationSamples.map((s) => s.shoulderWidthRatio)
          );
          this.calibrationSamples = [];
        }
      }

      if (isLeaning) {
        return {
          ok: false,
          issue: {
            code: "posture_tilt",
            action: "Level shoulders",
            detail: "Straighten side-to-side lean",
          },
          tiltAngle,
          neckRatio,
          shoulderWidthRatio,
        };
      }
      return {
        ok: true,
        issue: null,
        tiltAngle,
        neckRatio,
        shoulderWidthRatio,
      };
    }

    const isSlouching =
      neckRatio < this.baselineNeckRatio * (1.0 - this.config.slouchDropRatio);
    const isTooClose =
      this.baselineShoulderWidth !== null &&
      shoulderWidthRatio >
        this.baselineShoulderWidth * this.config.leanInWidthRatio;

    if (isLeaning) {
      return {
        ok: false,
        issue: {
          code: "posture_tilt",
          action: "Level shoulders",
          detail: "Straighten side-to-side lean",
        },
        tiltAngle,
        neckRatio,
        shoulderWidthRatio,
      };
    }
    if (isSlouching) {
      return {
        ok: false,
        issue: {
          code: "posture_slouch",
          action: "Sit upright",
          detail: "Lift chest back to baseline",
        },
        tiltAngle,
        neckRatio,
        shoulderWidthRatio,
      };
    }
    if (isTooClose) {
      return {
        ok: false,
        issue: {
          code: "posture_close",
          action: "Move back",
          detail: "Leaning too close to camera",
        },
        tiltAngle,
        neckRatio,
        shoulderWidthRatio,
      };
    }

    return {
      ok: true,
      issue: null,
      tiltAngle,
      neckRatio,
      shoulderWidthRatio,
    };
  }

  /**
   * Detects head pose (yaw/pitch) + eye gaze (blendshapes & iris landmarks),
   * while filtering out natural blinks so blinking does not lower the score.
   */
  private analyzeEyeContact(
    faceLandmarks: NormalizedLandmark[],
    faceBlendshapes: Category[] | null,
    width: number,
    height: number
  ): EyeCheckResult {
    const noseLm = faceLandmarks[FACE_LANDMARK.NOSE_TIP];
    const lEyeLm = faceLandmarks[FACE_LANDMARK.LEFT_EYE_OUTER];
    const rEyeLm = faceLandmarks[FACE_LANDMARK.RIGHT_EYE_OUTER];
    const chinLm = faceLandmarks[FACE_LANDMARK.CHIN];

    if (!noseLm || !lEyeLm || !rEyeLm || !chinLm) {
      return {
        ok: true,
        issue: null,
        yawRatio: 0,
        pitchRatio: 0.45,
        gazeHorizontal: 0,
        gazeDown: 0,
        gazeUp: 0,
        gazeX: 0,
        gazeY: 0,
        isBlinking: false,
      };
    }

    const nose = this.toPx(noseLm, width, height);
    const lEye = this.toPx(lEyeLm, width, height);
    const rEye = this.toPx(rEyeLm, width, height);
    const chin = this.toPx(chinLm, width, height);

    // 1. Head Yaw (turning head left or right)
    const dLeft = Math.hypot(nose[0] - lEye[0], nose[1] - lEye[1]);
    const dRight = Math.hypot(nose[0] - rEye[0], nose[1] - rEye[1]);
    const yawRatio = Math.abs(dLeft - dRight) / (dLeft + dRight + 1e-6);

    // 2. Head Pitch (tilting head down at notes or up)
    const eyeMidY = (lEye[1] + rEye[1]) / 2.0;
    const faceHeight = chin[1] - eyeMidY;
    const pitchRatio =
      faceHeight >= 1e-6 ? (nose[1] - eyeMidY) / faceHeight : 0.45;

    // 3. Eye Blink & Gaze from Face Blendshapes
    const hasBlendshapes = Boolean(faceBlendshapes && faceBlendshapes.length > 0);
    const blinkL = getBlendshapeScore(faceBlendshapes, "eyeBlinkLeft");
    const blinkR = getBlendshapeScore(faceBlendshapes, "eyeBlinkRight");
    const isBlinking =
      hasBlendshapes &&
      blinkL > this.config.blinkThreshold &&
      blinkR > this.config.blinkThreshold;

    let gazeHorizontal = 0;
    let lookDown = 0;
    let lookUp = 0;
    let gazeX = 0;
    let gazeY = 0;

    if (hasBlendshapes) {
      const outL = getBlendshapeScore(faceBlendshapes, "eyeLookOutLeft");
      const inL = getBlendshapeScore(faceBlendshapes, "eyeLookInLeft");
      const outR = getBlendshapeScore(faceBlendshapes, "eyeLookOutRight");
      const inR = getBlendshapeScore(faceBlendshapes, "eyeLookInRight");
      const downL = getBlendshapeScore(faceBlendshapes, "eyeLookDownLeft");
      const downR = getBlendshapeScore(faceBlendshapes, "eyeLookDownRight");
      const upL = getBlendshapeScore(faceBlendshapes, "eyeLookUpLeft");
      const upR = getBlendshapeScore(faceBlendshapes, "eyeLookUpRight");

      const lookLeft = (outL + inR) / 2;
      const lookRight = (inL + outR) / 2;
      gazeHorizontal = Math.max(lookLeft, lookRight);
      gazeX = lookRight - lookLeft;

      lookDown = (downL + downR) / 2;
      lookUp = (upL + upR) / 2;
      gazeY = lookDown - lookUp;
    } else if (faceLandmarks.length >= 478) {
      // Iris landmark fallback if blendshapes are unavailable
      const lInner = faceLandmarks[FACE_LANDMARK.LEFT_EYE_INNER];
      const rInner = faceLandmarks[FACE_LANDMARK.RIGHT_EYE_INNER];
      const lIris = faceLandmarks[FACE_LANDMARK.LEFT_IRIS];
      const rIris = faceLandmarks[FACE_LANDMARK.RIGHT_IRIS];

      if (lInner && rInner && lIris && rIris) {
        const lWidth = Math.abs(lInner.x - lEyeLm.x) + 1e-6;
        const lCenterX = (lEyeLm.x + lInner.x) / 2;
        const lOffset = (lIris.x - lCenterX) / lWidth;

        const rWidth = Math.abs(rEyeLm.x - rInner.x) + 1e-6;
        const rCenterX = (rInner.x + rEyeLm.x) / 2;
        const rOffset = (rIris.x - rCenterX) / rWidth;

        const avgOffset = (lOffset + rOffset) / 2;
        gazeHorizontal = Math.abs(avgOffset);
        gazeX = -avgOffset * 2;
      }
    }

    if (isBlinking) {
      return {
        ok: this.lastEyeOk,
        issue: null,
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: true,
      };
    }

    if (yawRatio > this.config.yawThreshold) {
      return {
        ok: false,
        issue: {
          code: "eye_yaw",
          action: "Look at camera",
          detail: "Head turned away from lens",
        },
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: false,
      };
    }
    if (pitchRatio > this.config.pitchHigh) {
      return {
        ok: false,
        issue: {
          code: "eye_down",
          action: "Eyes up",
          detail: "Avoid looking down at notes",
        },
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: false,
      };
    }
    if (pitchRatio < this.config.pitchLow) {
      return {
        ok: false,
        issue: {
          code: "eye_up",
          action: "Lower gaze",
          detail: "Look straight into the lens",
        },
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: false,
      };
    }

    const gazeOffSideways = hasBlendshapes
      ? gazeHorizontal > this.config.gazeHorizontalThreshold
      : gazeHorizontal > this.config.irisOffsetThreshold;

    if (gazeOffSideways) {
      return {
        ok: false,
        issue: {
          code: "eye_gaze_side",
          action: "Look at camera",
          detail: "Eyes drifted to the side",
        },
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: false,
      };
    }
    if (lookDown > this.config.gazeDownThreshold) {
      return {
        ok: false,
        issue: {
          code: "eye_down",
          action: "Eyes up",
          detail: "Avoid reading notes below",
        },
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: false,
      };
    }
    if (lookUp > this.config.gazeUpThreshold) {
      return {
        ok: false,
        issue: {
          code: "eye_up",
          action: "Lower gaze",
          detail: "Eyes looking above camera",
        },
        yawRatio,
        pitchRatio,
        gazeHorizontal,
        gazeDown: lookDown,
        gazeUp: lookUp,
        gazeX,
        gazeY,
        isBlinking: false,
      };
    }

    return {
      ok: true,
      issue: null,
      yawRatio,
      pitchRatio,
      gazeHorizontal,
      gazeDown: lookDown,
      gazeUp: lookUp,
      gazeX,
      gazeY,
      isBlinking: false,
    };
  }

  /**
   * Processes one video frame's Face + Blendshape + Pose landmarks.
   * Call from the requestAnimationFrame loop in `useVisionCoach`.
   */
  public processLandmarks(
    faceLandmarks: NormalizedLandmark[] | null,
    faceBlendshapes: Category[] | null,
    poseLandmarks: NormalizedLandmark[] | null,
    width: number,
    height: number,
    nowMs: number,
    trackSession = true
  ): VisionCoachFrameResult {
    // Update smoothed FPS
    if (this.prevTimeMs > 0) {
      const dtSec = (nowMs - this.prevTimeMs) / 1000;
      if (dtSec > 0 && dtSec < 2) {
        this.currentFps =
          this.currentFps === 0
            ? 1 / dtSec
            : 0.9 * this.currentFps + 0.1 * (1 / dtSec);
      }
    }
    this.prevTimeMs = nowMs;

    const delayMs = this.config.nudgeDelaySec * 1000;
    if (trackSession) {
      this.totalFrames += 1;
    }

    // --- 1. Posture Evaluation ---
    let postureOk = true;
    let debouncedPostureIssue: NudgeIssue | null = null;
    let tiltAngle = 0;
    let neckRatio: number | null = null;
    let shoulderWidthRatio: number | null = null;

    if (poseLandmarks && poseLandmarks.length > POSE_LANDMARK.RIGHT_SHOULDER) {
      const res = this.analyzePosture(poseLandmarks, width, height, nowMs);
      postureOk = res.ok;
      tiltAngle = res.tiltAngle;
      neckRatio = res.neckRatio;
      shoulderWidthRatio = res.shoulderWidthRatio;

      if (postureOk) {
        if (trackSession) this.goodPostureFrames += 1;
        this.badPostureStartMs = null;
        this.postureNudgedFlag = false;
      } else {
        if (this.badPostureStartMs === null) {
          this.badPostureStartMs = nowMs;
        } else if (nowMs - this.badPostureStartMs >= delayMs) {
          debouncedPostureIssue = res.issue;
          if (trackSession && !this.postureNudgedFlag) {
            this.postureNudgeCount += 1;
            this.postureNudgedFlag = true;
          }
        }
      }
    } else if (trackSession) {
      // Do not penalize posture if shoulders are out of frame
      this.goodPostureFrames += 1;
    }

    const postureNudgeCue = this.updateNudgeBanner(
      this.postureBannerState,
      "posture",
      postureOk,
      debouncedPostureIssue,
      nowMs
    );

    // --- 2. Eye Contact Evaluation ---
    let eyeOk = true;
    let debouncedEyeIssue: NudgeIssue | null = null;
    let yawRatio = 0;
    let pitchRatio = 0.45;
    let gazeHorizontal = 0;
    let gazeDown = 0;
    let gazeUp = 0;
    let gazeX = 0;
    let gazeY = 0;
    let isBlinking = false;

    if (faceLandmarks && faceLandmarks.length > FACE_LANDMARK.RIGHT_EYE_OUTER) {
      const res = this.analyzeEyeContact(
        faceLandmarks,
        faceBlendshapes,
        width,
        height
      );
      eyeOk = res.ok;
      yawRatio = res.yawRatio;
      pitchRatio = res.pitchRatio;
      gazeHorizontal = res.gazeHorizontal;
      gazeDown = res.gazeDown;
      gazeUp = res.gazeUp;
      gazeX = res.gazeX;
      gazeY = res.gazeY;
      isBlinking = res.isBlinking;

      if (!isBlinking) {
        this.lastEyeOk = eyeOk;
      }

      if (eyeOk) {
        if (trackSession) this.goodEyeFrames += 1;
        this.badEyeStartMs = null;
        this.eyeNudgedFlag = false;
      } else {
        if (this.badEyeStartMs === null) {
          this.badEyeStartMs = nowMs;
        } else if (nowMs - this.badEyeStartMs >= delayMs) {
          debouncedEyeIssue = res.issue;
          if (trackSession && !this.eyeNudgedFlag) {
            this.eyeNudgeCount += 1;
            this.eyeNudgedFlag = true;
          }
        }
      }
    } else {
      eyeOk = false;
      this.lastEyeOk = false;
      if (this.badEyeStartMs === null) {
        this.badEyeStartMs = nowMs;
      } else if (nowMs - this.badEyeStartMs >= delayMs) {
        debouncedEyeIssue = {
          code: "face_missing",
          action: "Center face",
          detail: "Step back into camera frame",
        };
        if (trackSession && !this.eyeNudgedFlag) {
          this.eyeNudgeCount += 1;
          this.eyeNudgedFlag = true;
        }
      }
    }

    const eyeNudgeCue = this.updateNudgeBanner(
      this.eyeBannerState,
      "eye",
      eyeOk,
      debouncedEyeIssue,
      nowMs
    );

    // --- 3. Responsive Rolling Live Scores (runs even in preview mode) ---
    this.rollingSamples.push({ ts: nowMs, eyeOk, postureOk });
    const cutoffMs = nowMs - this.config.rollingWindowMs;
    while (
      this.rollingSamples.length > 0 &&
      this.rollingSamples[0].ts < cutoffMs
    ) {
      this.rollingSamples.shift();
    }

    const sampleCount = this.rollingSamples.length;
    const liveEyeContactScore =
      sampleCount > 0
        ? Math.round(
            (this.rollingSamples.filter((s) => s.eyeOk).length / sampleCount) *
              1000
          ) / 10
        : 100;
    const livePostureScore =
      sampleCount > 0
        ? Math.round(
            (this.rollingSamples.filter((s) => s.postureOk).length /
              sampleCount) *
              1000
          ) / 10
        : 100;

    const summary = this.getSessionSummary();

    return {
      postureOk,
      eyeContactOk: eyeOk,
      postureNudge:
        postureNudgeCue?.phase === "active" ? postureNudgeCue.action : null,
      eyeNudge: eyeNudgeCue?.phase === "active" ? eyeNudgeCue.action : null,
      eyeNudgeCue,
      postureNudgeCue,
      eyeContactScore: liveEyeContactScore,
      postureScore: livePostureScore,
      liveEyeContactScore,
      livePostureScore,
      isCalibrating:
        this.baselineNeckRatio === null && this.calibrationSamples.length > 0,
      isBlinking,
      gazeX,
      gazeY,
      baselineNeckRatio: this.baselineNeckRatio,
      baselineShoulderWidth: this.baselineShoulderWidth,
      debug: {
        fps: Math.round(this.currentFps * 10) / 10,
        tiltAngle: Math.round(tiltAngle * 10) / 10,
        neckRatio:
          neckRatio !== null ? Math.round(neckRatio * 1000) / 1000 : null,
        baselineNeckRatio:
          this.baselineNeckRatio !== null
            ? Math.round(this.baselineNeckRatio * 1000) / 1000
            : null,
        shoulderWidthRatio:
          shoulderWidthRatio !== null
            ? Math.round(shoulderWidthRatio * 1000) / 1000
            : null,
        yawRatio: Math.round(yawRatio * 1000) / 1000,
        pitchRatio: Math.round(pitchRatio * 1000) / 1000,
        gazeHorizontal: Math.round(gazeHorizontal * 100) / 100,
        gazeDown: Math.round(gazeDown * 100) / 100,
        gazeUp: Math.round(gazeUp * 100) / 100,
        isBlinking,
      },
      summary,
    };
  }

  /** Exports cumulative session metrics for Module 6 (Dashboard & Report). */
  public getSessionSummary(): VisionSessionSummary {
    if (this.totalFrames === 0) {
      return {
        postureScore: 100,
        eyeContactScore: 100,
        postureNudges: 0,
        eyeNudges: 0,
        totalFrames: 0,
      };
    }

    return {
      postureScore:
        Math.round((this.goodPostureFrames / this.totalFrames) * 1000) / 10,
      eyeContactScore:
        Math.round((this.goodEyeFrames / this.totalFrames) * 1000) / 10,
      postureNudges: this.postureNudgeCount,
      eyeNudges: this.eyeNudgeCount,
      totalFrames: this.totalFrames,
    };
  }
}
