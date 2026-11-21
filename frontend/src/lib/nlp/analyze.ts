import { analyzeKeywords } from "./keywords";
import { analyzeStar } from "./star";
import type { AnalysisOptions, AnswerAnalysis, StarKey, StarSection } from "./types";

const STAR_KEYS: StarKey[] = ["situation", "task", "action", "result"];

function emptySection(key: StarKey): StarSection {
  const suggestions: Record<StarKey, string> = {
    situation: "Set the context: explain when and where this happened, and what challenge the team faced.",
    task: "Clarify your personal responsibility or the specific objective you needed to achieve.",
    action: "Describe the steps you personally took. Use 'I' statements and name the tools or skills you applied.",
    result: "Explain the outcome of your actions. Include measurable results, impact, or what you learned.",
  };
  return {
    found: false,
    sentences: [],
    explanation: `No clear ${key} statement was detected in the current answer.`,
    suggestion: suggestions[key],
  };
}

/**
 * Runs the Module 3 analysis defensively. The STAR result is normalised here so
 * an empty transcript, a partially-shaped result during hot reload, or an
 * unexpected NLP return value cannot crash the interview route.
 */
export function analyzeAnswer(answerInput: string, optionsInput: AnalysisOptions): AnswerAnalysis {
  const answer = typeof answerInput === "string" ? answerInput : "";
  const options = optionsInput ?? { role: "", jobDescription: "", question: "" };

  const starResult = analyzeStar(answer);
  const rawSections = starResult?.sections;
  const sections = Object.fromEntries(
    STAR_KEYS.map((key) => {
      const candidate = rawSections?.[key];
      return [key, candidate && typeof candidate === "object"
        ? {
            ...emptySection(key),
            ...candidate,
            sentences: Array.isArray(candidate.sentences) ? candidate.sentences : [],
            found: Boolean(candidate.found),
          }
        : emptySection(key)];
    }),
  ) as Record<StarKey, StarSection>;
  const sentences = Array.isArray(starResult?.sentences) ? starResult.sentences : [];

  const keywordGroups = analyzeKeywords(
    answer,
    typeof options.role === "string" ? options.role : "",
    typeof options.jobDescription === "string" ? options.jobDescription : "",
    typeof options.question === "string" ? options.question : "",
  );
  // Overall coverage counts unique targets once, even if a term appears in multiple categories.
  const scoredGroups = keywordGroups.filter(g => g.label !== "Additional job-role skills demonstrated");
  const matchedTerms = new Set(scoredGroups.flatMap(g => g.matched.map(t => t.toLowerCase())));
  const allTerms = new Set(scoredGroups.flatMap(g => [...g.matched, ...g.missing].map(t => t.toLowerCase())));
  const matchedCount = matchedTerms.size;
  const missingCount = [...allTerms].filter(term => !matchedTerms.has(term)).length;
  const total = allTerms.size;
  const found = STAR_KEYS.filter((key) => sections[key].found).length;
  const coaching: string[] = [];

  if (answer.trim().length < 35) {
    coaching.push("Add more detail so your experience can be assessed across all four STAR sections.");
  }
  if (sections.situation.found) coaching.push("Your answer gives context for the situation.");
  else coaching.push(sections.situation.suggestion);
  if (!sections.task.found) coaching.push(sections.task.suggestion);
  if (!sections.action.found) coaching.push(sections.action.suggestion);
  else coaching.push("Your answer describes actions; make your personal contribution and decisions explicit.");
  if (!sections.result.found) coaching.push(sections.result.suggestion);
  else if (!/\b\d+(?:\.\d+)?\s*(?:%|percent|peratus|ms|seconds?|saat|minutes?|minit|hours?|jam|days?|hari|users?|pengguna|customers?|pelanggan|requests?)\b/i.test(answer)) coaching.push("Your answer includes an outcome. Add a number or before-and-after comparison if you can.");

  // Question relevance is a transparent, conservative topic check, not semantic AI.
  // Only warn for clearly mismatched questions; never equate a missing word with a bad answer.
  const topicChecks: { question: RegExp; answer: RegExp; guidance: string }[] = [
    { question: /automat(?:e|ed|ion|ing)|repetitive task/i, answer: /automat|script|repetitive|manual|scheduled|workflow|batch|time.saved|berulang|tugas berulang|kerja berulang|jimat masa|skrip|aliran kerja/i, guidance: "This question asks about automating a repetitive task. Describe the manual process, the automation you built, and the time or effort saved." },
    { question: /disagreement|conflict with|disagreed|teammate dispute/i, answer: /disagree|conflict|different opinions|compromise|discussion|teammate|dispute|agreement|perselisihan|konflik|tidak sependapat|salah faham|kompromi|berbincang|bincang|rakan sepasukan|sepakat/i, guidance: "This question asks about resolving a disagreement. Explain both viewpoints, how you handled the discussion, and the final agreement." },
    { question: /bug in production|critical bug|production issue/i, answer: /bug|production|incident|error|failure|outage|debug|deploy|fix|ralat|masalah sistem|rosak|gangguan|crash|down|punca|baiki|betulkan|selesai|semak log/i, guidance: "This question asks about a production bug. Explain the incident, your investigation, your fix, and how you verified recovery." },
  ];
  const topic = topicChecks.find(t => t.question.test(options.question || ""));
  if (answer.trim() && topic && !topic.answer.test(answer)) coaching.unshift(`Question relevance: ${topic.guidance}`);
  if (!sections.result.found && /\b(?:not reached|did not reach|had not reached|did not confirm|not yet resolved|still unresolved|tidak berjaya|tak berjaya|belum berjaya|belum selesai|masih belum selesai|belum diselesaikan)\b/i.test(answer)) {
    coaching.push("You described an unresolved situation. State what happened afterward, if known; do not invent a successful outcome.");
  }
  const bmCueMatches = answer.match(
    /\b(?:saya|kami|masa|tugas|tanggungjawab|hasilnya|akhirnya|kerana|sebab|untuk|dengan|dalam|telah|sudah|berjaya|masalah|berbincang|selesaikan|semak|baiki|betulkan|lebih\s+laju|lebih\s+stabil)\b/gi
  );
  if (bmCueMatches && new Set(bmCueMatches.map((m) => m.toLowerCase())).size >= 2) {
    coaching.push(
      "Bilingual BM + English cues were recognised in your STAR analysis. For English-medium interviews, try rephrasing the BM parts into English on your next attempt."
    );
  }
  const missing = scoredGroups.flatMap((group) => group.missing);
  if (missing.length) {
    coaching.push(`Consider naturally including relevant skills such as ${missing.slice(0, 4).join(", ")} when they genuinely reflect your experience.`);
  }
  if (found === 4 && missing.length === 0) {
    coaching.push("Your answer covers all STAR sections and all detected target keywords.");
  }

  return {
    star: sections,
    sentences,
    keywordGroups,
    matchedCount,
    missingCount,
    coverage: total ? Math.round((matchedCount / total) * 100) : 0,
    coaching,
  };
}
