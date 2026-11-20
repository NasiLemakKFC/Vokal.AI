"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  // Chrome and Edge use webm. Safari uses mp4. The backend converts both with ffmpeg.
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
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

export function useAudioRecorder(deviceId?: string): UseAudioRecorderReturn {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mutedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
        // Browser noise suppression may hide soft "um" / "uh". Not tested yet: compare both settings.
        noiseSuppression: false,
      },
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !mutedRef.current;
    });

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();

    streamRef.current = stream;
    recorderRef.current = recorder;
    setIsRecording(true);
  }, [deviceId]);

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
