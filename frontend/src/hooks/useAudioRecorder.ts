"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  // Chrome and Edge use webm. Safari uses mp4. The backend converts both with ffmpeg.
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
}

export interface AudioRecorderOptions {
  deviceId?: string;
  /** Software mic boost multiplier (1.0 = normal, up to 3.0). */
  micGain?: number;
  /** Browser background noise suppression (recommended ON when mic is at desk distance). */
  noiseSuppression?: boolean;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  /** Live microphone voice activity level (0–100) while recording; 0 when idle or muted. */
  audioLevel: number;
  /** Ask for the microphone and begin recording one answer. */
  start: () => Promise<void>;
  /** Stop and return the recorded audio (null if nothing was recording). */
  stop: () => Promise<Blob | null>;
  /** Stop and throw the recording away. */
  cancel: () => void;
  /** While muted, silence is recorded instead of the microphone. */
  setMuted: (muted: boolean) => void;
}

export function useAudioRecorder(options: AudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { deviceId, micGain = 1.0, noiseSuppression = true } = options;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mutedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const releaseStream = useCallback(() => {
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    setAudioLevel(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    if (muted) {
      setAudioLevel(0);
    }
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1,
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression,
      },
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !mutedRef.current;
    });

    let recordStream = stream;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const source = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = micGain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;

      source.connect(gainNode);
      gainNode.connect(analyser);

      if (micGain > 1.01) {
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 6;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.1;
        const destination = ctx.createMediaStreamDestination();

        gainNode.connect(limiter);
        limiter.connect(destination);
        recordStream = destination.stream;
      }

      audioContextRef.current = ctx;

      const timeData = new Uint8Array(analyser.fftSize);
      levelTimerRef.current = setInterval(() => {
        if (mutedRef.current) {
          setAudioLevel(0);
          return;
        }
        analyser.getByteTimeDomainData(timeData);
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const normalized = (timeData[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        // Scale typical speech RMS (~0.02–0.25) to 0–100
        const scaled = Math.min(100, Math.round(Math.pow(rms * 4.2, 0.75) * 100));
        setAudioLevel(scaled);
      }, 85);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();

      streamRef.current = stream;
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
      throw err;
    }
  }, [deviceId, micGain, noiseSuppression]);

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        releaseStream();
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, [releaseStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    setIsRecording(false);
  }, [releaseStream]);

  // Release the microphone if the page is closed in the middle of an answer.
  useEffect(() => cancel, [cancel]);

  return { isRecording, audioLevel, start, stop, cancel, setMuted };
}
