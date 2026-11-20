/** Lightweight role vocabulary used by the transparent rule-based Module 3 analyzer. */
export const ROLE_KEYWORDS: Record<string, string[]> = {
  "Software Engineer": ["programming", "software development", "python", "java", "javascript", "typescript", "data structures", "algorithms", "debugging", "testing", "api", "database", "git", "problem solving", "code review", "system design"],
  "Frontend Developer": ["html", "css", "javascript", "typescript", "react", "next.js", "accessibility", "responsive design", "ui", "api", "testing", "performance", "git"],
  "Backend Developer": ["api", "rest", "node.js", "python", "java", "database", "sql", "authentication", "server", "microservices", "caching", "security", "testing", "debugging"],
  "Data Analyst": ["sql", "python", "excel", "power bi", "tableau", "data cleaning", "data visualization", "statistics", "reporting", "dashboard", "分析", "communication"],
  "AI / Machine Learning Engineer": ["python", "machine learning", "deep learning", "model training", "neural network", "tensorflow", "pytorch", "data preprocessing", "feature engineering", "evaluation", "nlp", "statistics"],
  "UI/UX Designer": ["figma", "wireframe", "prototype", "user research", "usability testing", "accessibility", "design system", "user journey", "interaction design", "visual design"],
  "QA Engineer": ["test cases", "manual testing", "automation testing", "regression testing", "bug tracking", "selenium", "api testing", "quality assurance", "debugging", "documentation"],
  "Project Manager": ["project planning", "stakeholder", "risk management", "budget", "timeline", "agile", "scrum", "communication", "team coordination", "deliverables"],
};
export const PROFESSIONAL_KEYWORDS = [
  "communication", "teamwork", "leadership", "problem solving", "critical thinking",
  "adaptability", "time management", "collaboration", "conflict resolution",
  "initiative", "decision making", "customer service", "achievement", "deadline",
  "responsibility", "planning", "organization", "feedback", "learning",
];
export const KEYWORD_LABELS: Record<string, string> = {
  "api": "API", "sql": "SQL", "ui": "UI", "nlp": "NLP", "html": "HTML",
  "css": "CSS", "git": "Git", "power bi": "Power BI", "next.js": "Next.js",
  "node.js": "Node.js", "machine learning": "Machine Learning",
};
