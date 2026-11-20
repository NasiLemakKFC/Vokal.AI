/**
 * =============================================================================
 * visionOverlay.ts — Minimal Wireframe Line Renderer for Module 4
 * =============================================================================
 *
 * Draws a clean, non-distracting structural overlay onto WebcamFeed's <canvas>:
 *   - Body posture: shoulder-to-shoulder bar, joint dots, vertical neck/spine
 *     axis, upper-arm guides, and calibrated upright height target bracket.
 *   - Eye & head gaze: subtle eye alignment cross, eye contours, iris tracking
 *     rings, and a short gaze direction indicator.
 *
 * NOTE: Never draw text on this canvas — WebcamFeed mirrors both <video> and
 * <canvas> with CSS `scaleX(-1)`, so text would appear backwards.
 * =============================================================================
 */

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { VisionCoachFrameResult } from "@/lib/vision/visionCoach";

const COLOR_OK = "#4edea3"; // Emerald
const COLOR_WARN = "#fbbf24"; // Amber (debounce counting)
const COLOR_NUDGE = "#ef4444"; // Red (nudge active)
const COLOR_TARGET = "rgba(255, 255, 255, 0.72)";

const LEFT_EYE_CONTOUR = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];
const RIGHT_EYE_CONTOUR = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
];

function statusColor(ok: boolean, hasNudge: boolean): string {
  if (hasNudge) return COLOR_NUDGE;
  if (!ok) return COLOR_WARN;
  return COLOR_OK;
}

function pt(
  lm: NormalizedLandmark,
  width: number,
  height: number
): [number, number] {
  return [lm.x * width, lm.y * height];
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawContour(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  indices: number[],
  width: number,
  height: number
): void {
  let started = false;
  ctx.beginPath();
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const [x, y] = pt(lm, width, height);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) {
    ctx.closePath();
    ctx.stroke();
  }
}

