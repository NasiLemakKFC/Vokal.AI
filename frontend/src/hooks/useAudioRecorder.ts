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
  const chunksRef = useRef<Blob[]>([]);
  const mutedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
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
      if (micGain > 1.01) {
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
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 6;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.1;
        const destination = ctx.createMediaStreamDestination();

        source.connect(gainNode);
        gainNode.connect(limiter);
        limiter.connect(destination);

        audioContextRef.current = ctx;
        recordStream = destination.stream;
      }

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

  return { isRecording, start, stop, cancel, setMuted };
}
