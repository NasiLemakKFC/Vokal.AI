import { evaluateStarWithLlm } from "@/lib/interview/starEvaluator";
import type { ExperienceLevel } from "@/lib/interview/types";

function sanitizeLevel(value: unknown): ExperienceLevel {
  if (value === "internship" || value === "fresh_grad" || value === "junior") {
    return value;
  }
  return "fresh_grad";
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLen);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ evaluated: false, evaluation: null, reason: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ evaluated: false, evaluation: null, reason: "Invalid payload." }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const question = sanitizeText(rec.question, 800);
  const transcript = sanitizeText(rec.transcript, 10_000);
  const role = sanitizeText(rec.role, 100) || "Software Engineer";
  const jobDescription = sanitizeText(rec.jobDescription, 2000);
  const questionKeywords = Array.isArray(rec.questionKeywords)
    ? rec.questionKeywords
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim().slice(0, 60))
        .slice(0, 10)
    : [];

  if (!question || !transcript) {
    return Response.json(
      { evaluated: false, evaluation: null, reason: "Question and transcript are required." },
      { status: 400 }
    );
  }

  const result = await evaluateStarWithLlm({
    question,
    transcript,
    role,
    experienceLevel: sanitizeLevel(rec.experienceLevel),
    jobDescription,
    questionKeywords,
  });

  return Response.json(result, { status: 200 });
}
