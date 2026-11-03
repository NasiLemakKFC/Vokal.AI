/**
 * =============================================================================
 * WebcamFeed.tsx — Webcam Video + Canvas Overlay Component
 * =============================================================================
 *
 * Responsibilities:
 *   1. Request webcam permissions via navigator.mediaDevices.getUserMedia.
 *   2. Render a <video> element displaying the live webcam stream.
 *   3. Layer an absolutely-positioned <canvas> on top of the video for
 *      drawing debug overlays (e.g. the 478 face-mesh points).
 *
 * ARCHITECTURE:
 *   This component is a "dumb" media source. It exposes its videoRef
 *   upward so parent components / hooks (like useFaceMesh) can read
 *   frames from the HTMLVideoElement without owning the DOM node.
 *
 * TODO: Add a debug toggle prop that draws face-mesh landmarks on the
 *       canvas overlay in real-time.
 * TODO: Add resolution/FPS constraints for optimal MediaPipe performance
 *       (e.g. 640×480 @ 30 fps is a good balance).
 * =============================================================================
 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { VideoOff, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface WebcamFeedHandle {
  /** Direct reference to the <video> DOM element. */
  videoElement: HTMLVideoElement | null;
  /** Direct reference to the <canvas> overlay DOM element. */
  canvasElement: HTMLCanvasElement | null;
}

interface WebcamFeedProps {
  /** Optional CSS class for the outer container. */
  className?: string;
  /** When true, draws debug landmarks on the canvas (placeholder). */
  showDebugOverlay?: boolean;
  /** Specific camera device ID to stream from */
  deviceId?: string;
  /** Toggle camera video stream on/off */
  isVideoOn?: boolean;
  /** Fired when camera access is granted to prompt device re-enumeration */
  onDevicesDiscovered?: () => void;
}

/**
 * WebcamFeed renders a live webcam preview with a <canvas> overlay for
 * drawing face-mesh debug points.
 *
 * Use `forwardRef` + `useImperativeHandle` so parent components can
 * grab the raw HTMLVideoElement to feed into MediaPipe.
 */
const WebcamFeed = forwardRef<WebcamFeedHandle, WebcamFeedProps>(
  function WebcamFeed(
    {
      className = "",
      showDebugOverlay = false,
      deviceId,
      isVideoOn = true,
      onDevicesDiscovered,
    },
    ref
  ) {
    // ── Refs ──────────────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // ── State ─────────────────────────────────────────────────────────────────
    const [status, setStatus] = useState<
      "idle" | "requesting" | "active" | "muted" | "denied" | "error"
    >("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");

    // ── Expose refs to parent ─────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      get videoElement() {
        return videoRef.current;
      },
      get canvasElement() {
        return canvasRef.current;
      },
    }));

    // ── Request webcam on mount / device change ──────────────────────────────
    useEffect(() => {
      let stream: MediaStream | null = null;
      let isCancelled = false;
      const videoElement = videoRef.current;

      async function startWebcam() {
        if (!isVideoOn) {
          setStatus("muted");
          if (videoElement) {
            videoElement.srcObject = null;
          }
          return;
        }

        setStatus("requesting");

        try {
          const constraints: MediaStreamConstraints = {
            video: {
              ...(deviceId ? { deviceId: { ideal: deviceId } } : { facingMode: "user" }),
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              aspectRatio: { ideal: 16 / 9 },
              frameRate: { ideal: 30, min: 15 },
            },
            audio: false,
          };

          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

          if (isCancelled) {
            mediaStream.getTracks().forEach((track) => track.stop());
            return;
          }

          stream = mediaStream;

          if (videoElement) {
            videoElement.srcObject = mediaStream;
            try {
              await videoElement.play();
            } catch (playErr: unknown) {
              if (playErr instanceof DOMException && playErr.name === "AbortError") {
                return;
              }
              console.warn("[WebcamFeed] video play error:", playErr);
            }

            if (!isCancelled) {
              setStatus("active");
              onDevicesDiscovered?.();
            }
          }
        } catch (err) {
          if (isCancelled) return;

          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }

          if (err instanceof DOMException && err.name === "NotAllowedError") {
            setStatus("denied");
            setErrorMessage(
              "Camera access was denied. Please allow camera permissions to use the interview coach."
            );
          } else {
            setStatus("error");
            setErrorMessage(
              err instanceof Error ? err.message : "Could not access camera."
            );
          }
          console.error("[WebcamFeed] getUserMedia error:", err);
        }
      }

      startWebcam();

      // Cleanup: stop all tracks when unmounting or switching device
      return () => {
        isCancelled = true;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        if (videoElement) {
          videoElement.srcObject = null;
        }
      };
    }, [deviceId, isVideoOn, onDevicesDiscovered]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-outline bg-black ${className}`}
      >
        {/* ── Loading State ─────────────────────────────────────────────── */}
        {(status === "idle" || status === "requesting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-surface-subtle">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Requesting camera access…</p>
          </div>
        )}

        {/* ── Muted State ──────────────────────────────────────────────── */}
        {status === "muted" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background text-on-surface p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-active flex items-center justify-center border border-outline shadow-sm">
              <span className="material-symbols-outlined text-on-surface-subtle text-3xl">
                videocam_off
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">Camera is turned off</p>
              <p className="text-xs text-on-surface-subtle mt-1">
                Click &ldquo;Video Muted&rdquo; in the dock below to re-enable your camera.
              </p>
            </div>
          </div>
        )}

        {/* ── Error / Denied State ──────────────────────────────────────── */}
        {(status === "denied" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background">
            <VideoOff className="h-10 w-10 text-error" />
            <p className="text-sm text-on-surface-subtle">{errorMessage}</p>
          </div>
        )}

        {/* ── Live Video Feed ───────────────────────────────────────────── */}
        {/* Always rendered so the stream can attach; hidden visually only on error states */}
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover ${
            status === "active" ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: "scaleX(-1)" }} // Mirror for natural UX
          autoPlay
          playsInline
          muted
        />

        {/* ── Debug Canvas Overlay ──────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full pointer-events-none ${
            showDebugOverlay ? "block" : "hidden"
          }`}
          style={{ transform: "scaleX(-1)" }} // Must match video mirror
        />

        {/* ── Status Indicator ──────────────────────────────────────────── */}
        {status === "active" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="text-xs font-medium text-white/80">LIVE</span>
          </div>
        )}
      </div>
    );
  }
);

export default WebcamFeed;
