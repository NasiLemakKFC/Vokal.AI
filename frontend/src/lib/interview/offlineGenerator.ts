import {
  extractSkillTerms,
  formatSkillLabel,
  matchesSkillTerm,
} from "@/lib/nlp/keywords";
import { PROFESSIONAL_KEYWORDS, ROLE_KEYWORDS } from "@/lib/nlp/taxonomy";
import { unique } from "@/lib/nlp/text";
import type {
  InterviewQuestion,
  PrepareInterviewRequest,
  PrepareInterviewResponse,
  ResumeTailorReport,
} from "./types";

interface RoleQuestionTemplate {
  prompt: string;
  keywords: string[];
  rationale: string;
}

const ROLE_QUESTION_TEMPLATES: Record<string, RoleQuestionTemplate[]> = {
  "Software Engineer": [
    {
      prompt:
        "Tell me about a challenging bug or system bottleneck you diagnosed across code or APIs. How did you isolate the root cause and verify the fix?",
      keywords: ["Debugging", "Root cause", "Testing", "Performance", "Measured result"],
      rationale: "Probes systematic problem solving and verification habits.",
    },
    {
      prompt:
        "Describe a project where you had to balance code quality, testing, and a tight delivery deadline. What trade-offs did you make?",
      keywords: ["Testing", "Code review", "Git", "Time management", "Outcome"],
      rationale: "Tests engineering judgment under real schedule pressure.",
    },
    {
      prompt:
        "Tell me about a feature or integration you built from scratch with a team. How did you align on APIs, data flow, and responsibilities?",
      keywords: ["API", "Database", "Collaboration", "System design", "Result"],
      rationale: "Evaluates technical ownership and cross-team communication.",
    },
    {
      prompt:
        "Describe a time you refactored messy code or automated a repetitive engineering workflow. What measurable improvement did it create?",
      keywords: ["Code quality", "Automation", "Validation", "Reliability", "Time saved"],
      rationale: "Measures initiative and maintainability mindset.",
    },
    {
      prompt:
        "Tell me about a technical decision or architecture trade-off you disagreed with on a team project. How did you discuss it and reach alignment?",
      keywords: ["Trade-offs", "Communication", "System design", "Collaboration", "Outcome"],
      rationale: "Assesses technical diplomacy and evidence-based reasoning.",
    },
    {
      prompt:
        "Describe a time you had to quickly learn an unfamiliar library, language, or infrastructure tool to unblock a deliverable.",
      keywords: ["Documentation", "Learning", "Debugging", "Adaptability", "Deliverables"],
      rationale: "Tests ramp-up speed and ownership under uncertainty.",
    },
  ],
  "Frontend Developer": [
    {
      prompt:
        "Tell me about a UI performance or responsiveness issue you solved in a web application. How did you measure the improvement?",
      keywords: ["Performance", "React", "Responsive design", "Debugging", "Metrics"],
      rationale: "Evaluates frontend optimization and user-centric debugging.",
    },
    {
      prompt:
        "Describe a time you built a complex interactive component or state flow while keeping accessibility and usability intact.",
      keywords: ["Accessibility", "UI", "JavaScript", "Testing", "User impact"],
      rationale: "Tests UI engineering craft and accessibility awareness.",
    },
    {
      prompt:
        "Tell me about a time design requirements changed late in a sprint or conflicted with backend API data. How did you handle it?",
      keywords: ["API", "Communication", "Trade-offs", "Collaboration", "Outcome"],
      rationale: "Checks adaptability and cross-functional collaboration.",
    },
    {
      prompt:
        "Describe a tricky cross-browser or mobile layout bug you tracked down. How did you reproduce it and prevent regressions?",
      keywords: ["CSS", "Debugging", "Responsive design", "Testing", "Reliability"],
      rationale: "Assesses frontend diagnostics and quality discipline.",
    },
    {
      prompt:
        "Tell me about a reusable component library or design pattern you introduced to help teammates build faster.",
      keywords: ["Design system", "TypeScript", "Code review", "Maintainability", "Time saved"],
      rationale: "Measures frontend architecture and team leverage.",
    },
  ],
  "Backend Developer": [
    {
      prompt:
        "Tell me about a slow database query or API endpoint you optimized. What bottlenecks did you uncover and what was the before-and-after impact?",
      keywords: ["API", "Database", "SQL", "Performance", "Measured result"],
      rationale: "Assesses backend diagnostics, indexing/query tuning, and metrics.",
    },
    {
      prompt:
        "Describe a time you had to safeguard an API or handle authentication, validation, or failure recovery reliably.",
      keywords: ["Authentication", "Security", "REST", "Testing", "Reliability"],
      rationale: "Evaluates defensive backend design and production readiness.",
    },
    {
      prompt:
        "Tell me about a breaking schema change or backend outage you helped resolve. How did you coordinate with teammates and prevent recurrence?",
      keywords: ["Debugging", "Database", "Server", "Communication", "Root cause"],
      rationale: "Tests incident handling and service ownership.",
    },
    {
      prompt:
        "Describe a time you designed a data model or API contract used by other developers. How did you handle edge cases and versioning?",
      keywords: ["System design", "API", "Database", "Documentation", "Collaboration"],
      rationale: "Checks API ergonomics and cross-team engineering thinking.",
    },
    {
      prompt:
        "Tell me about a concurrency, caching, or rate-limiting issue you diagnosed or planned for in a backend service.",
      keywords: ["Caching", "Concurrency", "Performance", "Monitoring", "Outcome"],
      rationale: "Probes scalability fundamentals and operational awareness.",
    },
  ],
  "Data Analyst": [
    {
      prompt:
        "Tell me about a messy or incomplete dataset you cleaned and analyzed. How did you ensure data accuracy before sharing findings?",
      keywords: ["Data cleaning", "SQL", "Python", "Validation", "Outcome"],
      rationale: "Evaluates data integrity habits and analytical rigor.",
    },
    {
      prompt:
        "Describe a dashboard or report you built that changed how a team or stakeholder made a decision.",
      keywords: ["Data visualization", "Dashboard", "Reporting", "Communication", "Impact"],
      rationale: "Checks storytelling with data and stakeholder clarity.",
    },
    {
      prompt:
        "Tell me about a time your analysis contradicted what a stakeholder expected. How did you present the evidence?",
      keywords: ["Analysis", "Statistics", "Stakeholder", "Communication", "Result"],
      rationale: "Tests objectivity and persuasive communication.",
    },
    {
      prompt:
        "Describe a recurring reporting task you automated using SQL, Python, or BI tools. What time or error reduction did it achieve?",
      keywords: ["SQL", "Python", "Automation", "Data quality", "Time saved"],
      rationale: "Measures analytical efficiency and automation mindset.",
    },
    {
      prompt:
        "Tell me about an ambiguous business question you translated into measurable KPIs and an actionable analysis.",
      keywords: ["KPI", "Problem solving", "Requirements", "Reporting", "Outcome"],
      rationale: "Evaluates structured problem framing.",
    },
  ],
  "AI / Machine Learning Engineer": [
    {
      prompt:
        "Tell me about an ML or NLP model that initially underperformed or overfit. How did you diagnose the data or feature pipeline to improve it?",
      keywords: ["Model training", "Feature engineering", "Evaluation", "Python", "Metrics"],
      rationale: "Evaluates iterative experimentation and error analysis.",
    },
    {
      prompt:
        "Describe a time you had to choose between model complexity, inference speed, and hardware or latency limits.",
      keywords: ["Performance", "Data preprocessing", "Evaluation", "Trade-offs", "Outcome"],
      rationale: "Tests practical ML deployment judgment.",
    },
    {
      prompt:
        "Tell me about an end-to-end AI project where you handled data collection, evaluation, and integration into an application.",
      keywords: ["Machine learning", "NLP", "Python", "API", "Impact"],
      rationale: "Checks full-lifecycle ML engineering capability.",
    },
    {
      prompt:
        "Describe a data quality, bias, or label imbalance issue you uncovered in a dataset and how you mitigated it.",
      keywords: ["Data cleaning", "Evaluation", "Validation", "Metrics", "Reliability"],
      rationale: "Assesses rigor around training data and model fairness.",
    },
    {
      prompt:
        "Tell me about a time you explained model limitations or failure modes to non-technical teammates or stakeholders.",
      keywords: ["Communication", "Evaluation", "Stakeholder", "Trade-offs", "Outcome"],
      rationale: "Checks practical AI communication and expectation setting.",
    },
  ],
  "UI/UX Designer": [
    {
      prompt:
        "Tell me about a time user research or usability testing revealed that your initial design confused users. How did you iterate?",
      keywords: ["Usability testing", "User research", "Prototype", "Iteration", "Outcome"],
      rationale: "Evaluates empathy, evidence-based iteration, and ego-free design.",
    },
    {
      prompt:
        "Describe a project where you simplified a complicated user journey under tight engineering or timeline constraints.",
      keywords: ["User journey", "Wireframe", "Figma", "Collaboration", "Impact"],
      rationale: "Tests UX prioritization and developer handoff.",
    },
    {
      prompt:
        "Tell me about how you balanced visual consistency and accessibility across screens or a shared design system.",
      keywords: ["Design system", "Accessibility", "Interaction design", "Feedback", "Result"],
      rationale: "Checks systematic thinking and inclusive design.",
    },
    {
      prompt:
        "Describe a time developers pushed back on a design due to technical feasibility. How did you collaborate on an alternative?",
      keywords: ["Collaboration", "Trade-offs", "Prototype", "Communication", "Outcome"],
      rationale: "Assesses cross-functional partnership and pragmatism.",
    },
    {
      prompt:
        "Tell me about a design decision you defended using user evidence or metrics rather than personal preference.",
      keywords: ["User research", "Evidence", "Metrics", "Stakeholder", "Impact"],
      rationale: "Measures research-driven design maturity.",
    },
  ],
  "QA Engineer": [
    {
      prompt:
        "Tell me about a critical defect that slipped close to release or required tricky reproduction steps. How did you isolate and document it?",
      keywords: ["Bug tracking", "Debugging", "Test cases", "Root cause", "Outcome"],
      rationale: "Evaluates structured investigation and clear bug reporting.",
    },
    {
      prompt:
        "Describe how you prioritized regression and automated test coverage when time before deployment was limited.",
      keywords: ["Regression testing", "Automation testing", "Quality assurance", "Risk", "Result"],
      rationale: "Tests risk-based QA planning.",
    },
    {
      prompt:
        "Tell me about a time you disagreed with a developer on whether an issue was a release blocker. How did you resolve it?",
      keywords: ["Communication", "API testing", "Evidence", "Collaboration", "Outcome"],
      rationale: "Checks constructive advocacy for quality.",
    },
    {
      prompt:
        "Describe a flaky test suite or manual QA bottleneck you improved to speed up release verification.",
      keywords: ["Automation testing", "CI/CD", "Reliability", "Validation", "Time saved"],
      rationale: "Evaluates QA engineering initiative and tooling skill.",
    },
    {
      prompt:
        "Tell me about an edge case you caught early during requirements or design review before code was even written.",
      keywords: ["Requirements", "Test planning", "Risk", "Communication", "Impact"],
      rationale: "Tests shift-left quality mindset.",
    },
  ],
  "Project Manager": [
    {
      prompt:
        "Tell me about a project whose scope or timeline shifted unexpectedly. How did you realign stakeholders and keep delivery on track?",
      keywords: ["Project planning", "Stakeholder", "Timeline", "Risk management", "Outcome"],
      rationale: "Evaluates planning, risk mitigation, and leadership.",
    },
    {
      prompt:
        "Describe a time two sub-teams or teammates had conflicting priorities that threatened a milestone. How did you resolve the bottleneck?",
      keywords: ["Team coordination", "Communication", "Conflict resolution", "Agile", "Result"],
      rationale: "Tests cross-team facilitation and alignment.",
    },
    {
      prompt:
        "Tell me about a risk you spotted early in a sprint or project and the concrete steps you took before it became an escalation.",
      keywords: ["Risk management", "Scrum", "Deliverables", "Planning", "Impact"],
      rationale: "Checks proactive ownership and execution discipline.",
    },
    {
      prompt:
        "Describe a time a project fell behind schedule and you had to negotiate scope or communicate a delay clearly.",
      keywords: ["Stakeholder", "Prioritization", "Trade-offs", "Communication", "Outcome"],
      rationale: "Measures transparent leadership under pressure.",
    },
    {
      prompt:
        "Tell me about a retrospective or process change you led that measurably improved how your team delivered.",
      keywords: ["Agile", "Process improvement", "Feedback", "Team coordination", "Metrics"],
      rationale: "Assesses continuous improvement and team leadership.",
    },
  ],
  General: [
    {
      prompt:
        "Tell me about a difficult problem you solved under a tight deadline. What steps did you personally take and what changed afterward?",
      keywords: ["Problem solving", "Time management", "Initiative", "Decision making", "Outcome"],
      rationale: "Assesses ownership, prioritization, and measurable results.",
    },
    {
      prompt:
        "Describe a disagreement or miscommunication in a team project and how you helped reach a practical resolution.",
      keywords: ["Communication", "Teamwork", "Conflict resolution", "Collaboration", "Result"],
      rationale: "Evaluates interpersonal maturity and teamwork.",
    },
    {
      prompt:
        "Tell me about a time you spotted a recurring inefficiency and took initiative to improve how your team worked.",
      keywords: ["Initiative", "Planning", "Process improvement", "Feedback", "Impact"],
      rationale: "Checks proactiveness and continuous improvement.",
    },
    {
      prompt:
        "Tell me about a time you had to learn an unfamiliar tool or domain quickly to deliver a project milestone.",
      keywords: ["Learning", "Adaptability", "Planning", "Problem solving", "Outcome"],
      rationale: "Measures learning agility and self-direction.",
    },
    {
      prompt:
        "Describe a time you received critical feedback on your work. How did you handle it and apply it afterward?",
      keywords: ["Feedback", "Ownership", "Growth", "Iteration", "Improvement"],
      rationale: "Evaluates coachability and accountability.",
    },
    {
      prompt:
        "Tell me about a time requirements changed unexpectedly midway through a project. How did you reprioritize?",
      keywords: ["Prioritization", "Adaptability", "Communication", "Stakeholder", "Result"],
      rationale: "Tests composure and structured planning under ambiguity.",
    },
    {
      prompt:
        "Describe a mistake or setback in a project you worked on. How did you take ownership and prevent it from happening again?",
      keywords: ["Accountability", "Root cause", "Recovery", "Reflection", "Outcome"],
      rationale: "Checks integrity, resilience, and reflection.",
    },
  ],
};

