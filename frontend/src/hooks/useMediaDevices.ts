"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface MediaDeviceItem {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface UseMediaDevicesReturn {
  audioDevices: MediaDeviceItem[];
  videoDevices: MediaDeviceItem[];
  selectedAudioId: string;
  selectedVideoId: string;
  setSelectedAudioId: (id: string) => void;
  setSelectedVideoId: (id: string) => void;
  micGain: number;
  setMicGain: (gain: number) => void;
  noiseSuppression: boolean;
  setNoiseSuppression: (enabled: boolean) => void;
  refreshDevices: () => Promise<void>;
  isPermissionGranted: boolean;
}

const STORAGE_KEY_MIC = "vokalai_selected_mic";
const STORAGE_KEY_CAM = "vokalai_selected_cam";
const STORAGE_KEY_MIC_GAIN = "vokalai_mic_gain";
const STORAGE_KEY_NOISE_SUPPRESSION = "vokalai_noise_suppression";

function clampMicGain(value: number): number {
  return Math.min(3, Math.max(1, Math.round(value * 100) / 100));
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceItem[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceItem[]>([]);
  const [selectedAudioId, setSelectedAudioIdState] = useState<string>("");
  const [selectedVideoId, setSelectedVideoIdState] = useState<string>("");
  const [micGain, setMicGainState] = useState<number>(1.0);
  const [noiseSuppression, setNoiseSuppressionState] = useState<boolean>(true);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const hasHydratedPrefsRef = useRef(false);

  const refreshDevices = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      if (!hasHydratedPrefsRef.current && typeof localStorage !== "undefined") {
        hasHydratedPrefsRef.current = true;
        const savedGain = Number(localStorage.getItem(STORAGE_KEY_MIC_GAIN));
        if (Number.isFinite(savedGain) && savedGain >= 1 && savedGain <= 3) {
          setMicGainState(clampMicGain(savedGain));
        }
        const savedNs = localStorage.getItem(STORAGE_KEY_NOISE_SUPPRESSION);
        if (savedNs === "false") {
          setNoiseSuppressionState(false);
        } else if (savedNs === "true") {
          setNoiseSuppressionState(true);
        }
      }

      const audio: MediaDeviceItem[] = [];
      const video: MediaDeviceItem[] = [];

      let micCount = 1;
      let camCount = 1;

      for (const dev of devices) {
        if (dev.kind === "audioinput") {
          audio.push({
            deviceId: dev.deviceId,
            label: dev.label || `Microphone ${micCount++}`,
            groupId: dev.groupId,
          });
        } else if (dev.kind === "videoinput") {
          video.push({
            deviceId: dev.deviceId,
            label: dev.label || `Camera ${camCount++}`,
            groupId: dev.groupId,
          });
        }
      }

      setAudioDevices(audio);
      setVideoDevices(video);

      const hasNamedLabels = devices.some((d) => d.label && d.label.length > 0);
      if (hasNamedLabels) {
        setIsPermissionGranted(true);
      }

      // Initialize or validate selected audio device
      setSelectedAudioIdState((current) => {
        if (current && audio.some((d) => d.deviceId === current)) {
          return current;
        }
        const saved =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(STORAGE_KEY_MIC)
            : null;
        if (saved && audio.some((d) => d.deviceId === saved)) {
          return saved;
        }
        return audio[0]?.deviceId || "";
      });

      // Initialize or validate selected video device
      setSelectedVideoIdState((current) => {
        if (current && video.some((d) => d.deviceId === current)) {
          return current;
        }
        const saved =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(STORAGE_KEY_CAM)
            : null;
        if (saved && video.some((d) => d.deviceId === saved)) {
          return saved;
        }
        return video[0]?.deviceId || "";
      });
    } catch (err) {
      console.warn("[useMediaDevices] Failed to enumerate devices:", err);
    }
  }, []);

  const setSelectedAudioId = useCallback((id: string) => {
    setSelectedAudioIdState(id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MIC, id);
    }
  }, []);

  const setSelectedVideoId = useCallback((id: string) => {
    setSelectedVideoIdState(id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CAM, id);
    }
  }, []);

  const setMicGain = useCallback((gain: number) => {
    const clamped = clampMicGain(gain);
    setMicGainState(clamped);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MIC_GAIN, String(clamped));
    }
  }, []);

  const setNoiseSuppression = useCallback((enabled: boolean) => {
    setNoiseSuppressionState(enabled);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_NOISE_SUPPRESSION, String(enabled));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    let isSubscribed = true;

    navigator.mediaDevices
      .enumerateDevices()
      .then(() => {
        if (isSubscribed) {
          void refreshDevices();
        }
      })
      .catch((err) => {
        console.warn("[useMediaDevices] Initial device enumeration error:", err);
      });

    const handleDeviceChange = () => {
      void refreshDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      isSubscribed = false;
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  return {
    audioDevices,
    videoDevices,
    selectedAudioId,
    selectedVideoId,
    setSelectedAudioId,
    setSelectedVideoId,
    micGain,
    setMicGain,
    noiseSuppression,
    setNoiseSuppression,
    refreshDevices,
    isPermissionGranted,
  };
}
