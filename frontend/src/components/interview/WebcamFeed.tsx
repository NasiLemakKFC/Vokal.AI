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
        className={`relative overflow-hidden rounded-[6px] border border-[#e8eaec] bg-[#0f1419] ${className}`}
      >
        {/* ── Loading State (Dark Studio Surface — prevents harsh white flash) ── */}
        {(status === "idle" || status === "requesting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0f1419] text-white/90 select-none">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-12 w-12 rounded-full bg-[#1b6c80]/25 animate-ping" />
              <div className="relative w-11 h-11 rounded-full bg-white/5 border border-white/15 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#4edea3]" />
              </div>
            </div>
            <div className="text-center space-y-0.5 px-4">
              <p className="text-[13px] font-medium text-white">
                Starting HD camera…
              </p>
              <p className="text-[11.5px] text-white/60">
                Video stays 100% on your device
              </p>
            </div>
          </div>
        )}

        {/* ── Muted State ──────────────────────────────────────────────── */}
        {status === "muted" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f9fbfc] text-[#131416] p-6 text-center">
            <div className="w-12 h-12 rounded-[8px] bg-[#eef4f6] flex items-center justify-center border border-[#e8eaec]">
              <span className="material-symbols-outlined text-[#1b6c80] text-[22px]">
                videocam_off
              </span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#131416]">Camera is turned off</p>
              <p className="text-[12px] text-[#5d5f60] mt-1">
                Click &ldquo;Video Off&rdquo; in the control dock below to re-enable your camera.
              </p>
            </div>
          </div>
        )}

        {/* ── Error / Denied State ──────────────────────────────────────── */}
        {(status === "denied" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#f9fbfc]">
            <VideoOff className="h-8 w-8 text-[#c4242a]" />
            <p className="text-[13px] text-[#5d5f60] max-w-md">{errorMessage}</p>
          </div>
        )}

        {/* ── Live Video Feed ───────────────────────────────────────────── */}
        {/* Always rendered so the stream can attach; fades in smoothly once active */}
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
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
          className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${
            showDebugOverlay ? "block" : "hidden"
          }`}
          style={{ transform: "scaleX(-1)" }} // Must match video mirror
        />

        {/* ── Status Indicator ──────────────────────────────────────────── */}
        {status === "active" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-[4px] bg-black/75 border border-white/15 px-2.5 py-1">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#4edea3]" />
            <span className="text-[11px] font-medium text-white tracking-tight">
              LIVE
            </span>
          </div>
        )}
      </div>
    );
  }
);

export default WebcamFeed;
