import { matchesSkillTerm } from "@/lib/nlp/keywords";
import { includesKeyword, normalizeText } from "@/lib/nlp/text";
import { buildOfflinePreparation } from "./offlineGenerator";
import type {
  AiProviderUsed,
  InterviewQuestion,
  InterviewQuestionType,
  PrepareInterviewRequest,
  PrepareInterviewResponse,
  ResumeTailorReport,
} from "./types";

const MAX_JD_CHARS = 2400;
const MAX_RESUME_CHARS = 3000;

const INTERVIEW_PREP_JSON_SCHEMA = {
  type: "object",
  properties: {
    tailorReport: {
      type: "object",
      properties: {
        matchScore: { anyOf: [{ type: "integer" }, { type: "null" }] },
        verdict: {
          type: "string",
          enum: ["Strong Fit", "Moderate Fit", "Needs Tailoring", "Role Prep"],
        },
        summary: { type: "string" },
        matchedSkills: { type: "array", items: { type: "string" } },
        missingSkills: { type: "array", items: { type: "string" } },
        tailoringTips: { type: "array", items: { type: "string" } },
      },
      required: [
        "matchScore",
        "verdict",
        "summary",
        "matchedSkills",
        "missingSkills",
        "tailoringTips",
      ],
      additionalProperties: false,
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["resume_deep_dive", "jd_gap", "role_behavioral"],
          },
          prompt: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: ["type", "prompt", "keywords", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["tailorReport", "questions"],
  additionalProperties: false,
};

const SKILL_ALIASES: Record<string, string[]> = {
  "rest api": ["rest", "restful", "api", "apis", "api endpoints", "endpoints"],
  "rest apis": ["rest api", "rest", "restful", "api", "apis", "api endpoints", "endpoints"],
  "ci/cd": [
    "ci cd",
    "cicd",
    "github actions",
    "gitlab ci",
    "jenkins",
    "continuous integration",
    "continuous deployment",
  ],
  docker: ["docker", "dockerfile", "docker compose", "container", "containers", "containerize"],
  kubernetes: ["kubernetes", "k8s"],
  postgresql: ["postgresql", "postgres"],
  mongodb: ["mongodb", "mongo"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  "node.js": ["node.js", "nodejs", "node"],
  "next.js": ["next.js", "nextjs"],
  react: ["react", "reactjs", "react.js"],
  "unit testing": ["unit testing", "unit tests", "unit test", "jest", "pytest", "vitest"],
  "automated testing": [
    "automated testing",
    "unit testing",
    "integration testing",
    "test suite",
    "jest",
    "pytest",
    "vitest",
    "cypress",
    "playwright",
  ],
  redis: ["redis"],
  "redis caching": ["redis", "redis caching"],
  agile: ["agile", "scrum", "sprint", "kanban"],
  microservices: ["microservices", "microservice"],
  "structured logging": ["structured logging", "logging", "server logs"],
  "monitoring dashboards": [
    "monitoring dashboards",
    "monitoring",
    "grafana",
    "prometheus",
    "datadog",
  ],
};

function isSkillGroundedInText(text: string, skill: string): boolean {
  if (!text.trim() || !skill.trim()) return false;
  if (includesKeyword(text, skill)) return true;
  const lower = skill.trim().toLowerCase();
  if (matchesSkillTerm(text, lower)) return true;
  if ((SKILL_ALIASES[lower] ?? []).some((alias) => includesKeyword(text, alias))) {
    return true;
  }
  const core = lower.replace(
    /\s+(?:development|workflows?|queries|databases?|services?|engineering|skills?)$/i,
    ""
  ).trim();
  if (core && core !== lower && core.length >= 2) {
    if (
      includesKeyword(text, core) ||
      matchesSkillTerm(text, core) ||
      (SKILL_ALIASES[core] ?? []).some((alias) => includesKeyword(text, alias))
    ) {
      return true;
    }
  }
  return false;
}

function dedupeSubsumedSkills(skills: string[]): string[] {
  const tokenized = skills.map((s) => {
    const norm = normalizeText(s);
    return {
      raw: s,
      norm,
      words: norm.split(" ").filter(Boolean),
    };
  });
  return tokenized
    .filter((item, idx) => {
      if (!item.norm || item.words.length === 0) return false;
      return !tokenized.some((other, oIdx) => {
        if (oIdx === idx || other.words.length <= item.words.length) return false;
        return ` ${other.norm} `.includes(` ${item.norm} `);
      });
    })
    .map((item) => item.raw);
}

function verdictFromScore(
  score: number
): "Strong Fit" | "Moderate Fit" | "Needs Tailoring" {
  if (score >= 75) return "Strong Fit";
  if (score >= 45) return "Moderate Fit";
  return "Needs Tailoring";
}

export function compactForPrompt(text: string, maxChars: number): string {
  const cleaned = text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 3).trimEnd()}...`;
}

function hasRealKey(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !/^your_.*_here$/i.test(trimmed) && !trimmed.includes("<");
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeQuestionType(
  value: unknown,
  fallback: InterviewQuestionType
): InterviewQuestionType {
  if (value === "resume_deep_dive" || value === "jd_gap" || value === "role_behavioral") {
    return value;
  }
  return fallback;
}

export function normalizeAiPayload(
  rawJson: string,
  input: PrepareInterviewRequest
): Omit<PrepareInterviewResponse, "provider" | "model" | "fallbackReason"> {
  const baseline = buildOfflinePreparation(input);
  const parsed = JSON.parse(stripJsonFences(rawJson)) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was not a JSON object.");
  }

  const hasResume = input.resumeText.trim().length > 0;
  const hasJobDescription =
    input.mode !== "general" && input.jobDescription.trim().length > 0;

  const rawReport =
    parsed.tailorReport && typeof parsed.tailorReport === "object"
      ? (parsed.tailorReport as Record<string, unknown>)
      : {};

  const rawMatched = hasResume ? normalizeStringArray(rawReport.matchedSkills, 12) : [];
  const rawMissing = normalizeStringArray(rawReport.missingSkills, 10);
  const tailoringTips = normalizeStringArray(rawReport.tailoringTips, 4);

  const verifiedMatched: string[] = [];
  const demotedHallucinations: string[] = [];
  if (hasResume) {
    for (const skill of rawMatched) {
      if (isSkillGroundedInText(input.resumeText, skill)) {
        verifiedMatched.push(skill);
      } else {
        demotedHallucinations.push(skill);
      }
    }
  }

  const verifiedNorms = new Set(verifiedMatched.map((s) => normalizeText(s)));
  const candidateMissingRaw = [
    ...rawMissing.filter((skill) => {
      if (verifiedNorms.has(normalizeText(skill))) return false;
      if (hasResume && isSkillGroundedInText(input.resumeText, skill)) return false;
      return true;
    }),
    ...demotedHallucinations.filter(
      (skill) => !hasJobDescription || isSkillGroundedInText(input.jobDescription, skill)
    ),
  ];

  const finalMatched = dedupeSubsumedSkills(
    verifiedMatched.length > 0 || !hasResume
      ? verifiedMatched
      : baseline.tailorReport.matchedSkills
  );
  const finalMatchedNorms = new Set(finalMatched.map((s) => normalizeText(s)));
  const finalMissing = dedupeSubsumedSkills(
    normalizeStringArray(
      candidateMissingRaw.filter((s) => !finalMatchedNorms.has(normalizeText(s))),
      10
    )
  );

  let rawScore: number | null = null;
  if (
    hasResume &&
    typeof rawReport.matchScore === "number" &&
    Number.isFinite(rawReport.matchScore)
  ) {
    const scaled =
      rawReport.matchScore > 0 && rawReport.matchScore <= 1
        ? rawReport.matchScore * 100
        : rawReport.matchScore;
    rawScore = Math.max(0, Math.min(100, Math.round(scaled)));
  }

  const totalVerified = finalMatched.length + finalMissing.length;
  const ratioScore =
    hasResume && totalVerified > 0
      ? Math.round((finalMatched.length / totalVerified) * 100)
      : baseline.tailorReport.matchScore;

  let matchScore: number | null = null;
  if (!hasResume) {
    matchScore = null;
  } else if (
    demotedHallucinations.length > 0 ||
    rawScore === null ||
    (totalVerified >= 4 &&
      ratioScore !== null &&
      Math.abs(rawScore - ratioScore) > 25)
  ) {
    matchScore = ratioScore;
  } else {
    matchScore = rawScore;
  }

  const verdict: ResumeTailorReport["verdict"] =
    !hasResume || matchScore === null ? "Role Prep" : verdictFromScore(matchScore);

  let summary =
    typeof rawReport.summary === "string" && rawReport.summary.trim().length > 10
      ? rawReport.summary.trim()
      : baseline.tailorReport.summary;

  if (
    hasResume &&
    demotedHallucinations.length > 0 &&
    demotedHallucinations.some((skill) => includesKeyword(summary, skill))
  ) {
    const matchedPreview =
      finalMatched.slice(0, 4).join(", ") || "core technical skills";
    const missingPreview = finalMissing.slice(0, 3).join(", ");
    summary = missingPreview
      ? `Your resume demonstrates ${matchedPreview} (${matchScore ?? 0}% verified alignment), with gaps to address in ${missingPreview}.`
      : `Your resume demonstrates ${matchedPreview} (${matchScore ?? 0}% verified alignment).`;
  }

  const targetCount = Math.max(3, Math.min(7, Math.round(input.questionCount ?? 5)));
  const questionCandidate = [
    parsed.questions,
    parsed.interviewQuestions,
    parsed.interview_questions,
    rawReport.questions,
  ].find((arr) => Array.isArray(arr) && arr.length > 0);
  const rawQuestions: unknown[] = Array.isArray(questionCandidate)
    ? questionCandidate
    : [];
  const normalizedQuestions: InterviewQuestion[] = [];

  for (let i = 0; i < rawQuestions.length && normalizedQuestions.length < targetCount; i++) {
    const q = rawQuestions[i];
    const fallbackQ = baseline.questions[i % baseline.questions.length];

    if (typeof q === "string") {
      const prompt = q.trim();
      if (prompt.length < 15) continue;
      normalizedQuestions.push({
        id: `ai-q-${normalizedQuestions.length + 1}-${input.variation ?? 0}`,
        prompt,
        keywords: fallbackQ.keywords,
        type: hasResume
          ? i === 0
            ? "resume_deep_dive"
            : "role_behavioral"
          : "role_behavioral",
        rationale: fallbackQ.rationale,
      });
      continue;
    }

    if (!q || typeof q !== "object") continue;
    const rec = q as Record<string, unknown>;
    const rawPrompt =
      typeof rec.prompt === "string"
        ? rec.prompt
        : typeof rec.question === "string"
          ? rec.question
          : typeof rec.text === "string"
            ? rec.text
            : "";
    const prompt = rawPrompt.trim();
    if (prompt.length < 15) continue;
    const keywords = normalizeStringArray(rec.keywords, 6);
    normalizedQuestions.push({
      id: `ai-q-${normalizedQuestions.length + 1}-${input.variation ?? 0}`,
      prompt,
      keywords: keywords.length > 0 ? keywords : fallbackQ.keywords,
      type: normalizeQuestionType(
        rec.type,
        hasResume ? (i === 0 ? "resume_deep_dive" : "role_behavioral") : "role_behavioral"
      ),
      rationale:
        typeof rec.rationale === "string" && rec.rationale.trim()
          ? rec.rationale.trim()
          : fallbackQ.rationale,
    });
  }

  if (normalizedQuestions.length === 0) {
    throw new Error("AI response contained no valid interview questions.");
  }

  // Pad with baseline questions if fewer than targetCount were returned
  let padIdx = 0;
  while (normalizedQuestions.length < targetCount && padIdx < baseline.questions.length) {
    const candidate = baseline.questions[padIdx++];
    if (!normalizedQuestions.some((q) => q.prompt === candidate.prompt)) {
      normalizedQuestions.push(candidate);
    }
  }

  return {
    tailorReport: {
      hasResume,
      hasJobDescription,
      matchScore,
      verdict,
      summary,
      matchedSkills: finalMatched,
      missingSkills:
        finalMissing.length > 0 || finalMatched.length > 0
          ? finalMissing
          : baseline.tailorReport.missingSkills,
      tailoringTips:
        tailoringTips.length > 0 ? tailoringTips : baseline.tailorReport.tailoringTips,
    },
    questions: normalizedQuestions,
  };
}

const LEVEL_GUIDANCE: Record<string, string> = {
  internship:
    "Internship (LI) candidate — anchor questions to university coursework, FYP, hackathons, lab projects, learning agility, and teamwork.",
  fresh_grad:
    "Fresh graduate candidate — balance FYP/internship depth, engineering fundamentals, collaboration, and ownership.",
  junior:
    "Junior (1–2 years experience) candidate — expect production ownership, debugging trade-offs, code quality, and cross-team delivery.",
};

function buildPrompts(input: PrepareInterviewRequest): { system: string; user: string } {
  const questionCount = Math.max(3, Math.min(7, Math.round(input.questionCount ?? 5)));
  const compactJd =
    input.mode === "general" ? "" : compactForPrompt(input.jobDescription, MAX_JD_CHARS);
  const compactResume = compactForPrompt(input.resumeText, MAX_RESUME_CHARS);
  const hasResume = compactResume.length > 0;
  const hasJd = compactJd.length > 0;
  const targetRole = input.mode === "general" ? "General Behavioral" : input.role || "Software Engineer";
  const company = input.mode === "company" ? input.company.trim() : "";
  const levelKey = input.experienceLevel ?? "fresh_grad";
  const levelInstruction = LEVEL_GUIDANCE[levelKey] ?? LEVEL_GUIDANCE.fresh_grad;

  const arcGuidance =
    questionCount >= 7
      ? "Follow a complete 7-question interview arc: (1) resume/project deep-dive, (2) JD skill-gap or learning agility, (3) core technical problem-solving, (4) teamwork or resolving disagreement, (5) ownership under tight deadline/ambiguity, (6) architecture/quality trade-off or initiative, (7) setback recovery & reflection."
      : questionCount >= 5
        ? "Follow a balanced 5-question interview arc: (1) resume/project deep-dive, (2) JD skill-gap or learning agility, (3) core role technical problem-solving, (4) teamwork or conflict resolution, (5) ownership under deadline or process improvement."
        : "Keep the 3 questions high-signal and distinct: core technical problem-solving, gap/learning agility, and collaboration/ownership.";

  const questionMixRule =
    hasResume && hasJd
      ? [
          `- questions: return EXACTLY ${questionCount} distinct behavioral STAR question objects (non-empty "prompt" and 4-5 "keywords" each) using this mix:`,
          `  1) Q1 MUST have type "resume_deep_dive" and explicitly name a specific project, internship, or metric from <candidate_resume>.`,
          `  2) Q2 MUST have type "jd_gap" and explicitly name 1-2 missing skills from missingSkills (present in <job_description> but absent from <candidate_resume>) to test ramp-up or bridging the gap.`,
          questionCount >= 7
            ? `  3) Include one more "resume_deep_dive" (a DIFFERENT project from Q1) and fill remaining slots with "role_behavioral" anchored to core <job_description> responsibilities${company ? ` at ${company}` : ""}.`
            : `  3) Q3+ MUST have type "role_behavioral" anchored to core <job_description> responsibilities${company ? ` at ${company}` : ""}.`,
          `  4) ${arcGuidance}`,
        ].join("\n")
      : hasResume
        ? `- questions: return EXACTLY ${questionCount} distinct behavioral STAR question objects (non-empty "prompt" and 4-5 "keywords" each): Q1 MUST have type "resume_deep_dive" naming a specific project/internship from <candidate_resume>; Q2 should use type "jd_gap" if missingSkills is non-empty (else "role_behavioral"); Q3+ MUST have type "role_behavioral" tailored to ${targetRole}. ${arcGuidance}`
        : hasJd
          ? `- questions: return EXACTLY ${questionCount} distinct behavioral STAR question objects (type "role_behavioral", non-empty "prompt", 4-5 "keywords" each) anchored directly to specific skills and responsibilities in <job_description>. ${arcGuidance}`
          : `- questions: return EXACTLY ${questionCount} distinct role-specific STAR behavioral question objects (type "role_behavioral", non-empty "prompt", 4-5 "keywords" each) tailored to ${targetRole}. ${arcGuidance}`;

  const system = [
    "You are an interview coach for Malaysian university CS/IT graduates.",
    "Output ONLY valid JSON matching this schema:",
    "{",
    '  "tailorReport": {',
    '    "matchScore": integer 0-100 (percentage, NEVER a 0-1 decimal)|null,',
    '    "verdict": "Strong Fit"|"Moderate Fit"|"Needs Tailoring"|"Role Prep",',
    '    "summary": string,',
    '    "matchedSkills": string[],',
    '    "missingSkills": string[],',
    '    "tailoringTips": string[]',
    "  },",
    '  "questions": [',
    '    { "type": "resume_deep_dive"|"jd_gap"|"role_behavioral", "prompt": string, "keywords": string[], "rationale": string }',
    "  ]",
    "}",
    "Rules: Be strictly factual and concise.",
    `- Candidate Level: ${levelInstruction}`,
    "- ONLY inspect <candidate_resume> for candidate skills/projects. NEVER attribute <job_description> requirements (e.g. Docker, CI/CD, Redis) to the candidate unless explicitly written in <candidate_resume>.",
    '- matchedSkills: ONLY skills explicitly present in BOTH <candidate_resume> and <job_description>. missingSkills: distinct <job_description> skills absent from <candidate_resume> (no duplicates like both "Redis" and "Redis caching").',
    "- If <candidate_resume> is empty, set matchScore=null, verdict='Role Prep', matchedSkills=[], and put target skills in missingSkills.",
    "- tailoringTips: 2-3 specific gaps to address; do NOT tell the candidate to add metrics or skills already present in <candidate_resume>.",
    questionMixRule,
  ].join("\n");

  const lines = [
    `Mode: ${input.mode}`,
    `Target Role: ${targetRole}`,
    `Experience Level: ${levelKey}`,
    company ? `Company: ${company}` : null,
    `Questions Needed: ${questionCount}`,
    input.variation
      ? `Variation Seed: ${input.variation} (keep the required question-type mix, but pick a different project/experience from <candidate_resume> and a different gap skill from missingSkills)`
      : null,
    compactJd
      ? `<job_description>\n${compactJd}\n</job_description>`
      : "<job_description>\n(none provided)\n</job_description>",
    compactResume
      ? `<candidate_resume>\n${compactResume}\n</candidate_resume>`
      : "<candidate_resume>\n(none provided)\n</candidate_resume>",
  ].filter(Boolean);

  return { system, user: lines.join("\n\n") };
}

async function readHttpErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string };
      message?: string;
    };
    const msg = body?.error?.message ?? body?.message;
    if (typeof msg === "string" && msg.trim()) {
      return msg.trim().slice(0, 140);
    }
  } catch {
    // ignore non-JSON error body
  }
  return "";
}

export interface ResolvedLlmProvider {
  provider: AiProviderUsed;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  reason?: string;
}

export interface CallLlmJsonOptions {
  prompts: { system: string; user: string };
  temperature: number;
  maxTokens: number;
  groqJsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
}

async function callGroq(
  prompts: { system: string; user: string },
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  groqJsonSchema?: { name: string; schema: Record<string, unknown> }
): Promise<string> {
  const isGptOss = /gpt-oss/i.test(model);
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ],
    response_format:
      isGptOss && groqJsonSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: groqJsonSchema.name,
              strict: true,
              schema: groqJsonSchema.schema,
            },
          }
        : { type: "json_object" },
    temperature,
    max_completion_tokens: maxTokens,
  };
  if (isGptOss) {
    payload.reasoning_effort = "low";
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = await readHttpErrorDetail(res);
    throw new Error(detail ? `Groq HTTP ${res.status}: ${detail}` : `Groq HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty content.");
  return content;
}

