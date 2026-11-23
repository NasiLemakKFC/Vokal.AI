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

export const SESSIONS_UPDATED_EVENT = "vokal-sessions-updated";
export const EMPTY_SESSIONS: SavedSession[] = [];

const METRIC_RESULT_REGEX =
  /\b\d+(?:\.\d+)?\s*(?:%|percent|peratus|ms|seconds?|saat|minutes?|minit|hours?|jam|days?|hari|users?|pengguna|customers?|pelanggan|requests?)\b/i;

const STAR_KEYS: StarKey[] = ["situation", "task", "action", "result"];

function notifySessionsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSIONS_UPDATED_EVENT));
  }
}

export async function fetchSessions(): Promise<SavedSession[]> {
  const res = await fetch("/api/sessions", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) {
    return EMPTY_SESSIONS;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to load sessions (${res.status}).`);
  }
  const data = (await res.json()) as { sessions?: SavedSession[] };
  return Array.isArray(data.sessions) ? data.sessions : EMPTY_SESSIONS;
}

export async function createSession(session: SavedSession): Promise<SavedSession> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to save session (${res.status}).`);
  }
  const data = (await res.json()) as { session: SavedSession };
  notifySessionsUpdated();
  return data.session;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to delete session (${res.status}).`);
  }
  notifySessionsUpdated();
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
