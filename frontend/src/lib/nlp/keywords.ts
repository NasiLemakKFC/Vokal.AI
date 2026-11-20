import { KEYWORD_LABELS, PROFESSIONAL_KEYWORDS, ROLE_KEYWORDS } from "./taxonomy";
import { includesKeyword, unique } from "./text";
import type { KeywordGroup } from "./types";

const VOCABULARY = unique([
  ...Object.values(ROLE_KEYWORDS).flat(), ...PROFESSIONAL_KEYWORDS,
  "python", "sql", "api development", "database management", "database", "api", "debugging", "unit testing", "testing", "git", "performance optimization", "performance", "software", "teamwork", "problem solving", "troubleshooting", "server logs", "collaboration", "code review", "technical issue", "deadline", "web application",
]);
const SYNONYMS: Record<string, string[]> = {
  teamwork: ["team", "teammates", "worked together", "collaborated", "collaboration"],
  collaboration: ["collaborated", "teammates", "worked with", "teamwork"],
  "problem solving": ["solved", "resolved", "fixed", "troubleshoot", "debugged", "investigated"],
  debugging: ["debug", "debugged", "debugging", "troubleshoot", "investigated the error"],
  testing: ["tested", "tests", "unit testing", "test cases"],
  "unit testing": ["unit tests", "unit test", "unit testing"],
  "api development": ["api", "apis", "endpoints"],
  api: ["apis", "api development", "endpoints"],
  "database management": ["database", "databases", "sql queries"],
  database: ["databases", "sql queries", "database management"],
  "performance optimization": ["optimized", "optimised", "optimization", "performance improved", "response time", "reduced latency"],
  performance: ["response time", "latency", "optimized", "optimised", "performance issues"],
  "software development": ["developed", "built", "implemented", "web application"],
  "technical issue": ["technical problem", "technical problems", "error", "issue", "bug"],
  troubleshooting: ["troubleshoot", "debugged", "investigated", "fixed"],
  communication: ["communicated", "discussed", "presented", "explained"],
  "time management": ["deadline", "on time", "before the deadline"],
  git: ["github", "gitlab", "git"],
};
function display(term: string): string { return KEYWORD_LABELS[term] ?? term.replace(/\b\w/g, c => c.toUpperCase()); }
function matches(answer: string, term: string): boolean {
  return [term, ...(SYNONYMS[term] ?? [])].some(phrase => includesKeyword(answer, phrase));
}
function extract(text: string): string[] {
  if (!text.trim()) return [];
  // Longest phrases first, so "unit testing" is not counted twice as "testing".
  const detected = VOCABULARY.filter(term => includesKeyword(text, term)).sort((a,b) => b.length - a.length);
  return detected.filter(term => !detected.some(other => other !== term && other.includes(term) && includesKeyword(text, other))).slice(0, 20);
}
function group(label: string, category: KeywordGroup["category"], terms: string[], answer: string): KeywordGroup {
  return { label, category, matched: terms.filter(t => matches(answer,t)).map(display), missing: terms.filter(t => !matches(answer,t)).map(display) };
}
export function extractJobDescriptionKeywords(description: string): string[] { return extract(description).map(display); }
export function analyzeKeywords(answer: string, role: string, jobDescription: string, question: string): KeywordGroup[] {
  const questionTerms = extract(question);
  const jdTerms = extract(jobDescription);
  const roleTerms = ROLE_KEYWORDS[role] ?? [];
  const groups: KeywordGroup[] = [];
  // Only skills explicitly present in the question are required from that question.
  if (questionTerms.length) groups.push(group("Interview question", "question", questionTerms, answer));
  if (jdTerms.length) {
    // Job description is the authoritative skill set when supplied; avoid unrelated role requirements.
    groups.push(group("Job description", "job-description", jdTerms, answer));
    const extras = roleTerms.filter(term => !jdTerms.some(jd => jd === term || jd.includes(term) || term.includes(jd))).filter(term => matches(answer,term)).slice(0,6);
    if (extras.length) groups.push(group("Additional job-role skills demonstrated", "job-role", extras, answer));
  } else if (roleTerms.length) {
    // Role mode uses a small set of common skills, not every possible language/framework.
    const demonstrated = roleTerms.filter(term => matches(answer,term));
    const essentials = roleTerms.filter(term => ["debugging", "testing", "api", "database", "communication", "problem solving", "git", "sql", "python", "javascript", "react", "project planning"].includes(term));
    groups.push(group("Job role", "job-role", unique([...essentials, ...demonstrated]).slice(0,12), answer));
  } else {
    const demonstrated = PROFESSIONAL_KEYWORDS.filter(term => matches(answer,term));
    groups.push(group("Professional skills", "professional", unique(["communication", "teamwork", "problem solving", ...demonstrated]).slice(0,12), answer));
  }
  return groups;
}