function clampQuestionCount(count?: number): number {
  if (typeof count !== "number" || Number.isNaN(count)) return 5;
  return Math.max(3, Math.min(7, Math.round(count)));
}

function buildTargetLabel(input: PrepareInterviewRequest): string {
  if (input.mode === "general") return "General Interview";
  const company = input.company.trim();
  const role = input.role.trim() || "Target Role";
  return company ? `${company} (${role})` : role;
}

export function buildOfflinePreparation(
  input: PrepareInterviewRequest
): Omit<PrepareInterviewResponse, "provider" | "model" | "fallbackReason"> {
  const questionCount = clampQuestionCount(input.questionCount);
  const variation = Math.max(0, Math.floor(input.variation ?? 0));
  const jdText = input.mode === "general" ? "" : input.jobDescription.trim();
  const resumeText = input.resumeText.trim();
  const hasResume = resumeText.length > 0;
  const hasJobDescription = jdText.length > 0;
  const targetLabel = buildTargetLabel(input);

  const roleTerms =
    input.mode === "general"
      ? PROFESSIONAL_KEYWORDS.slice(0, 10)
      : ROLE_KEYWORDS[input.role] ?? PROFESSIONAL_KEYWORDS.slice(0, 10);

  const jdTerms = hasJobDescription ? extractSkillTerms(jdText) : [];
  const targetTerms =
    jdTerms.length >= 3
      ? jdTerms.slice(0, 14)
      : unique([...jdTerms, ...roleTerms]).slice(0, 12);

  const resumeTerms = hasResume ? extractSkillTerms(resumeText) : [];
  const matchedTerms = hasResume
    ? targetTerms.filter((term) => matchesSkillTerm(resumeText, term))
    : [];
  const missingTerms = hasResume
    ? targetTerms.filter((term) => !matchesSkillTerm(resumeText, term))
    : targetTerms;

  const matchedSkills = matchedTerms.map(formatSkillLabel);
  const missingSkills = missingTerms.map(formatSkillLabel);

  let matchScore: number | null = null;
  let verdict: ResumeTailorReport["verdict"] = "Role Prep";
  let summary = "";
  const tailoringTips: string[] = [];

  if (hasResume) {
    matchScore = targetTerms.length
      ? Math.round((matchedTerms.length / targetTerms.length) * 100)
      : 65;
    verdict =
      matchScore >= 75
        ? "Strong Fit"
        : matchScore >= 45
          ? "Moderate Fit"
          : "Needs Tailoring";

    if (hasJobDescription) {
      summary = `Your resume matches ${matchedSkills.length} of ${targetTerms.length} extracted ${targetLabel} requirements (${matchScore}%).`;
    } else {
      summary = `Your resume covers ${matchedSkills.length} of ${targetTerms.length} core ${targetLabel} skills (${matchScore}%). Paste the job description for sharper alignment.`;
    }

    if (missingSkills.length > 0) {
      tailoringTips.push(
        `Address missing target terms if you have used them in coursework or projects: ${missingSkills.slice(0, 4).join(", ")}.`
      );
    }
    const hasMetrics =
      /\b\d+(?:\.\d+)?\s*(?:%|percent|ms|s|sec|seconds?|minutes?|hours?|days?|users?|requests?|x)\b/i.test(
        resumeText
      );
    if (!hasMetrics) {
      tailoringTips.push(
        "Add measurable outcomes to your project bullets (for example, % speed-up, latency reduction, or users supported)."
      );
    }
    if (hasJobDescription) {
      tailoringTips.push(
        `Mirror exact phrasing from the ${targetLabel} job description in your profile summary and top two projects.`
      );
    } else {
      tailoringTips.push(
        "Paste a real job description alongside your resume to check role-specific requirements before practicing."
      );
    }
  } else {
    summary = hasJobDescription
      ? `Prepared ${questionCount} behavioral questions targeting ${targetLabel} requirements. Upload or paste your resume to check tailoring gaps.`
      : `Prepared ${questionCount} behavioral questions for ${targetLabel}. Add a job description or resume to personalize further.`;
    tailoringTips.push(
      "Upload a PDF resume or paste your resume text to check JD alignment and generate resume-specific deep-dive questions."
    );
    if (!hasJobDescription && input.mode !== "general") {
      tailoringTips.push(
        `Paste the target ${input.role} job description so Keyword Coverage scores your answers against real hiring requirements.`
      );
    }
  }

  const questions: InterviewQuestion[] = [];
  const roleTemplates =
    input.mode === "general"
      ? ROLE_QUESTION_TEMPLATES.General
      : ROLE_QUESTION_TEMPLATES[input.role] ?? ROLE_QUESTION_TEMPLATES.General;

  // 1. Resume deep-dive question when resume is provided
  if (hasResume) {
    const deepDiveTerms = (matchedTerms.length ? matchedTerms : resumeTerms).slice(0, 3);
    const skillPair =
      deepDiveTerms.length >= 2
        ? `${formatSkillLabel(deepDiveTerms[0])} and ${formatSkillLabel(deepDiveTerms[1])}`
        : deepDiveTerms.length === 1
          ? formatSkillLabel(deepDiveTerms[0])
          : "your main technical stack";

    const deepDiveVariants = [
      `Your resume highlights ${skillPair}. Tell me about a specific project where you applied ${skillPair} for ${targetLabel} — what problem did you solve, what did you personally build, and what was the measurable result?`,
      `Looking at your resume experience with ${skillPair}, walk me through the toughest technical obstacle you encountered on that project and how you verified your solution.`,
    ];
    questions.push({
      id: `q-resume-${variation}`,
      type: "resume_deep_dive",
      prompt: deepDiveVariants[variation % deepDiveVariants.length],
      keywords: unique([
        ...deepDiveTerms.map(formatSkillLabel),
        "Problem solving",
        "Measured result",
      ]).slice(0, 5),
      rationale: `Probes real project ownership around ${skillPair} from your resume.`,
    });
  }

  // 2. JD / target gap question when missing skills exist
  if (hasResume && missingSkills.length > 0 && questions.length < questionCount) {
    const primaryGap = missingSkills[variation % Math.min(3, missingSkills.length)];
    const secondaryGap =
      missingSkills.length > 1
        ? missingSkills[(variation + 1) % Math.min(3, missingSkills.length)]
        : null;
    const gapFocus = secondaryGap ? `${primaryGap} and ${secondaryGap}` : primaryGap;

    const gapVariants = [
      `This ${targetLabel} role emphasizes ${gapFocus}, which is less visible on your resume. Tell me about a time you had to quickly learn and apply an unfamiliar skill or tool under a deadline — how would you ramp up on ${primaryGap}?`,
      `The job requirements call out ${gapFocus}. Describe a past situation where you bridged a knowledge gap in ${primaryGap} or a closely related area to deliver a project on time.`,
    ];
    questions.push({
      id: `q-gap-${variation}`,
      type: "jd_gap",
      prompt: gapVariants[variation % gapVariants.length],
      keywords: unique([
        primaryGap,
        ...(secondaryGap ? [secondaryGap] : []),
        "Learning",
        "Adaptability",
        "Outcome",
      ]).slice(0, 5),
      rationale: `Tests readiness and learning agility on target JD gap: ${primaryGap}.`,
    });
  } else if (!hasResume && hasJobDescription && jdTerms.length > 0) {
    const jdFocus = jdTerms
      .slice(0, 3)
      .map(formatSkillLabel)
      .join(", ");
    questions.push({
      id: `q-jd-${variation}`,
      type: "role_behavioral",
      prompt: `This ${targetLabel} description prioritizes ${jdFocus}. Tell me about a time you applied these skills to solve a challenging problem — what was your specific role and the final impact?`,
      keywords: unique([
        ...jdTerms.slice(0, 4).map(formatSkillLabel),
        "Measured result",
      ]).slice(0, 5),
      rationale: `Directly targets key requirements extracted from the job description.`,
    });
  }

  // 3. Fill remaining slots with rotated role-specific + general behavioral STAR questions
  const combinedPool =
    roleTemplates === ROLE_QUESTION_TEMPLATES.General
      ? roleTemplates
      : [...roleTemplates, ...ROLE_QUESTION_TEMPLATES.General];

  let offset = variation;
  let attempts = 0;
  while (questions.length < questionCount && attempts < combinedPool.length) {
    const tpl = combinedPool[offset % combinedPool.length];
    const alreadyExists = questions.some((q) => q.prompt === tpl.prompt);
    if (!alreadyExists) {
      questions.push({
        id: `q-role-${questions.length + 1}-${variation}`,
        type: "role_behavioral",
        prompt: tpl.prompt,
        keywords: tpl.keywords,
        rationale: tpl.rationale,
      });
    }
    offset += 1;
    attempts += 1;
  }

  return {
    tailorReport: {
      hasResume,
      hasJobDescription,
      matchScore,
      verdict,
      summary,
      matchedSkills: matchedSkills.slice(0, 12),
      missingSkills: missingSkills.slice(0, 10),
      tailoringTips: tailoringTips.slice(0, 4),
    },
    questions: questions.slice(0, questionCount),
  };
}
