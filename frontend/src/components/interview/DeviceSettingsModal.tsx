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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-modal-title"
        className="w-full max-w-lg bg-white text-[#131416] rounded-[8px] border border-[#e8eaec] overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#e8eaec] flex items-center justify-between bg-white">
          <div>
            <h2 id="device-modal-title" className="text-[15px] font-semibold text-[#131416]">
              Audio &amp; Video Hardware Setup
            </h2>
            <p className="text-[12px] text-[#5d5f60]">
              Select input devices for client-side vision and Whisper ASR
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#5d5f60] hover:text-[#131416] hover:bg-[#f4f6f8] transition-colors cursor-pointer"
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
                className="text-[13px] font-medium text-[#131416]"
              >
                Webcam Input
              </label>
              <span className="text-[12px] text-[#5d5f60] tabular-nums">
                {videoDevices.length} available
              </span>
            </div>

            <div className="relative">
              <select
                id="webcam-select"
                value={selectedVideoId}
                onChange={(e) => onSelectVideo(e.target.value)}
                className="w-full h-[38px] appearance-none bg-white border border-[#cdced1] focus:border-[#1b6c80] text-[#131416] rounded-[6px] px-3 pr-9 text-[13px] transition-colors outline-none cursor-pointer"
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
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5d5f60] pointer-events-none text-[18px] leading-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Microphone Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="mic-select"
                className="text-[13px] font-medium text-[#131416]"
              >
                Microphone Input
              </label>
              <span className="text-[12px] text-[#5d5f60] tabular-nums">
                {audioDevices.length} available
              </span>
            </div>

            <div className="relative">
              <select
                id="mic-select"
                value={selectedAudioId}
                onChange={(e) => onSelectAudio(e.target.value)}
                className="w-full h-[38px] appearance-none bg-white border border-[#cdced1] focus:border-[#1b6c80] text-[#131416] rounded-[6px] px-3 pr-9 text-[13px] transition-colors outline-none cursor-pointer"
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
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5d5f60] pointer-events-none text-[18px] leading-none">
                expand_more
              </span>
            </div>

            {/* Live Audio Input Level Tester */}
            <div className="bg-[#f9fbfc] rounded-[6px] p-3 border border-[#e8eaec] mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#5d5f60] flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      audioLevel > 5 ? "bg-[#1e7b4f]" : "bg-[#cdced1]"
                    }`}
                  />
                  Input Signal Check
                </span>
                <span className="tabular-nums text-[#131416] font-medium">
                  {signalStatusLabel(audioLevel)}
                </span>
              </div>
              <div className="h-2 w-full bg-[#e8eaec] rounded-[2px] overflow-hidden flex">
                <div
                  className="h-full bg-[#1b6c80]"
                  style={{ width: `${Math.max(4, audioLevel)}%` }}
                />
              </div>
            </div>

            {onChangeMicGain && (
              <div className="bg-[#f9fbfc] rounded-[6px] p-3 border border-[#e8eaec] space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <label htmlFor="mic-gain-slider" className="font-medium text-[#131416]">
                    Mic Sensitivity Boost
                  </label>
                  <span className="tabular-nums text-[#1b6c80] font-medium">
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
                  className="w-full accent-[#1b6c80] cursor-pointer"
                />
                <p className="text-[11px] text-[#5d5f60]">
                  Increase if your mic sits further away on your desk.
                </p>
              </div>
            )}

            {onToggleNoiseSuppression && (
              <label className="flex items-start gap-2.5 bg-[#f9fbfc] rounded-[6px] p-3 border border-[#e8eaec] cursor-pointer">
                <input
                  type="checkbox"
                  checked={noiseSuppression}
                  onChange={(e) => onToggleNoiseSuppression(e.target.checked)}
                  className="mt-0.5 accent-[#1b6c80] cursor-pointer"
                />
                <span className="space-y-0.5">
                  <span className="block text-[12px] font-medium text-[#131416]">
                    Background Noise Suppression
                  </span>
                  <span className="block text-[11px] text-[#5d5f60]">
                    Filters fan &amp; room noise when sitting back. Turn off in a quiet room if soft fillers are missed.
                  </span>
                </span>
              </label>
            )}
          </div>

          {/* Privacy Guarantee Notice */}
          <div className="p-3 rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec] text-[12px] text-[#5d5f60]">
            <strong className="text-[#131416] font-medium">Client-Side Vision Guarantee:</strong>{" "}
            MediaPipe FaceLandmarker runs in WebAssembly on your browser GPU. Video frames never leave your machine.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#f9fbfc] border-t border-[#e8eaec] flex items-center justify-between">
          {onRefreshDevices ? (
            <button
              type="button"
              onClick={onRefreshDevices}
              className="flex items-center gap-1.5 text-[12px] text-[#5d5f60] hover:text-[#131416] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] leading-none">
                refresh
              </span>
              <span>Rescan Hardware</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-[32px] px-4 rounded-[6px] bg-[#131416] text-white font-medium text-[12px] hover:bg-[#25272a] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