function drawBodyStructure(
  ctx: CanvasRenderingContext2D,
  poseLandmarks: NormalizedLandmark[],
  faceLandmarks: NormalizedLandmark[] | null,
  width: number,
  height: number,
  result: VisionCoachFrameResult
): void {
  const lSh = poseLandmarks[11];
  const rSh = poseLandmarks[12];
  if (!lSh || !rSh) return;

  if ((lSh.visibility ?? 1) < 0.45 || (rSh.visibility ?? 1) < 0.45) {
    return;
  }

  const color = statusColor(result.postureOk, Boolean(result.postureNudge));
  const [lx, ly] = pt(lSh, width, height);
  const [rx, ry] = pt(rSh, width, height);
  const midX = (lx + rx) / 2;
  const midY = (ly + ry) / 2;
  const shoulderWidth = Math.hypot(lx - rx, ly - ry);

  ctx.save();

  // 1. Faint horizontal level reference across shoulder midpoint
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const minX = Math.min(lx, rx) - 18;
  const maxX = Math.max(lx, rx) + 18;
  ctx.beginPath();
  ctx.moveTo(minX, midY);
  ctx.lineTo(maxX, midY);
  ctx.stroke();
  ctx.restore();

  // 2. Upper-arm guides (shoulders -> elbows) when visible
  const lElbow = poseLandmarks[13];
  const rElbow = poseLandmarks[14];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.75;
  if (lElbow && (lElbow.visibility ?? 0) >= 0.45) {
    const [ex, ey] = pt(lElbow, width, height);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  if (rElbow && (rElbow.visibility ?? 0) >= 0.45) {
    const [ex, ey] = pt(rElbow, width, height);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Solid shoulder-to-shoulder bar + joint dots
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.stroke();

  drawDot(ctx, lx, ly, 4.5, color);
  drawDot(ctx, rx, ry, 4.5, color);
  drawDot(ctx, midX, midY, 3.5, "#ffffff");

  // 4. Vertical neck/spine axis up to nose
  const noseLm = poseLandmarks[0] ?? faceLandmarks?.[1];
  if (noseLm && (noseLm.visibility ?? 1) >= 0.45) {
    const [nx, ny] = pt(noseLm, width, height);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.restore();
    drawDot(ctx, nx, ny, 3.5, color);
  }

  // 5. Calibrated upright posture height target bracket
  if (result.baselineNeckRatio !== null && shoulderWidth > 1) {
    const targetY = midY - result.baselineNeckRatio * shoulderWidth;
    ctx.save();
    ctx.strokeStyle = COLOR_TARGET;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(midX - 22, targetY);
    ctx.lineTo(midX + 22, targetY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawEyeAndHeadStructure(
  ctx: CanvasRenderingContext2D,
  faceLandmarks: NormalizedLandmark[],
  width: number,
  height: number,
  result: VisionCoachFrameResult
): void {
  const color = statusColor(result.eyeContactOk, Boolean(result.eyeNudge));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. Subtle Head Alignment T-Cross (outer eyes + glabella-nose-chin)
  const lEyeOuter = faceLandmarks[33];
  const rEyeOuter = faceLandmarks[263];
  const glabella = faceLandmarks[168];
  const chin = faceLandmarks[152];

  if (lEyeOuter && rEyeOuter && glabella && chin) {
    const [lx, ly] = pt(lEyeOuter, width, height);
    const [rx, ry] = pt(rEyeOuter, width, height);
    const [gx, gy] = pt(glabella, width, height);
    const [cx, cy] = pt(chin, width, height);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.moveTo(gx, gy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Clean Left & Right Eye Contours (dimmed slightly during blinks)
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = result.isBlinking ? 0.35 : 0.85;
  ctx.lineWidth = 1.5;
  drawContour(ctx, faceLandmarks, LEFT_EYE_CONTOUR, width, height);
  drawContour(ctx, faceLandmarks, RIGHT_EYE_CONTOUR, width, height);
  ctx.restore();

  // 3. Iris Tracking Rings + Gaze Direction Vector
  const hasIris = faceLandmarks.length >= 478;
  const dx = -result.gazeX * 26;
  const dy = result.gazeY * 22;
  const gazeMag = Math.hypot(dx, dy);

  if (hasIris && !result.isBlinking) {
    const irisPairs: [number, number][] = [
      [468, 469],
      [473, 474],
    ];

    for (const [centerIdx, edgeIdx] of irisPairs) {
      const centerLm = faceLandmarks[centerIdx];
      const edgeLm = faceLandmarks[edgeIdx];
      if (!centerLm) continue;

      const [ix, iy] = pt(centerLm, width, height);
      let radius = 5;
      if (edgeLm) {
        const [ex, ey] = pt(edgeLm, width, height);
        radius = Math.max(4, Math.min(12, Math.hypot(ex - ix, ey - iy)));
      }

      ctx.beginPath();
      ctx.arc(ix, iy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawDot(ctx, ix, iy, 2, "#ffffff");

      if (gazeMag > 3) {
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(ix + dx, iy + dy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.75;
        ctx.stroke();
        drawDot(ctx, ix + dx, iy + dy, 2.5, color);
      }
    }
  } else if (glabella && !result.isBlinking && gazeMag > 3) {
    const [gx, gy] = pt(glabella, width, height);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + dx, gy + dy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawDot(ctx, gx + dx, gy + dy, 3, color);
  }

  ctx.restore();
}

/**
 * Renders the minimal eye & body structure wireframe onto the canvas overlay.
 */
export function drawVisionOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  faceLandmarks: NormalizedLandmark[] | null,
  poseLandmarks: NormalizedLandmark[] | null,
  result: VisionCoachFrameResult
): void {
  ctx.clearRect(0, 0, width, height);

  if (poseLandmarks && poseLandmarks.length > 12) {
    drawBodyStructure(ctx, poseLandmarks, faceLandmarks, width, height, result);
  }

  if (faceLandmarks && faceLandmarks.length > 263) {
    drawEyeAndHeadStructure(ctx, faceLandmarks, width, height, result);
  }
}
