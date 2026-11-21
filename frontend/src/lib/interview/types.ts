export type InterviewTargetMode = "company" | "role" | "general";

export interface InterviewTarget {
  mode: InterviewTargetMode;
  company: string;
  role: string;
  jobDescription: string;
}

export type InterviewQuestionType =
  | "resume_deep_dive"
  | "jd_gap"
  | "role_behavioral";

export interface InterviewQuestion {
  id: string;
  prompt: string;
  keywords: string[];
  type: InterviewQuestionType;
  rationale?: string;
}

export interface ResumeTailorReport {
  hasResume: boolean;
  hasJobDescription: boolean;
  matchScore: number | null;
  verdict: "Strong Fit" | "Moderate Fit" | "Needs Tailoring" | "Role Prep";
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  tailoringTips: string[];
}

export type AiProviderUsed = "groq" | "gemini" | "ollama" | "offline";

export interface PrepareInterviewRequest {
  mode: InterviewTargetMode;
  company: string;
  role: string;
  jobDescription: string;
  resumeText: string;
  questionCount?: number;
  variation?: number;
}

export interface PrepareInterviewResponse {
  provider: AiProviderUsed;
  model: string;
  fallbackReason?: string;
  tailorReport: ResumeTailorReport;
  questions: InterviewQuestion[];
}

export const INTERVIEW_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Data Analyst",
  "AI / Machine Learning Engineer",
  "UI/UX Designer",
  "QA Engineer",
  "Project Manager",
] as const;

export const DEFAULT_QUESTIONS: InterviewQuestion[] = [
  {
    id: "default-1",
    type: "role_behavioral",
    prompt:
      "Tell me about a time you faced a critical bug in production right before a deadline. How did you handle it?",
    keywords: [
      "Root cause",
      "Logs / monitoring",
      "Rollback plan",
      "Team update",
      "Measured result",
    ],
    rationale: "Assesses incident debugging, calm prioritization, and measurable recovery.",
  },
  {
    id: "default-2",
    type: "role_behavioral",
    prompt: "Describe a disagreement with a teammate and how you resolved it.",
    keywords: [
      "Active listening",
      "Trade-offs",
      "Shared goal",
      "Compromise",
      "Outcome",
    ],
    rationale: "Evaluates collaboration, conflict resolution, and team communication.",
  },
  {
    id: "default-3",
    type: "role_behavioral",
    prompt: "Tell me about a time you automated a repetitive task.",
    keywords: [
      "Manual bottleneck",
      "Script / workflow",
      "Validation",
      "Reliability",
      "Time saved",
    ],
    rationale: "Checks engineering initiative, workflow improvement, and impact metrics.",
  },
];
