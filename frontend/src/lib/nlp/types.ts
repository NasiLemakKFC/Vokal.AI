export type StarKey = "situation" | "task" | "action" | "result";

export const STAR_LABELS: readonly (readonly [StarKey, string])[] = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

export interface StarPillar {
  score: number;
  note: string;
}
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
export interface StarProportion {
  situation: number;
  task: number;
  action: number;
  result: number;
}

export interface LlmStarEvaluation {
  provider: "groq" | "gemini" | "ollama";
  model: string;
  pillarScores: Record<StarKey, number>;
  pillarFeedback: Record<StarKey, string>;
  relevanceScore: number;
  relevanceNote: string;
  ownershipNote: string;
  starProportion: StarProportion;
  proportionFeedback: string;
  strongerRewrite: {
    targetPillar: StarKey;
    example: string;
  };
  topCoaching: string[];
}

export interface AnswerAnalysis {
  star: Record<StarKey, StarSection>;
  sentences: AnswerSentence[];
  keywordGroups: KeywordGroup[];
  matchedCount: number;
  missingCount: number;
  coverage: number;
  coaching: string[];
  llmEvaluation?: LlmStarEvaluation | null;
}
export interface AnalysisOptions {
  role: string;
  jobDescription: string;
  question: string;
  questionKeywords?: string[];
}
