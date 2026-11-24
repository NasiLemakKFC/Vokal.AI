"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  analyzeSpeech,
  type SpeechAnalysisResponse,
  type SpeechLanguageMode,
} from "@/lib/speechApi";

export type BackgroundTranscriptionStatus =
  | "idle"
  | "queued"
  | "transcribing"
  | "done"
  | "error";

interface QueueJob {
  questionIndex: number;
  audioBlob: Blob;
  audioVersion: number;
  language: SpeechLanguageMode;
  resolve: (result: SpeechAnalysisResponse | null) => void;
}

export interface UseBackgroundTranscriptionOptions {
  onStatusChange: (
    questionIndex: number,
    audioVersion: number,
    status: BackgroundTranscriptionStatus,
    result?: SpeechAnalysisResponse,
    errorMessage?: string
  ) => void;
}

/**
 * Serial background transcription worker for Module 2 & 5.
 * Because the local Whisper backend processes one clip at a time under `_analysis_lock`,
 * transcribing Q1 while the candidate answers Q2–Q7 eliminates the long post-session wait.
 */
export function useBackgroundTranscription({
  onStatusChange,
}: UseBackgroundTranscriptionOptions) {
  const callbackRef = useRef(onStatusChange);
  useEffect(() => {
    callbackRef.current = onStatusChange;
  }, [onStatusChange]);

  const queueRef = useRef<QueueJob[]>([]);
  const activeJobRef = useRef<{
    questionIndex: number;
    audioVersion: number;
    controller: AbortController;
    promise: Promise<SpeechAnalysisResponse | null>;
  } | null>(null);
  const pendingPromisesRef = useRef<Map<string, Promise<SpeechAnalysisResponse | null>>>(
    new Map()
  );

  const jobKey = (qIdx: number, version: number) => `${qIdx}:${version}`;

  const pump = useCallback(() => {
    if (activeJobRef.current || queueRef.current.length === 0) return;

    const job = queueRef.current.shift()!;
    const controller = new AbortController();
    const key = jobKey(job.questionIndex, job.audioVersion);

    callbackRef.current(job.questionIndex, job.audioVersion, "transcribing");

    const promise = (async (): Promise<SpeechAnalysisResponse | null> => {
      try {
        const result = await analyzeSpeech(
          job.audioBlob,
          job.language,
          controller.signal
        );
        if (!controller.signal.aborted) {
          callbackRef.current(job.questionIndex, job.audioVersion, "done", result);
        }
        job.resolve(controller.signal.aborted ? null : result);
        return controller.signal.aborted ? null : result;
      } catch (err) {
        if (!controller.signal.aborted) {
          const msg =
            err instanceof Error ? err.message : "Background speech transcription failed.";
          callbackRef.current(
            job.questionIndex,
            job.audioVersion,
            "error",
            undefined,
            msg
          );
        }
        job.resolve(null);
        return null;
      } finally {
        if (activeJobRef.current?.controller === controller) {
          activeJobRef.current = null;
        }
        pendingPromisesRef.current.delete(key);
        // Kick off next queued answer
        queueMicrotask(() => {
          pump();
        });
      }
    })();

    activeJobRef.current = {
      questionIndex: job.questionIndex,
      audioVersion: job.audioVersion,
      controller,
      promise,
    };
  }, []);

  const enqueue = useCallback(
    (
      questionIndex: number,
      audioBlob: Blob,
      audioVersion: number,
      language: SpeechLanguageMode
    ) => {
      if (!audioBlob || audioBlob.size === 0) return;

      // Cancel any stale queued jobs for this same question (candidate re-recorded)
      queueRef.current = queueRef.current.filter((item) => {
        if (item.questionIndex === questionIndex) {
          pendingPromisesRef.current.delete(jobKey(item.questionIndex, item.audioVersion));
          item.resolve(null);
          return false;
        }
        return true;
      });

      // If this exact question is actively transcribing an older take, abort it
      if (activeJobRef.current?.questionIndex === questionIndex) {
        activeJobRef.current.controller.abort();
      }

      const key = jobKey(questionIndex, audioVersion);
      let resolveJob!: (result: SpeechAnalysisResponse | null) => void;
      const promise = new Promise<SpeechAnalysisResponse | null>((resolve) => {
        resolveJob = resolve;
      });
      pendingPromisesRef.current.set(key, promise);

      queueRef.current.push({
        questionIndex,
        audioBlob,
        audioVersion,
        language,
        resolve: resolveJob,
      });

      callbackRef.current(questionIndex, audioVersion, "queued");
      pump();
    },
    [pump]
  );

  const waitForQuestion = useCallback(
    async (
      questionIndex: number,
      audioVersion: number
    ): Promise<SpeechAnalysisResponse | null> => {
      const key = jobKey(questionIndex, audioVersion);
      const pending = pendingPromisesRef.current.get(key);
      if (pending) {
        return pending;
      }
      if (
        activeJobRef.current &&
        activeJobRef.current.questionIndex === questionIndex &&
        activeJobRef.current.audioVersion === audioVersion
      ) {
        return activeJobRef.current.promise;
      }
      return null;
    },
    []
  );

  const cancelAll = useCallback(() => {
    for (const job of queueRef.current) {
      pendingPromisesRef.current.delete(jobKey(job.questionIndex, job.audioVersion));
      job.resolve(null);
    }
    queueRef.current = [];
    if (activeJobRef.current) {
      activeJobRef.current.controller.abort();
      activeJobRef.current = null;
    }
    pendingPromisesRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return {
    enqueue,
    waitForQuestion,
    cancelAll,
  };
}
