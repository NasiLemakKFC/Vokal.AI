"use client";

import { useState, useEffect, useCallback } from "react";

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
  refreshDevices: () => Promise<void>;
  isPermissionGranted: boolean;
}

const STORAGE_KEY_MIC = "interviewai_selected_mic";
const STORAGE_KEY_CAM = "interviewai_selected_cam";

export function useMediaDevices(): UseMediaDevicesReturn {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceItem[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceItem[]>([]);
  const [selectedAudioId, setSelectedAudioIdState] = useState<string>("");
  const [selectedVideoId, setSelectedVideoIdState] = useState<string>("");
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);

  const refreshDevices = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

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
    refreshDevices,
    isPermissionGranted,
  };
}
