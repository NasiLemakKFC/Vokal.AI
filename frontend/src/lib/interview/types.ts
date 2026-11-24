export type InterviewTargetMode = "company" | "role" | "general";

export type QuestionCountOption = 3 | 5 | 7;

export const QUESTION_COUNT_OPTIONS: readonly {
  count: QuestionCountOption;
  label: string;
  durationHint: string;
}[] = [
  { count: 3, label: "Quick drill", durationHint: "~6–8 min" },
  { count: 5, label: "Standard", durationHint: "~12–15 min" },
  { count: 7, label: "Full mock", durationHint: "~18–25 min" },
] as const;

export type ExperienceLevel = "internship" | "fresh_grad" | "junior";

export const EXPERIENCE_LEVELS: readonly {
  value: ExperienceLevel;
  label: string;
  shortLabel: string;
}[] = [
  { value: "internship", label: "Internship (LI)", shortLabel: "Internship" },
  { value: "fresh_grad", label: "Fresh Graduate", shortLabel: "Fresh grad" },
  { value: "junior", label: "Junior (1–2 yrs)", shortLabel: "Junior" },
] as const;

export interface InterviewTarget {
  mode: InterviewTargetMode;
  company: string;
  role: string;
  jobDescription: string;
  experienceLevel?: ExperienceLevel;
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
  experienceLevel?: ExperienceLevel;
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

export const DEFAULT_QUESTION_BANK: InterviewQuestion[] = [
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
  {
    id: "default-4",
    type: "role_behavioral",
    prompt:
      "Tell me about a time you had to quickly learn an unfamiliar technology or framework under a tight deadline. How did you ramp up?",
    keywords: [
      "Documentation",
      "Prototype",
      "Debugging",
      "Adaptability",
      "Outcome",
    ],
    rationale: "Measures learning agility and self-directed execution under time pressure.",
  },
  {
    id: "default-5",
    type: "role_behavioral",
    prompt:
      "Describe a project where requirements were unclear or changed midway. How did you clarify priorities and keep delivery on track?",
    keywords: [
      "Stakeholder",
      "Scope",
      "Prioritization",
      "Communication",
      "Deliverables",
    ],
    rationale: "Evaluates structured thinking and calm decision-making under ambiguity.",
  },
  {
    id: "default-6",
    type: "role_behavioral",
    prompt:
      "Tell me about a time you received tough or unexpected feedback on your work. How did you respond and what changed afterward?",
    keywords: [
      "Code review",
      "Feedback",
      "Iteration",
      "Ownership",
      "Improvement",
    ],
    rationale: "Checks coachability, ego-free reflection, and follow-through.",
  },
  {
    id: "default-7",
    type: "role_behavioral",
    prompt:
      "Describe a time something you built or shipped did not go as planned. What did you own, how did you recover, and what would you do differently?",
    keywords: [
      "Accountability",
      "Root cause",
      "Recovery",
      "Testing",
      "Lessons learned",
    ],
    rationale: "Tests ownership, resilience, and engineering maturity after setbacks.",
  },
];

export const DEFAULT_QUESTIONS: InterviewQuestion[] = DEFAULT_QUESTION_BANK.slice(0, 5);

export function getDefaultQuestions(count: QuestionCountOption): InterviewQuestion[] {
  return DEFAULT_QUESTION_BANK.slice(0, count);
}
