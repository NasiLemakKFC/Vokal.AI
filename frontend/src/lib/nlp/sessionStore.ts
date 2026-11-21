import type { SpeechUi } from "@/lib/speechApi";
import type { ResumeTailorReport } from "@/lib/interview/types";
import type { AnswerAnalysis, StarKey } from "./types";

export interface VisionSnapshot {
  eyeContactScore: number;
  postureScore: number;
  eyeNudges: number;
  postureNudges: number;
  totalFrames: number;
}

export interface SavedAnswer {
  question: string;
  transcript: string;
  analysis: AnswerAnalysis;
  speech?: SpeechUi | null;
  vision?: VisionSnapshot | null;
  durationSec?: number;
}

export interface SavedSession {
  id: string;
  completedAt: string;
  mode: "company" | "role" | "general";
  company: string;
  role: string;
  jobDescription: string;
  tailorReport?: ResumeTailorReport | null;
  answers: SavedAnswer[];
  overallScore?: number;
  starScore?: number;
  deliveryScore?: number | null;
  presenceScore?: number | null;
}

export interface AnswerMetrics {
  starPillarScores: Record<StarKey, number>;
  starScore: number;
  deliveryScore: number | null;
  presenceScore: number | null;
  overallScore: number;
}

export interface SessionMetrics {
  overallScore: number;
  starScore: number;
  deliveryScore: number | null;
  presenceScore: number | null;
  avgStarCount: number;
  avgWpm: number | null;
  totalFillers: number;
  avgEyeContact: number | null;
  avgPosture: number | null;
}

export const STORAGE_KEY = "vokal-module3-completed-sessions-v1";
export const SESSIONS_UPDATED_EVENT = "vokal-sessions-updated";
export const EMPTY_SESSIONS: SavedSession[] = [];

const METRIC_RESULT_REGEX =
  /\b\d+(?:\.\d+)?\s*(?:%|percent|peratus|ms|seconds?|saat|minutes?|minit|hours?|jam|days?|hari|users?|pengguna|customers?|pelanggan|requests?)\b/i;

const STAR_KEYS: StarKey[] = ["situation", "task", "action", "result"];

function parseSessions(raw: string | null): SavedSession[] {
  if (!raw) return EMPTY_SESSIONS;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter(
          (s): s is SavedSession =>
            Boolean(s && typeof s === "object" && "answers" in s && Array.isArray(s.answers))
        )
      : EMPTY_SESSIONS;
  } catch {
    return EMPTY_SESSIONS;
  }
}

let cachedRaw: string | null = null;
let cachedSessions: SavedSession[] = EMPTY_SESSIONS;

/**
 * Snapshot reader compatible with React's `useSyncExternalStore`.
 * Returns a referentially stable array unless the underlying localStorage value changed.
 */
export function getSessionsSnapshot(): SavedSession[] {
  if (typeof window === "undefined") return EMPTY_SESSIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedSessions;
    cachedRaw = raw;
    cachedSessions = parseSessions(raw);
    return cachedSessions;
  } catch {
    return EMPTY_SESSIONS;
  }
}

export function subscribeSessions(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) listener();
  };
  const onUpdated = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSIONS_UPDATED_EVENT, onUpdated);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSIONS_UPDATED_EVENT, onUpdated);
  };
}

export function getSessions(): SavedSession[] {
  if (typeof window === "undefined") return EMPTY_SESSIONS;
  return parseSessions(localStorage.getItem(STORAGE_KEY));
}

export function saveSession(session: SavedSession): void {
  const sessions = getSessions();
  const serialized = JSON.stringify([session, ...sessions].slice(0, 30));
  localStorage.setItem(STORAGE_KEY, serialized);
  cachedRaw = serialized;
  cachedSessions = parseSessions(serialized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSIONS_UPDATED_EVENT));
  }
}

export function starCount(a: AnswerAnalysis): number {
  return Object.values(a.star).filter((s) => s.found).length;
}