async function callGemini(
  prompts: { system: string; user: string },
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompts.system }] },
      contents: [{ role: "user", parts: [{ text: prompts.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await readHttpErrorDetail(res);
    throw new Error(detail ? `Gemini HTTP ${res.status}: ${detail}` : `Gemini HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned empty content.");
  return content;
}

async function callOllama(
  prompts: { system: string; user: string },
  baseUrl: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/chat`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user },
      ],
      stream: false,
      format: "json",
      options: { temperature, num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Ollama returned empty content.");
  return content;
}

export function resolveLlmProvider(): ResolvedLlmProvider {
  const configured = (process.env.AI_PROVIDER ?? "auto").trim().toLowerCase();
  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:3b";
  const ollamaExplicit = Boolean(
    process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_MODEL?.trim()
  );

  if (configured === "offline") {
    return { provider: "offline", model: "rule-based-nlp" };
  }
  if (configured === "groq") {
    return hasRealKey(groqKey)
      ? { provider: "groq", model: groqModel, apiKey: groqKey.trim() }
      : {
          provider: "offline",
          model: "rule-based-nlp",
          reason: "GROQ_API_KEY is not configured; using built-in NLP engine.",
        };
  }
  if (configured === "gemini") {
    return hasRealKey(geminiKey)
      ? { provider: "gemini", model: geminiModel, apiKey: geminiKey.trim() }
      : {
          provider: "offline",
          model: "rule-based-nlp",
          reason: "GEMINI_API_KEY is not configured; using built-in NLP engine.",
        };
  }
  if (configured === "ollama") {
    return { provider: "ollama", model: ollamaModel, baseUrl: ollamaUrl };
  }

  // Auto priority: Groq -> Gemini -> explicit Ollama -> Offline rule-based NLP
  if (hasRealKey(groqKey)) {
    return { provider: "groq", model: groqModel, apiKey: groqKey.trim() };
  }
  if (hasRealKey(geminiKey)) {
    return { provider: "gemini", model: geminiModel, apiKey: geminiKey.trim() };
  }
  if (ollamaExplicit) {
    return { provider: "ollama", model: ollamaModel, baseUrl: ollamaUrl };
  }

  return {
    provider: "offline",
    model: "rule-based-nlp",
    reason: "No AI API key configured in .env.local; using offline rule-based tailoring.",
  };
}

export async function invokeLlmJson(
  resolved: ResolvedLlmProvider,
  options: CallLlmJsonOptions
): Promise<string> {
  if (resolved.provider === "groq") {
    return callGroq(
      options.prompts,
      resolved.apiKey!,
      resolved.model,
      options.temperature,
      options.maxTokens,
      options.groqJsonSchema
    );
  }
  if (resolved.provider === "gemini") {
    return callGemini(
      options.prompts,
      resolved.apiKey!,
      resolved.model,
      options.temperature,
      options.maxTokens
    );
  }
  if (resolved.provider === "ollama") {
    return callOllama(
      options.prompts,
      resolved.baseUrl!,
      resolved.model,
      options.temperature,
      options.maxTokens
    );
  }
  throw new Error("Offline provider cannot execute LLM JSON request.");
}

export async function generateInterviewPreparation(
  input: PrepareInterviewRequest
): Promise<PrepareInterviewResponse> {
  const resolved = resolveLlmProvider();

  if (resolved.provider === "offline") {
    return {
      provider: "offline",
      model: resolved.model,
      ...(resolved.reason ? { fallbackReason: resolved.reason } : {}),
      ...buildOfflinePreparation(input),
    };
  }

  const questionCount = Math.max(3, Math.min(7, Math.round(input.questionCount ?? 5)));
  const prompts = buildPrompts(input);
  const temperature = input.variation ? 0.4 : 0.2;
  // Scale output budget dynamically so 5Q and 7Q JSON payloads never truncate mid-object
  const maxTokens =
    resolved.provider === "groq"
      ? Math.max(1800, questionCount * 380)
      : resolved.provider === "gemini"
        ? Math.max(1100, questionCount * 350)
        : Math.max(1000, questionCount * 310);

  try {
    const rawJson = await invokeLlmJson(resolved, {
      prompts,
      temperature,
      maxTokens,
      groqJsonSchema: {
        name: "interview_preparation",
        schema: INTERVIEW_PREP_JSON_SCHEMA,
      },
    });

    const normalized = normalizeAiPayload(rawJson, input);
    return {
      provider: resolved.provider,
      model: resolved.model,
      ...normalized,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "AI provider request failed.";
    return {
      provider: "offline",
      model: "rule-based-nlp",
      fallbackReason: `${resolved.provider.toUpperCase()} unavailable (${detail}); used offline rule-based fallback.`,
      ...buildOfflinePreparation(input),
    };
  }
}
