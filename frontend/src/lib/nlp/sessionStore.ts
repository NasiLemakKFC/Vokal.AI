import type { AnswerAnalysis } from "./types";
export interface SavedAnswer { question: string; transcript: string; analysis: AnswerAnalysis; }
export interface SavedSession { id: string; completedAt: string; mode: "company" | "role" | "general"; company: string; role: string; jobDescription: string; answers: SavedAnswer[]; }
export const STORAGE_KEY = "vokal-module3-completed-sessions-v1";
export function getSessions(): SavedSession[] {
  if (typeof window === "undefined") return [];
  try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value.filter((s): s is SavedSession => Boolean(s && typeof s === "object" && "answers" in s && Array.isArray(s.answers))) : []; } catch { return []; }
}
export function saveSession(session: SavedSession): void {
  const sessions = getSessions();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...sessions].slice(0, 30)));
}
export function starCount(a: AnswerAnalysis): number { return Object.values(a.star).filter(s => s.found).length; }
