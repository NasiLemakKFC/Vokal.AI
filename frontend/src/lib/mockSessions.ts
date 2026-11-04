/**
 * Mock practice-session data shared by Home and Reports.
 * TODO: replace with MongoDB-backed `/api/sessions` (Module 6).
 */

export interface StarPillar {
  score: number;
  note: string;
}

export interface PracticeSession {
  id: string;
  date: string;
  role: string;
  question: string;
  duration: string;
  /** Module 3 — STAR / content score (0–100) */
  starScore: number;
  /** Module 4 — % of speaking time with eye contact */
  eyeContact: number;
  /** Module 4 — posture alerts raised during the answer */
  postureAlerts: number;
  /** Module 5 */
  wpm: number;
  fillersPerMin: number;
  fillers: string[];
  longPauses: number;
  /** Module 6 */
  overall: number;
  star: { situation: StarPillar; task: StarPillar; action: StarPillar; result: StarPillar };
  improvements: string[];
  /** Module 2 */
  transcript: string;
}

export const SESSIONS: PracticeSession[] = [
  {
    id: "SES-042",
    date: "26 Oct 2026",
    role: "Junior Software Engineer",
    question: "Tell me about a production bug you fixed under a deadline.",
    duration: "3:42",
    starScore: 84,
    eyeContact: 94,
    postureAlerts: 0,
    wpm: 135,
    fillersPerMin: 0.8,
    fillers: ["um ×2", "actually ×1"],
    longPauses: 1,
    overall: 86,
    star: {
      situation: { score: 92, note: "Clear context: staging outage 4 hours before release." },
      task: { score: 88, note: "Owned isolating the memory leak." },
      action: { score: 86, note: "Heap snapshots, patch, rollback plan." },
      result: { score: 70, note: "Said it shipped on time, but gave no number." },
    },
    improvements: [
      "End with a number: e.g. error rate fell from 4.2% to 0.1%.",
      "Cut the two “um”s when moving from Action to Result.",
    ],
    transcript:
      "When our staging payment worker hit a memory spike four hours before release freeze, I took ownership of finding the leak. I compared heap snapshots in Chrome DevTools, found an event listener that was never removed, and shipped a bounded queue patch with a rollback plan. We released on time.",
  },
  {
    id: "SES-039",
    date: "24 Oct 2026",
    role: "Backend Developer",
    question: "Describe a disagreement with another team and how you resolved it.",
    duration: "4:05",
    starScore: 77,
    eyeContact: 90,
    postureAlerts: 1,
    wpm: 142,
    fillersPerMin: 1.2,
    fillers: ["uh ×3", "like ×2"],
    longPauses: 2,
    overall: 79,
    star: {
      situation: { score: 85, note: "Mobile vs backend schema mismatch mid-sprint." },
      task: { score: 82, note: "Align the API contract without delaying release." },
      action: { score: 78, note: "Versioned adapter and contract tests." },
      result: { score: 61, note: "Ended abruptly with no outcome stated." },
    },
    improvements: [
      "State the outcome: zero breaking changes over the next 3 releases.",
      "Slow down slightly — aim for 130–140 WPM.",
      "Replace “like” with a short pause.",
    ],
    transcript:
      "The mobile team and my backend team disagreed on the response shape for the orders endpoint. I proposed a versioned adapter so both could move forward, and wrote contract tests that ran in CI for both repos.",
  },
  {
    id: "SES-035",
    date: "21 Oct 2026",
    role: "Cloud & DevOps Intern",
    question: "Tell me about a time you automated a repetitive task.",
    duration: "3:18",
    starScore: 88,
    eyeContact: 91,
    postureAlerts: 0,
    wpm: 128,
    fillersPerMin: 0.3,
    fillers: ["um ×1"],
    longPauses: 0,
    overall: 89,
    star: {
      situation: { score: 90, note: "45-minute manual checklist blocked daily deploys." },
      task: { score: 89, note: "Build an automated smoke-test stage." },
      action: { score: 88, note: "Playwright checks in GitHub Actions with Slack alerts." },
      result: { score: 85, note: "Cut verification from 45 to 10 minutes (78%)." },
    },
    improvements: ["Strong answer — keep this structure as your template."],
    transcript:
      "Our manual 45-minute pre-deploy checklist was blocking daily releases. I containerized our smoke tests in GitHub Actions, cutting verification time by 78%, down to 10 minutes.",
  },
];

export const STAR_LABELS = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

