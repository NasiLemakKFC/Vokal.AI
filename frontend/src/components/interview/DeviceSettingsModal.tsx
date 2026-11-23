"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MediaDeviceItem } from "@/hooks/useMediaDevices";

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioDevices: MediaDeviceItem[];
  videoDevices: MediaDeviceItem[];
  selectedAudioId: string;
  selectedVideoId: string;
  onSelectAudio: (deviceId: string) => void;
  onSelectVideo: (deviceId: string) => void;
  micGain?: number;
  onChangeMicGain?: (gain: number) => void;
  noiseSuppression?: boolean;
  onToggleNoiseSuppression?: (enabled: boolean) => void;
  onRefreshDevices?: () => void;
}

function signalStatusLabel(level: number): string {
  if (level <= 5) return "Speak to test";
  if (level < 25) return `${level}% · Quiet`;
  if (level <= 85) return `${level}% · Good`;
  return `${level}% · Loud`;
}

export default function DeviceSettingsModal({
  isOpen,
  onClose,
  audioDevices,
  videoDevices,
  selectedAudioId,
  selectedVideoId,
  onSelectAudio,
  onSelectVideo,
  micGain = 1.0,
  onChangeMicGain,
  noiseSuppression = true,
  onToggleNoiseSuppression,
  onRefreshDevices,
}: DeviceSettingsModalProps) {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const micGainRef = useRef<number>(micGain);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    micGainRef.current = micGain;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micGain;
    }
  }, [micGain]);

  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    gainNodeRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    async function initAudioMeter() {
      try {
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        gainNodeRef.current = null;
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: selectedAudioId ? { ideal: selectedAudioId } : undefined,
            channelCount: 1,
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression,
          },
          video: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        micStreamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = micGainRef.current;
        gainNodeRef.current = gainNode;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(gainNode);
        gainNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          setAudioLevel(normalized);

          animationFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (err) {
        console.warn("[DeviceSettingsModal] Mic test meter not available:", err);
      }
    }

    initAudioMeter();

    return () => {
      isCancelled = true;
      cleanupAudio();
    };
  }, [isOpen, selectedAudioId, noiseSuppression, cleanupAudio]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-modal-title"
        className="w-full max-w-lg bg-[var(--surface)] text-[var(--text)] rounded-[var(--radius-card)] border border-[var(--border)] overflow-hidden"
        style={{ boxShadow: "var(--shadow-popover)" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)]">
          <div>
            <h2 id="device-modal-title" className="text-[16px] font-medium text-[var(--text)]">
              Audio and video
            </h2>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">
              Choose your camera and microphone
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-[var(--radius-control)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Camera Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="webcam-select"
                className="text-[13px] font-medium text-[var(--text)]"
              >
                Webcam input
              </label>
              <span className="text-[12px] text-[var(--muted)] font-mono tabular-nums">
                {videoDevices.length} available
              </span>
            </div>

            <div className="relative">
              <select
                id="webcam-select"
                value={selectedVideoId}
                onChange={(e) => onSelectVideo(e.target.value)}
                className="input-field w-full h-9 appearance-none px-3 pr-9 text-[13px] cursor-pointer"
              >
                {videoDevices.length === 0 ? (
                  <option value="">Default HD camera</option>
                ) : (
                  videoDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none text-[18px] leading-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Microphone Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="mic-select"
                className="text-[13px] font-medium text-[var(--text)]"
              >
                Microphone input
              </label>
              <span className="text-[12px] text-[var(--muted)] font-mono tabular-nums">
                {audioDevices.length} available
              </span>
            </div>

            <div className="relative">
              <select
                id="mic-select"
                value={selectedAudioId}
                onChange={(e) => onSelectAudio(e.target.value)}
                className="input-field w-full h-9 appearance-none px-3 pr-9 text-[13px] cursor-pointer"
              >
                {audioDevices.length === 0 ? (
                  <option value="">Default system microphone</option>
                ) : (
                  audioDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Microphone ${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none text-[18px] leading-none">
                expand_more
              </span>
            </div>

            {/* Live Audio Input Level Tester */}
            <div className="bg-[var(--raised)] rounded-[var(--radius-control)] p-3 border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--muted)] flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      audioLevel > 5 ? "bg-[var(--positive)]" : "bg-[var(--control)]"
                    }`}
                  />
                  Input signal check
                </span>
                <span className="font-mono tabular-nums text-[var(--text)] font-medium">
                  {signalStatusLabel(audioLevel)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--ring-track)] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-75"
                  style={{ width: `${Math.max(4, audioLevel)}%` }}
                />
              </div>
            </div>

            {onChangeMicGain && (
              <div className="bg-[var(--raised)] rounded-[var(--radius-control)] p-3 border border-[var(--border)] space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <label htmlFor="mic-gain-slider" className="font-medium text-[var(--text)]">
                    Mic sensitivity boost
                  </label>
                  <span className="font-mono tabular-nums text-[var(--accent-ink)] font-medium">
                    {micGain <= 1.01
                      ? "Normal (1.0×)"
                      : `+${Math.round(20 * Math.log10(micGain))} dB (${micGain.toFixed(2)}×)`}
                  </span>
                </div>
                <input
                  id="mic-gain-slider"
                  type="range"
                  min={1}
                  max={3}
                  step={0.25}
                  value={micGain}
                  onChange={(e) => onChangeMicGain(Number(e.target.value))}
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
                <p className="text-[12px] text-[var(--muted)]">
                  Increase if your mic sits further away on your desk
                </p>
              </div>
            )}

            {onToggleNoiseSuppression && (
              <label className="flex items-start gap-2.5 bg-[var(--raised)] rounded-[var(--radius-control)] p-3 border border-[var(--border)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={noiseSuppression}
                  onChange={(e) => onToggleNoiseSuppression(e.target.checked)}
                  className="mt-0.5 accent-[var(--accent)] cursor-pointer"
                />
                <span className="space-y-0.5">
                  <span className="block text-[13px] font-medium text-[var(--text)]">
                    Background noise suppression
                  </span>
                  <span className="block text-[12px] text-[var(--muted)]">
                    Filters fan and room noise. Turn off in a quiet room if soft fillers are missed
                  </span>
                </span>
              </label>
            )}
          </div>

          {/* Privacy Guarantee Notice */}
          <div className="p-3 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)] text-[12px] text-[var(--muted)]">
            <strong className="text-[var(--text)] font-medium">Privacy notice:</strong>{" "}
            Camera tracking runs locally in your browser. Video frames never leave your device.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[var(--raised)]/60 border-t border-[var(--border)] flex items-center justify-between">
          {onRefreshDevices ? (
            <button
              type="button"
              onClick={onRefreshDevices}
              className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                refresh
              </span>
              <span>Rescan devices</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn-primary h-9 px-4 font-medium text-[13px] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
