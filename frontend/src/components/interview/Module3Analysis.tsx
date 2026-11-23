"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeAnswer } from "@/lib/nlp/analyze";
import { extractJobDescriptionKeywords } from "@/lib/nlp/keywords";
import { INTERVIEW_ROLES, type InterviewTarget } from "@/lib/interview/types";
import type { AnswerAnalysis, StarKey } from "@/lib/nlp/types";

const STAR: { key: StarKey; letter: string; label: string }[] = [
  { key: "situation", letter: "S", label: "Situation" },
  { key: "task", letter: "T", label: "Task" },
  { key: "action", letter: "A", label: "Action" },
  { key: "result", letter: "R", label: "Result" },
];

interface Module3AnalysisProps {
  question: string;
  questionKeywords?: string[];
  target?: InterviewTarget;
  hideTargetConfig?: boolean;
  transcript?: string;
  /** Optional pre-computed NLP analysis from parent to avoid duplicate evaluation on render. */
  precomputedAnalysis?: AnswerAnalysis;
  /** When true, wraps the panel in a collapsible drawer (closed by default to keep camera above the fold). */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onTranscriptChange?: (value: string) => void;
  onTargetChange?: (target: InterviewTarget) => void;
}

export default function Module3Analysis({
  question,
  questionKeywords,
  target,
  hideTargetConfig = false,
  transcript,
  precomputedAnalysis,
  collapsible = false,
  defaultExpanded = false,
  onTranscriptChange,
  onTargetChange,
}: Module3AnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [localMode, setLocalMode] = useState<"company" | "role" | "general">("role");
  const [localCompany, setLocalCompany] = useState("");
  const [localRole, setLocalRole] = useState("Software Engineer");
  const [localJobDescription, setLocalJobDescription] = useState("");
  const [localTranscript, setLocalTranscript] = useState("");

  const mode = target ? target.mode : localMode;
  const company = target ? target.company : localCompany;
  const role = target ? target.role : localRole;
  const jobDescription = target ? target.jobDescription : localJobDescription;

  useEffect(() => {
    if (!target) {
      onTargetChange?.({
        mode: localMode,
        company: localCompany,
        role: localRole,
        jobDescription: localJobDescription,
      });
    }
  }, [target, localMode, localCompany, localRole, localJobDescription, onTargetChange]);

  const answer = transcript ?? localTranscript;
  const updateAnswer = (value: string) => {
    setLocalTranscript(value);
    onTranscriptChange?.(value);
  };
  const analysis = useMemo(
    () =>
      precomputedAnalysis ??
      analyzeAnswer(answer, {
        role: mode === "role" || mode === "company" ? role : "",
        jobDescription: mode !== "general" ? jobDescription : "",
        question,
        questionKeywords,
      }),
    [precomputedAnalysis, answer, mode, role, jobDescription, question, questionKeywords]
  );
  const jdKeywords = useMemo(
    () => (mode !== "general" ? extractJobDescriptionKeywords(jobDescription) : []),
    [mode, jobDescription]
  );
  const starCount = STAR.filter(({ key }) => analysis.star[key].found).length;
  const hasAnswer = answer.trim().length > 0;
  const wordCount = hasAnswer ? answer.trim().split(/\s+/).length : 0;

  const panelBody = (
    <div className={collapsible ? "border-t border-[var(--border)] p-4 space-y-4" : "space-y-4"}>
      {!collapsible && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-medium text-[var(--text)]">Answer intelligence</h2>
            <p className="text-[13px] text-[var(--muted)] mt-1">
              {hideTargetConfig
                ? "Live STAR structure and target keyword coverage for your current answer"
                : "Configure your target role, then review live STAR and keyword analysis"}
            </p>
          </div>
          <span className="text-[12px] font-mono text-[var(--muted)]">Live STAR &amp; keyword analysis</span>
        </div>
      )}

      {hideTargetConfig ? (
        <div className="card !py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text)]">Active target:</span>
            <span className="badge">
              {mode === "general"
                ? "General Interview"
                : company.trim()
                  ? `${company.trim()} · ${role}`
                  : role}
            </span>
            {jdKeywords.length > 0 && (
              <span className="text-[12px] text-[var(--muted)] font-mono tabular-nums">
                · {jdKeywords.length} job description skills tracked
              </span>
            )}
          </div>
          <span className="text-[12px] text-[var(--muted)]">
            Change target or resume in the setup panel above
          </span>
        </div>
      ) : (
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-medium text-[14px] text-[var(--text)]">Interview target</h3>
              <p className="text-[12px] text-[var(--muted)]">Company details are optional</p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-[var(--raised)] p-1 border border-[var(--border)]">
              {([
                ["company", "Specific company"], ["role", "General job role"], ["general", "General interview"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setLocalMode(value)}
                  className={`h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium transition-colors cursor-pointer ${mode === value ? "bg-[var(--surface)] text-[var(--accent-ink)] border border-[var(--border)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {mode !== "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mode === "company" && (
                <label className="text-[12px] font-medium text-[var(--text-secondary)] space-y-1">
                  Company name <span className="font-normal text-[var(--subtle)]">(optional)</span>
                  <input value={company} onChange={(e) => setLocalCompany(e.target.value)} placeholder="e.g. Example Technologies" className="input-field w-full h-9 px-3 text-[13px]" />
                </label>
              )}
              <label className="text-[12px] font-medium text-[var(--text-secondary)] space-y-1">
                Job role
                <select value={role} onChange={(e) => setLocalRole(e.target.value)} className="input-field w-full h-9 px-3 text-[13px]">
                  {INTERVIEW_ROLES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          )}
          {mode !== "general" && (
            <div className="space-y-2">
              <label className="block text-[12px] font-medium text-[var(--text-secondary)]" htmlFor="module3-jd">Job description <span className="font-normal text-[var(--subtle)]">(optional)</span></label>
              <textarea id="module3-jd" value={jobDescription} onChange={(e) => setLocalJobDescription(e.target.value)} rows={4} placeholder="Paste the job description to extract relevant skills and requirements" className="input-field w-full p-3 text-[13px] resize-y" />
              {jdKeywords.length > 0 && (
                <div className="rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)] p-3">
                  <p className="text-[12px] font-medium text-[var(--muted)] mb-2">Extracted job description keywords · {jdKeywords.length}</p>
                  <div className="flex flex-wrap gap-1.5">{jdKeywords.map((word) => <span key={word} className="badge">{word}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {mode === "general" && <p className="text-[12px] text-[var(--muted)] bg-[var(--raised)] rounded-[var(--radius-control)] p-3">General interview mode uses professional skills and STAR structure. No company or role is required.</p>}
          {mode === "company" && company.trim() && <p className="text-[12px] text-[var(--muted)]">Preparing for {company.trim()} · {role}</p>}
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex justify-between items-center gap-2">
          <div>
            <h3 className="font-medium text-[14px] text-[var(--text)]">Your answer transcript</h3>
            <p className="text-[12px] text-[var(--muted)]">Updates automatically as transcript text changes</p>
          </div>
          <span className="text-[12px] font-mono tabular-nums text-[var(--muted)]">{wordCount} words</span>
        </div>
        <textarea value={answer} onChange={(e) => updateAnswer(e.target.value)} rows={5} placeholder="Your spoken transcript will appear here. You can also paste or edit an answer to test STAR coverage" className="input-field w-full p-3 text-[13px] leading-relaxed resize-y" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card p-4">
          <p className="text-[13px] text-[var(--muted)]">STAR completion</p>
          <div className="flex items-baseline gap-2 mt-2"><strong className="text-[28px] font-medium text-[var(--text)] tabular-nums leading-none">{starCount}/4</strong><span className="text-[12px] text-[var(--muted)]">sections detected</span></div>
          <div className="h-1.5 rounded-full bg-[var(--ring-track)] overflow-hidden mt-3"><div className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-200" style={{ width: `${starCount * 25}%` }} /></div>
        </div>
        <div className="kpi-card p-4">
          <p className="text-[13px] text-[var(--muted)]">Keyword coverage</p>
          <div className="flex items-baseline gap-2 mt-2"><strong className="text-[28px] font-medium text-[var(--text)] tabular-nums leading-none">{analysis.coverage}%</strong><span className="text-[12px] text-[var(--muted)]">matched</span></div>
          <p className="text-[12px] text-[var(--muted)] mt-3">{analysis.matchedCount} matched of {analysis.matchedCount + analysis.missingCount} target keywords</p>
        </div>
        <div className="kpi-card p-4">
          <p className="text-[13px] text-[var(--muted)]">Keyword gaps</p>
          <div className="flex items-baseline gap-2 mt-2"><strong className="text-[28px] font-medium text-[var(--text)] tabular-nums leading-none">{analysis.missingCount}</strong><span className="text-[12px] text-[var(--muted)]">not mentioned</span></div>
          <p className="text-[12px] text-[var(--muted)] mt-3">Target terms absent from this answer</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-medium text-[14px] text-[var(--text)]">STAR checklist</h3><span className="text-[12px] font-mono tabular-nums text-[var(--muted)]">{starCount} of 4 found</span></div>
          {STAR.map(({ key, letter, label }) => {
            const section = analysis.star[key];
            return <div key={key} className="border border-[var(--border)] bg-[var(--raised)]/40 rounded-[var(--radius-control)] p-3">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium ${section.found ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]" : "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]"}`}>{letter}</span>
                <strong className="text-[13px] font-medium text-[var(--text)]">{label}</strong>
                <span className={`ml-auto text-[12px] font-medium ${section.found ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>{section.found ? "Found" : "Missing"}</span>
              </div>
              <p className="text-[12px] text-[var(--muted)] mt-2">{section.explanation}</p>
              <p className="text-[12px] text-[var(--accent-ink)] mt-1">{section.suggestion}</p>
              {section.sentences.length > 0 && <ul className="mt-2 space-y-1">{section.sentences.map((s, i) => <li key={i} className="text-[12px] text-[var(--text-secondary)] border-l-2 border-[var(--accent)] pl-2">{s}</li>)}</ul>}
            </div>;
          })}
        </div>
        <div className="card space-y-3">
          <h3 className="font-medium text-[14px] text-[var(--text)]">Keyword analysis</h3>
          <p className="text-[12px] text-[var(--muted)]">Coverage reflects unique matched target skills out of relevant target skills. Synonyms are supported for coaching guidance.</p>
          {analysis.keywordGroups.map((group) => <div key={group.category} className="border-t border-[var(--rule)] pt-3 first:border-0 first:pt-0">
            <p className="text-[13px] font-medium text-[var(--text)] mb-2">{group.label}</p>
            <p className="text-[12px] text-[var(--positive)] font-medium mb-1.5">Matched · {group.matched.length}</p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">{group.matched.length ? group.matched.map((kw) => <span key={kw} className="pill-positive">{kw}</span>) : <span className="text-[12px] text-[var(--subtle)]">No target terms found yet</span>}</div>
            <p className="text-[12px] text-[var(--negative)] font-medium mb-1.5">Missing · {group.missing.length}</p>
            <div className="flex flex-wrap gap-1.5">{group.missing.length ? group.missing.map((kw) => <span key={kw} className="pill-negative">{kw}</span>) : <span className="text-[12px] text-[var(--subtle)]">No missing terms in this category</span>}</div>
          </div>)}
        </div>
      </div>

      <div className="card space-y-3">
        <div><h3 className="font-medium text-[14px] text-[var(--text)]">Answer breakdown</h3><p className="text-[12px] text-[var(--muted)]">Each sentence is classified using wording and context cues</p></div>
        {!hasAnswer ? <p className="text-[12px] text-[var(--subtle)] py-2">Add a transcript to see sentence-by-sentence classification</p> :
          <div className="space-y-2">{analysis.sentences.map((item, index) => {
            const name = item.section === "unclassified" ? "Not classified" : STAR.find((s) => s.key === item.section)?.label;
            const style =
              item.section === "situation"
                ? "border-[var(--star-s-border)] bg-[var(--star-s-bg)]"
                : item.section === "task"
                  ? "border-[var(--star-t-border)] bg-[var(--star-t-bg)]"
                  : item.section === "action"
                    ? "border-[var(--star-a-border)] bg-[var(--star-a-bg)]"
                    : item.section === "result"
                      ? "border-[var(--star-r-border)] bg-[var(--star-r-bg)]"
                      : "border-[var(--control)] bg-[var(--raised)]";
            return <div key={index} className={`rounded-[var(--radius-control)] border-l-[3px] p-3 ${style}`}><div className="text-[12px] font-medium text-[var(--muted)] mb-1">{name}</div><p className="text-[13px] text-[var(--text)]">{item.text}</p></div>;
          })}</div>}
      </div>

      <div className="card space-y-3">
        <h3 className="font-medium text-[14px] text-[var(--text)]">Personalised coaching</h3>
        {!hasAnswer ? <p className="text-[12px] text-[var(--muted)]">Coaching suggestions appear once an answer is provided</p> :
          <ul className="space-y-2">{analysis.coaching.map((tip, index) => <li key={index} className="flex gap-2 text-[13px] text-[var(--text-secondary)]"><span className="text-[var(--muted)]">•</span><span>{tip}</span></li>)}</ul>}
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--subtle)]">Analysis note: this uses rule-based keyword matching and sentence heuristics for coaching guidance, not an automated hiring score.</p>
    </div>
  );

  if (!collapsible) {
    return (
      <section className="mt-6" aria-label="NLP and STAR analysis">
        {panelBody}
      </section>
    );
  }

  return (
    <section
      className="mt-4 card !p-0 overflow-hidden"
      aria-label="NLP and STAR analysis"
    >
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[var(--raised)]/60">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
        >
          <span className="material-symbols-outlined text-[18px] text-[var(--muted)] shrink-0">
            psychology
          </span>
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              Transcript &amp; live NLP analysis
            </span>
            <span className="text-[12px] font-mono tabular-nums text-[var(--muted)]">
              STAR {starCount}/4 · Keywords {analysis.coverage}% ·{" "}
              {hasAnswer ? `${wordCount} words` : "Type or paste transcript"}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="btn-secondary h-8 px-3 text-[12px] font-medium flex items-center gap-1 cursor-pointer shrink-0"
        >
          {isExpanded ? "Hide drawer" : "Open drawer"}
          <span className="material-symbols-outlined text-[16px] text-[var(--muted)]">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {isExpanded && panelBody}
    </section>
  );
}
