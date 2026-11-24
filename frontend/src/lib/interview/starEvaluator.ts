import {
  compactForPrompt,
  invokeLlmJson,
  resolveLlmProvider,
} from "./llmProvider";
import type { ExperienceLevel } from "./types";
import type { LlmStarEvaluation, StarKey, StarProportion } from "@/lib/nlp/types";

export interface EvaluateStarRequest {
  question: string;
  transcript: string;
  role: string;
  experienceLevel?: ExperienceLevel;
  jobDescription?: string;
  questionKeywords?: string[];
}

export interface EvaluateStarResponse {
  evaluated: boolean;
  evaluation: LlmStarEvaluation | null;
  reason?: string;
}

const STAR_KEYS: StarKey[] = ["situation", "task", "action", "result"];

const STAR_EVAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    pillarScores: {
      type: "object",
      properties: {
        situation: { type: "integer" },
        task: { type: "integer" },
        action: { type: "integer" },
        result: { type: "integer" },
      },
      required: ["situation", "task", "action", "result"],
      additionalProperties: false,
    },
    pillarFeedback: {
      type: "object",
      properties: {
        situation: { type: "string" },
        task: { type: "string" },
        action: { type: "string" },
        result: { type: "string" },
      },
      required: ["situation", "task", "action", "result"],
      additionalProperties: false,
    },
    relevanceScore: { type: "integer" },
    relevanceNote: { type: "string" },
    ownershipNote: { type: "string" },
    starProportion: {
      type: "object",
      properties: {
        situation: { type: "integer" },
        task: { type: "integer" },
        action: { type: "integer" },
        result: { type: "integer" },
      },
      required: ["situation", "task", "action", "result"],
      additionalProperties: false,
    },
    proportionFeedback: { type: "string" },
    strongerRewrite: {
      type: "object",
      properties: {
        targetPillar: {
          type: "string",
          enum: ["situation", "task", "action", "result"],
        },
        example: { type: "string" },
      },
      required: ["targetPillar", "example"],
      additionalProperties: false,
    },
    topCoaching: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "pillarScores",
    "pillarFeedback",
    "relevanceScore",
    "relevanceNote",
    "ownershipNote",
    "starProportion",
    "proportionFeedback",
    "strongerRewrite",
    "topCoaching",
  ],
  additionalProperties: false,
};

function clampScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const scaled = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeProportion(raw: unknown): StarProportion {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const vals = {
    situation: Math.max(0, Math.round(Number(rec.situation) || 0)),
    task: Math.max(0, Math.round(Number(rec.task) || 0)),
    action: Math.max(0, Math.round(Number(rec.action) || 0)),
    result: Math.max(0, Math.round(Number(rec.result) || 0)),
  };
  const sum = vals.situation + vals.task + vals.action + vals.result;
  if (sum <= 0) {
    return { situation: 25, task: 15, action: 45, result: 15 };
  }
  const s = Math.round((vals.situation / sum) * 100);
  const t = Math.round((vals.task / sum) * 100);
  const a = Math.round((vals.action / sum) * 100);
  const r = Math.max(0, 100 - s - t - a);
  return { situation: s, task: t, action: a, result: r };
}

function normalizeStarKey(value: unknown, scores: Record<StarKey, number>): StarKey {
  if (value === "situation" || value === "task" || value === "action" || value === "result") {
    return value;
  }
  return STAR_KEYS.reduce((min, key) => (scores[key] < scores[min] ? key : min), "result");
}

function cleanSentence(value: unknown, fallback: string, maxLen = 320): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length >= 6 ? cleaned.slice(0, maxLen) : fallback;
}

