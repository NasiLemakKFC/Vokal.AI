import type { ObjectId } from "mongodb";
import type { ResumeTailorReport } from "@/lib/interview/types";
import type { SavedAnswer, SavedSession } from "@/lib/nlp/sessionStore";

export interface PracticeSessionDoc {
  _id?: ObjectId;
  id: string;
  userId: ObjectId;
  completedAt: Date;
  createdAt: Date;
  mode: "company" | "role" | "general";
  company: string;
  role: string;
  jobDescription: string;
  tailorReport?: ResumeTailorReport | null;
  answers: SavedAnswer[];
  overallScore: number;
  starScore: number;
  deliveryScore: number | null;
  presenceScore: number | null;
}

export function serializeSession(doc: PracticeSessionDoc): SavedSession {
  return {
    id: doc.id,
    completedAt:
      doc.completedAt instanceof Date
        ? doc.completedAt.toISOString()
        : String(doc.completedAt),
    mode: doc.mode,
    company: doc.company,
    role: doc.role,
    jobDescription: doc.jobDescription,
    tailorReport: doc.tailorReport ?? null,
    answers: doc.answers,
    overallScore: doc.overallScore,
    starScore: doc.starScore,
    deliveryScore: doc.deliveryScore ?? null,
    presenceScore: doc.presenceScore ?? null,
  };
}
