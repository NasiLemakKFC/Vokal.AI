export type StarKey = "situation" | "task" | "action" | "result";
export type KeywordCategory = "question" | "job-role" | "job-description" | "professional";
export interface KeywordGroup {
  category: KeywordCategory;
  label: string;
  matched: string[];
  missing: string[];
}
export interface StarSection {
  found: boolean;
  explanation: string;
  suggestion: string;
  sentences: string[];
}
export interface AnswerSentence {
  text: string;
  section: StarKey | "unclassified";
}
export interface AnswerAnalysis {
  star: Record<StarKey, StarSection>;
  sentences: AnswerSentence[];
  keywordGroups: KeywordGroup[];
  matchedCount: number;
  missingCount: number;
  coverage: number;
  coaching: string[];
}
export interface AnalysisOptions {
  role: string;
  jobDescription: string;
  question: string;
  questionKeywords?: string[];
}