export async function evaluateStarWithLlm(
  input: EvaluateStarRequest
): Promise<EvaluateStarResponse> {
  const transcript = compactForPrompt(input.transcript, 3600);
  const wordCount = transcript ? transcript.split(/\s+/).length : 0;
  if (wordCount < 15) {
    return {
      evaluated: false,
      evaluation: null,
      reason: "Transcript is too short for semantic STAR grading.",
    };
  }

  const resolved = resolveLlmProvider();
  if (resolved.provider === "offline") {
    return {
      evaluated: false,
      evaluation: null,
      reason: resolved.reason || "Offline NLP mode active.",
    };
  }

  const question = compactForPrompt(input.question, 500);
  const role = input.role.trim() || "Software Engineer";
  const level = input.experienceLevel ?? "fresh_grad";
  const keywords = (input.questionKeywords ?? []).slice(0, 8).join(", ");
  const jdPreview = input.jobDescription
    ? compactForPrompt(input.jobDescription, 600)
    : "";

  const system = [
    "You are a senior hiring manager and interview coach evaluating a candidate's behavioral STAR answer.",
    "Return ONLY valid JSON matching this schema:",
    "{",
    '  "pillarScores": { "situation": 0-100, "task": 0-100, "action": 0-100, "result": 0-100 },',
    '  "pillarFeedback": { "situation": string, "task": string, "action": string, "result": string },',
    '  "relevanceScore": 0-100,',
    '  "relevanceNote": string,',
    '  "ownershipNote": string,',
    '  "starProportion": { "situation": int, "task": int, "action": int, "result": int },',
    '  "proportionFeedback": string,',
    '  "strongerRewrite": { "targetPillar": "situation"|"task"|"action"|"result", "example": string },',
    '  "topCoaching": string[]',
    "}",
    "Grading Rubric (be honest, fair, and never inflate weak answers):",
    "- Missing pillar: 0–25. Vague/generic 1-liner: 45–65. Clear specific details: 70–84. Crisp, personal 'I' ownership + technical depth / quantified impact: 85–96.",
    "- Bilingual/Malaysian English transcripts (with occasional Malay words) are valid; judge substance first and gently note English phrasing only if needed.",
    "- starProportion: estimate the % share of the candidate's answer spent on S, T, A, R (integers summing to 100). Ideal behavioral balance is roughly ~15% S, ~10% T, ~55% A, ~20% R.",
    "- ownershipNote: evaluate whether the candidate clearly stated what THEY personally did ('I') vs vague team credit ('we').",
    "- strongerRewrite: pick the weakest pillar and write a 2–3 sentence upgrade grounded STRICTLY in the candidate's own story. NEVER invent fake metrics, tools, or outcomes; use bracketed placeholders like [X% faster] or [N users] wherever the candidate didn't provide a number.",
    "- topCoaching: 2–3 specific, high-impact improvements tailored to THIS answer.",
  ].join("\n");

  const user = [
    `Target Role: ${role} (${level})`,
    keywords ? `Expected Concepts: ${keywords}` : null,
    jdPreview ? `<job_context>\n${jdPreview}\n</job_context>` : null,
    `<interview_question>\n${question}\n</interview_question>`,
    `<candidate_answer>\n${transcript}\n</candidate_answer>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const rawJson = await invokeLlmJson(resolved, {
      prompts: { system, user },
      temperature: 0.2,
      maxTokens: 1100,
      groqJsonSchema: {
        name: "star_answer_evaluation",
        schema: STAR_EVAL_JSON_SCHEMA,
      },
    });

    const parsed = JSON.parse(stripJsonFences(rawJson)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Evaluator returned non-object JSON.");
    }

    const rawScores =
      parsed.pillarScores && typeof parsed.pillarScores === "object"
        ? (parsed.pillarScores as Record<string, unknown>)
        : {};
    const pillarScores: Record<StarKey, number> = {
      situation: clampScore(rawScores.situation, 50),
      task: clampScore(rawScores.task, 50),
      action: clampScore(rawScores.action, 50),
      result: clampScore(rawScores.result, 50),
    };

    const rawFb =
      parsed.pillarFeedback && typeof parsed.pillarFeedback === "object"
        ? (parsed.pillarFeedback as Record<string, unknown>)
        : {};
    const pillarFeedback: Record<StarKey, string> = {
      situation: cleanSentence(rawFb.situation, "Clarify the context and project constraints."),
      task: cleanSentence(rawFb.task, "State your personal objective and accountability."),
      action: cleanSentence(rawFb.action, "Detail the specific engineering steps you personally took."),
      result: cleanSentence(rawFb.result, "Close with measurable impact or concrete outcomes."),
    };

    const rawRewrite =
      parsed.strongerRewrite && typeof parsed.strongerRewrite === "object"
        ? (parsed.strongerRewrite as Record<string, unknown>)
        : {};
    const targetPillar = normalizeStarKey(rawRewrite.targetPillar, pillarScores);
    const rewriteExample = cleanSentence(
      rawRewrite.example,
      pillarFeedback[targetPillar],
      520
    );

    const topCoaching = Array.isArray(parsed.topCoaching)
      ? parsed.topCoaching
          .filter((item): item is string => typeof item === "string" && item.trim().length > 5)
          .map((item) => item.trim().slice(0, 260))
          .slice(0, 3)
      : [];

    const evaluation: LlmStarEvaluation = {
      provider: resolved.provider,
      model: resolved.model,
      pillarScores,
      pillarFeedback,
      relevanceScore: clampScore(parsed.relevanceScore, 75),
      relevanceNote: cleanSentence(
        parsed.relevanceNote,
        "Your response addresses the prompt; tie your final point directly back to the question."
      ),
      ownershipNote: cleanSentence(
        parsed.ownershipNote,
        "Clarify which technical decisions and steps were your personal contribution."
      ),
      starProportion: normalizeProportion(parsed.starProportion),
      proportionFeedback: cleanSentence(
        parsed.proportionFeedback,
        "Aim for brief context (~25% S+T), detailed personal steps (~55% A), and clear impact (~20% R)."
      ),
      strongerRewrite: {
        targetPillar,
        example: rewriteExample,
      },
      topCoaching,
    };

    return { evaluated: true, evaluation };
  } catch (err) {
    return {
      evaluated: false,
      evaluation: null,
      reason: err instanceof Error ? err.message : "Semantic STAR evaluation failed.",
    };
  }
}
