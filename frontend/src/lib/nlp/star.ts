import { splitSentences } from "./text";
import type { AnswerSentence, StarKey, StarSection } from "./types";

const labels: Record<StarKey, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };
const hints: Record<StarKey, string> = {
  situation: "Explain the background, challenge and context of the example.",
  task: "Describe your personal responsibility and objective.",
  action: "Describe the concrete steps you personally took and the tools you used.",
  result: "Explain the outcome and include measurable impact where possible.",
};
// These patterns are transparent heuristics, not a semantic model. Explicit outcome
// phrases take precedence over action verbs (e.g. 'we successfully completed').
const outcome = /\b(as a result|consequently|ultimately|in the end|the outcome|resulted in|led to|achieved|reduced|increased|saved|received (?:positive )?feedback|successfully (?:completed|delivered|resolved|launched)|(?:we|i) (?:successfully )?(?:completed|delivered|finished) (?:the|our|my) (?:project|application|solution)|\d+(?:\.\d+)?\s*%\s*(?:improvement|reduction|increase)|(?:response|processing|load) time (?:decreased|dropped|fell|improved)|(?:system|application|website) (?:became|was now) (?:faster|stable|operational))\b/i;
const responsibility = /\b(i was responsible|my (?:role|task|responsibility|objective|goal)|i (?:needed|had) to|i was (?:assigned|tasked)|the (?:goal|objective) was|my target|i was in charge|i was asked to)\b/i;
const personalAction = /\b(?:i|we)\s+(?:(?:also|then|personally|first|next|subsequently|carefully)\s+)*(?:started (?:by|with)|began (?:by|with)|debugg(?:ed|ing)|investigat(?:ed|ing)|identif(?:ied|ying)|creat(?:ed|ing)|built|develop(?:ed|ing)|implement(?:ed|ing)|design(?:ed|ing)|test(?:ed|ing)|fix(?:ed|ing)|resolv(?:ed|ing)|led|coordinat(?:ed|ing)|communicat(?:ed|ing)|discuss(?:ed|ing)|listen(?:ed|ing)|explain(?:ed|ing)|compar(?:ed|ing)|propos(?:ed|ing)|negotiat(?:ed|ing)|check(?:ed|ing)|review(?:ed|ing)|automat(?:ed|ing)|organiz(?:ed|ing)|optimiz(?:ed|ing)|analys(?:ed|ing)|analyz(?:ed|ing)|us(?:ed|ing)|work(?:ed|ing)|collaborat(?:ed|ing)|manag(?:ed|ing)|troubleshoot(?:ing)?|deploy(?:ed|ing)|wrote|configured|discover(?:ed|ing)|found|made|updated|refactor(?:ed|ing)|perform(?:ed|ing)|solv(?:ed|ing)|research(?:ed|ing)|monitor(?:ed|ing))\b/i;
const context = /\b(during|in my previous|in a previous|when i was|at the time|our team (?:was|had|developed|experienced)|the (?:project|company|system|website) (?:was|had|experienced)|there was|we (?:had|faced|experienced)|faced|experienced|working on|before the (?:presentation|launch))\b/i;
const actionVerb = /\b(?:debugged|investigated|identified|created|built|implemented|designed|tested|fixed|resolved|coordinated|checked|reviewed|automated|organized|optimized|optimised|analyzed|analysed|collaborated|troubleshot|deployed|configured|discovered|refactored|monitored)\b/i;

export function classifyStarSentence(sentence: string): StarKey | "unclassified" {
  if (outcome.test(sentence)) return "result";
  if (responsibility.test(sentence)) return "task";
  if (personalAction.test(sentence) || (/\b(?:i|we)\b/i.test(sentence) && actionVerb.test(sentence))) return "action";
  if (context.test(sentence)) return "situation";
  return "unclassified";
}

export function analyzeStar(answer: string): { sections: Record<StarKey, StarSection>; sentences: AnswerSentence[] } {
  const sentences: AnswerSentence[] = splitSentences(answer).map(text => ({ text, section: classifyStarSentence(text) }));
  const keys: StarKey[] = ["situation", "task", "action", "result"];
  const sections = {} as Record<StarKey, StarSection>;
  for (const key of keys) {
    const examples = sentences.filter(s => s.section === key).map(s => s.text);
    sections[key] = {
      found: examples.length > 0,
      sentences: examples,
      explanation: examples.length ? `Detected ${examples.length} ${labels[key].toLowerCase()} sentence${examples.length === 1 ? "" : "s"} based on language cues.` : `No clear ${labels[key].toLowerCase()} statement was detected.`,
      suggestion: examples.length ? (key === "result" ? "If possible, support the outcome with specific numbers or evidence." : `Your ${labels[key].toLowerCase()} is present; add detail if it helps explain your contribution.`) : hints[key],
    };
  }
  return { sections, sentences };
}
