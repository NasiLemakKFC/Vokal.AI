import { generateInterviewPreparation } from "@/lib/interview/llmProvider";
import type { InterviewTargetMode, PrepareInterviewRequest } from "@/lib/interview/types";

const MAX_JD_INPUT = 15_000;
const MAX_RESUME_INPUT = 25_000;

function sanitizeMode(value: unknown): InterviewTargetMode {
  if (value === "company" || value === "role" || value === "general") {
    return value;
  }
  return "role";
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
    return Response.json({ detail: "Invalid JSON request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ detail: "Request body must be a JSON object." }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const rawCount =
    typeof rec.questionCount === "number" && Number.isFinite(rec.questionCount)
      ? Math.round(rec.questionCount)
      : 3;
  const rawVariation =
    typeof rec.variation === "number" && Number.isFinite(rec.variation)
      ? Math.max(0, Math.floor(rec.variation))
      : 0;

  const payload: PrepareInterviewRequest = {
    mode: sanitizeMode(rec.mode),
    company: sanitizeText(rec.company, 120),
    role: sanitizeText(rec.role, 100) || "Software Engineer",
    jobDescription: sanitizeText(rec.jobDescription, MAX_JD_INPUT),
    resumeText: sanitizeText(rec.resumeText, MAX_RESUME_INPUT),
    questionCount: Math.max(3, Math.min(5, rawCount)),
    variation: rawVariation,
  };

  const result = await generateInterviewPreparation(payload);
  return Response.json(result, { status: 200 });
}
