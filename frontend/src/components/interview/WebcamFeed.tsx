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
  /** When true, draws debug landmarks on the canvas. */
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
      let discoverTimer: ReturnType<typeof setTimeout> | null = null;
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
              // Defer device re-enumeration slightly so camera first-frame paint is never blocked
              discoverTimer = setTimeout(() => {
                if (!isCancelled) {
                  onDevicesDiscovered?.();
                }
              }, 180);
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
              "Camera access was denied. Allow camera permissions in your browser to enable presence tracking"
            );
          } else {
            setStatus("error");
            setErrorMessage(
              err instanceof Error ? err.message : "Could not access camera"
            );
          }
          console.error("[WebcamFeed] getUserMedia error:", err);
        }
      }

      startWebcam();

      // Cleanup: stop all tracks when unmounting or switching device
      return () => {
        isCancelled = true;
        if (discoverTimer) {
          clearTimeout(discoverTimer);
        }
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
        className={`relative overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-zinc-950 ${className}`}
      >
        {/* ── Loading State ── */}
        {(status === "idle" || status === "requesting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 text-white/90 select-none">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center">
              <span className="w-4 h-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            </div>
            <div className="text-center space-y-1 px-4">
              <p className="text-[13px] font-medium text-white">
                Starting HD camera…
              </p>
              <p className="text-[12px] text-white/60">
                Video stays on your device
              </p>
            </div>
          </div>
        )}

        {/* ── Muted State ──────────────────────────────────────────────── */}
        {status === "muted" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--raised)] text-[var(--text)] p-6 text-center">
            <div className="w-11 h-11 rounded-[var(--radius-card)] bg-[var(--surface)] flex items-center justify-center border border-[var(--border)]">
              <span className="material-symbols-outlined text-[var(--muted)] text-[20px]">
                videocam_off
              </span>
            </div>
            <div>
              <p className="text-[14px] font-medium text-[var(--text)]">
                Camera is turned off
              </p>
              <p className="text-[12px] text-[var(--muted)] mt-1">
                Use the camera button in the dock below to re-enable video
              </p>
            </div>
          </div>
        )}

        {/* ── Error / Denied State ──────────────────────────────────────── */}
        {(status === "denied" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[var(--raised)]">
            <span className="material-symbols-outlined text-[24px] text-[var(--negative)]">
              videocam_off
            </span>
            <p className="text-[13px] text-[var(--muted)] max-w-md">{errorMessage}</p>
          </div>
        )}

        {/* ── Live Video Feed ───────────────────────────────────────────── */}
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
            status === "active" ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: "scaleX(-1)" }}
          autoPlay
          playsInline
          muted
        />

        {/* ── Debug Canvas Overlay ──────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${
            showDebugOverlay ? "block" : "hidden"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />

        {/* ── Status Indicator ──────────────────────────────────────────── */}
        {status === "active" && (
          <div className="absolute top-3 left-3 h-7 flex items-center gap-1.5 rounded-[6px] bg-black/75 border border-white/15 px-2.5">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#4cc38a]" />
            <span className="text-[12px] font-medium text-white">Live</span>
          </div>
        )}
      </div>
    );
  }
);

export default WebcamFeed;