export function computeAnswerMetrics(answer: SavedAnswer): AnswerMetrics {
  const wordCount = answer.transcript.trim() ? answer.transcript.trim().split(/\s+/).length : 0;
  const hasMetricInResult = METRIC_RESULT_REGEX.test(answer.transcript);

  const starPillarScores = Object.fromEntries(
    STAR_KEYS.map((key) => {
      const section = answer.analysis.star[key];
      if (!section.found) {
        return [key, wordCount >= 20 ? 20 : 0];
      }
      if (key === "result") {
        return [key, hasMetricInResult ? 96 : 80];
      }
      return [key, section.sentences.length >= 2 ? 94 : 86];
    })
  ) as Record<StarKey, number>;

  const starScore = Math.round(
    (starPillarScores.situation +
      starPillarScores.task +
      starPillarScores.action +
      starPillarScores.result) /
      4
  );

  const deliveryScore = answer.speech ? Math.round(answer.speech.fluencyScore) : null;
  const presenceScore = answer.vision
    ? Math.round(
        Math.max(
          0,
          Math.min(
            100,
            (answer.vision.eyeContactScore + answer.vision.postureScore) / 2 -
              answer.vision.postureNudges * 3
          )
        )
      )
    : null;

  let weightedSum = starScore * 0.5;
  let weightTotal = 0.5;
  if (deliveryScore !== null) {
    weightedSum += deliveryScore * 0.25;
    weightTotal += 0.25;
  }
  if (presenceScore !== null) {
    weightedSum += presenceScore * 0.25;
    weightTotal += 0.25;
  }

  const overallScore = Math.round(weightedSum / weightTotal);

  return {
    starPillarScores,
    starScore,
    deliveryScore,
    presenceScore,
    overallScore,
  };
}

export function computeSessionMetrics(answers: SavedAnswer[]): SessionMetrics {
  if (answers.length === 0) {
    return {
      overallScore: 0,
      starScore: 0,
      deliveryScore: null,
      presenceScore: null,
      avgStarCount: 0,
      avgWpm: null,
      totalFillers: 0,
      avgEyeContact: null,
      avgPosture: null,
    };
  }

  const perAnswer = answers.map(computeAnswerMetrics);
  const overallScore = Math.round(
    perAnswer.reduce((acc, m) => acc + m.overallScore, 0) / perAnswer.length
  );
  const starScore = Math.round(
    perAnswer.reduce((acc, m) => acc + m.starScore, 0) / perAnswer.length
  );

  const deliveryScores = perAnswer
    .map((m) => m.deliveryScore)
    .filter((v): v is number => v !== null);
  const deliveryScore =
    deliveryScores.length > 0
      ? Math.round(deliveryScores.reduce((a, b) => a + b, 0) / deliveryScores.length)
      : null;

  const presenceScores = perAnswer
    .map((m) => m.presenceScore)
    .filter((v): v is number => v !== null);
  const presenceScore =
    presenceScores.length > 0
      ? Math.round(presenceScores.reduce((a, b) => a + b, 0) / presenceScores.length)
      : null;

  const avgStarCount =
    Math.round(
      (answers.reduce((acc, a) => acc + starCount(a.analysis), 0) / answers.length) * 10
    ) / 10;

  const speechAnswers = answers.map((a) => a.speech).filter((s): s is SpeechUi => Boolean(s));
  const avgWpm =
    speechAnswers.length > 0
      ? Math.round(speechAnswers.reduce((acc, s) => acc + s.wpm, 0) / speechAnswers.length)
      : null;
  const totalFillers = speechAnswers.reduce((acc, s) => acc + s.fillerCount, 0);

  const visionAnswers = answers
    .map((a) => a.vision)
    .filter((v): v is VisionSnapshot => Boolean(v));
  const avgEyeContact =
    visionAnswers.length > 0
      ? Math.round(
          visionAnswers.reduce((acc, v) => acc + v.eyeContactScore, 0) / visionAnswers.length
        )
      : null;
  const avgPosture =
    visionAnswers.length > 0
      ? Math.round(
          visionAnswers.reduce((acc, v) => acc + v.postureScore, 0) / visionAnswers.length
        )
      : null;

  return {
    overallScore,
    starScore,
    deliveryScore,
    presenceScore,
    avgStarCount,
    avgWpm,
    totalFillers,
    avgEyeContact,
    avgPosture,
  };
}
