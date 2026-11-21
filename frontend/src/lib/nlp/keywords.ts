import { KEYWORD_LABELS, PROFESSIONAL_KEYWORDS, ROLE_KEYWORDS } from "./taxonomy";
import { includesKeyword, unique } from "./text";
import type { KeywordGroup } from "./types";

const VOCABULARY = unique([
  ...Object.values(ROLE_KEYWORDS).flat(), ...PROFESSIONAL_KEYWORDS,
  "python", "sql", "api development", "database management", "database", "api", "debugging", "unit testing", "testing", "git", "performance optimization", "performance", "software", "teamwork", "problem solving", "troubleshooting", "server logs", "collaboration", "code review", "technical issue", "deadline", "web application",
]);
const SYNONYMS: Record<string, string[]> = {
  teamwork: ["team", "teammates", "worked together", "collaborated", "collaboration", "kerja berpasukan", "bekerjasama", "kerjasama", "rakan sepasukan", "ahli kumpulan"],
  collaboration: ["collaborated", "teammates", "worked with", "teamwork", "bekerjasama", "kerjasama", "rakan sepasukan"],
  "problem solving": ["solved", "resolved", "fixed", "fix", "troubleshoot", "debugged", "investigated", "selesaikan masalah", "menyelesaikan masalah", "penyelesaian masalah", "baiki masalah", "atasi masalah", "selesaikan", "menyelesaikan", "membaiki", "menyiasat", "mengatasi", "punca masalah"],
  debugging: ["debug", "debugged", "debugging", "troubleshoot", "investigated the error", "nyahpepijat", "cari punca", "punca masalah", "semak log", "menyemak log", "memeriksa log", "check log", "check logs"],
  testing: ["test", "tested", "tests", "unit testing", "test cases", "ujian", "menguji", "pengujian", "uji semula", "test balik"],
  "unit testing": ["unit tests", "unit test", "unit testing"],
  "api development": ["api", "apis", "endpoints"],
  api: ["apis", "api development", "endpoints"],
  "database management": ["database", "databases", "sql queries", "pangkalan data", "pengurusan pangkalan data"],
  database: ["databases", "sql queries", "database management", "pangkalan data"],
  "performance optimization": ["optimized", "optimised", "optimization", "performance improved", "response time", "reduced latency", "optimumkan", "mengoptimumkan", "prestasi", "lebih laju", "lebih pantas", "masa tindak balas"],
  performance: ["response time", "latency", "optimized", "optimised", "performance issues", "prestasi", "kelajuan", "lebih laju", "lebih pantas", "masa tindak balas"],
  "software development": ["developed", "built", "implemented", "web application", "pembangunan perisian", "membangunkan sistem", "bina sistem", "bina aplikasi"],
  "technical issue": ["technical problem", "technical problems", "error", "issue", "bug", "isu teknikal", "masalah teknikal", "ralat", "masalah sistem", "server crash", "server down"],
  troubleshooting: ["troubleshoot", "debugged", "investigated", "fixed", "cari punca", "siasat masalah", "menyiasat masalah", "baiki masalah"],
  communication: ["communicated", "discussed", "presented", "explained", "komunikasi", "berkomunikasi", "berbincang", "bincang", "bentang", "membentangkan", "terangkan", "jelaskan"],
  "time management": ["deadline", "on time", "before the deadline", "pengurusan masa", "tarikh akhir", "tepat pada masa", "sebelum tarikh akhir", "ikut jadual"],
  git: ["github", "gitlab", "git"],
  leadership: ["led", "leading", "kepimpinan", "mengetuai", "ketuai", "memimpin", "pimpin", "ketua pasukan"],
  "conflict resolution": ["conflict", "disagreement", "compromise", "perselisihan", "konflik", "salah faham", "tidak sependapat", "kompromi", "kata sepakat"],
  planning: ["planned", "plan", "perancangan", "merancang", "rancang", "jadual"],
  feedback: ["maklum balas", "komen"],
  deadline: ["tarikh akhir", "tepat pada masa"],
  documentation: ["documented", "docs", "dokumentasi", "laporan"],
  security: ["keselamatan"],
};
export function formatSkillLabel(term: string): string {
  return KEYWORD_LABELS[term] ?? term.replace(/\b\w/g, (c) => c.toUpperCase());
}
export function matchesSkillTerm(answer: string, term: string): boolean {
  return [term, ...(SYNONYMS[term] ?? [])].some((phrase) => includesKeyword(answer, phrase));
}
export function extractSkillTerms(text: string): string[] {
  if (!text.trim()) return [];
  // Longest phrases first, so "unit testing" is not counted twice as "testing".
  const detected = VOCABULARY.filter((term) => includesKeyword(text, term)).sort(
    (a, b) => b.length - a.length
  );
  return detected
    .filter(
      (term) =>
        !detected.some(
          (other) => other !== term && other.includes(term) && includesKeyword(text, other)
        )
    )
    .slice(0, 20);
}
function group(
  label: string,
  category: KeywordGroup["category"],
  terms: string[],
  answer: string
): KeywordGroup {
  return {
    label,
    category,
    matched: terms.filter((t) => matchesSkillTerm(answer, t)).map(formatSkillLabel),
    missing: terms.filter((t) => !matchesSkillTerm(answer, t)).map(formatSkillLabel),
  };
}
export function extractJobDescriptionKeywords(description: string): string[] {
  return extractSkillTerms(description).map(formatSkillLabel);
}
export function analyzeKeywords(
  answer: string,
  role: string,
  jobDescription: string,
  question: string,
  questionKeywords: string[] = []
): KeywordGroup[] {
  const normalizedCustom = questionKeywords
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean);
  const questionTerms = unique([...extractSkillTerms(question), ...normalizedCustom]).slice(
    0,
    10
  );
  const jdTerms = extractSkillTerms(jobDescription);
  const roleTerms = ROLE_KEYWORDS[role] ?? [];
  const groups: KeywordGroup[] = [];
  // Only skills explicitly present in the question (or generated question keywords) are required from that question.
  if (questionTerms.length) groups.push(group("Interview question", "question", questionTerms, answer));
  if (jdTerms.length) {
    // Job description is the authoritative skill set when supplied; avoid unrelated role requirements.
    groups.push(group("Job description", "job-description", jdTerms, answer));
    const extras = roleTerms
      .filter((term) => !jdTerms.some((jd) => jd === term || jd.includes(term) || term.includes(jd)))
      .filter((term) => matchesSkillTerm(answer, term))
      .slice(0, 6);
    if (extras.length) groups.push(group("Additional job-role skills demonstrated", "job-role", extras, answer));
  } else if (roleTerms.length) {
    // Role mode uses a small set of common skills, not every possible language/framework.
    const demonstrated = roleTerms.filter((term) => matchesSkillTerm(answer, term));
    const essentials = roleTerms.filter((term) =>
      [
        "debugging",
        "testing",
        "api",
        "database",
        "communication",
        "problem solving",
        "git",
        "sql",
        "python",
        "javascript",
        "react",
        "project planning",
      ].includes(term)
    );
    groups.push(group("Job role", "job-role", unique([...essentials, ...demonstrated]).slice(0, 12), answer));
  } else {
    const demonstrated = PROFESSIONAL_KEYWORDS.filter((term) => matchesSkillTerm(answer, term));
    groups.push(
      group(
        "Professional skills",
        "professional",
        unique(["communication", "teamwork", "problem solving", ...demonstrated]).slice(0, 12),
        answer
      )
    );
  }
  return groups;
}
