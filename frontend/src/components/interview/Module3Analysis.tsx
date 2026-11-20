"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeAnswer } from "@/lib/nlp/analyze";
import { extractJobDescriptionKeywords } from "@/lib/nlp/keywords";
import type { StarKey } from "@/lib/nlp/types";

const ROLES = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Data Analyst",
  "AI / Machine Learning Engineer", "UI/UX Designer", "QA Engineer", "Project Manager",
];
const STAR: { key: StarKey; letter: string; label: string }[] = [
  { key: "situation", letter: "S", label: "Situation" },
  { key: "task", letter: "T", label: "Task" },
  { key: "action", letter: "A", label: "Action" },
  { key: "result", letter: "R", label: "Result" },
];

interface Module3AnalysisProps {
  question: string;
  transcript?: string;
  onTranscriptChange?: (value: string) => void;
  onTargetChange?: (target: { mode: "company" | "role" | "general"; company: string; role: string; jobDescription: string }) => void;
}

export default function Module3Analysis({ question, transcript, onTranscriptChange, onTargetChange }: Module3AnalysisProps) {
  const [mode, setMode] = useState<"company" | "role" | "general">("role");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("Software Engineer");
  const [jobDescription, setJobDescription] = useState("");
  const [localTranscript, setLocalTranscript] = useState("");
  useEffect(() => { onTargetChange?.({ mode, company, role, jobDescription }); }, [mode, company, role, jobDescription, onTargetChange]);
  const answer = transcript ?? localTranscript;
  const updateAnswer = (value: string) => {
    setLocalTranscript(value);
    onTranscriptChange?.(value);
  };
  const analysis = useMemo(() => analyzeAnswer(answer, {
    role: mode === "role" || mode === "company" ? role : "",
    jobDescription: mode === "company" ? jobDescription : "",
    question,
  }), [answer, mode, role, jobDescription, question]);
  const jdKeywords = useMemo(() => extractJobDescriptionKeywords(jobDescription), [jobDescription]);
  const starCount = STAR.filter(({ key }) => analysis.star[key].found).length;
  const hasAnswer = answer.trim().length > 0;

  return (
    <section className="mt-6 space-y-4" aria-label="Module 3 NLP and STAR analysis">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1b6c80]">Module 03 · NLP</p>
          <h2 className="text-[19px] font-semibold text-[#131416]">Answer intelligence</h2>
          <p className="text-[13px] text-[#5d5f60] mt-1">Configure your target role, then review live STAR and keyword analysis.</p>
        </div>
        <span className="badge">Rule-based NLP · Live analysis</span>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-[14px]">Interview target</h3>
            <p className="text-[12px] text-[#5d5f60]">Company details are optional.</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-[7px] bg-[#f4f6f8] p-1">
            {([
              ["company", "Specific company"], ["role", "General job role"], ["general", "General interview"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMode(value)}
                className={`px-3 py-2 rounded-[5px] text-[12px] font-medium transition-colors ${mode === value ? "bg-white text-[#134e5e] shadow-sm" : "text-[#5d5f60] hover:text-[#131416]"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {mode !== "general" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mode === "company" && (
              <label className="text-[12px] font-medium text-[#45474a] space-y-1">
                Company name <span className="font-normal text-[#8b8d90]">(optional)</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Example Technologies" className="w-full h-10 rounded-[6px] border border-[#cdced1] px-3 text-[13px] text-[#131416] outline-none focus:border-[#1b6c80]" />
              </label>
            )}
            <label className="text-[12px] font-medium text-[#45474a] space-y-1">
              Job role
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-10 rounded-[6px] border border-[#cdced1] bg-white px-3 text-[13px] text-[#131416] outline-none focus:border-[#1b6c80]">
                {ROLES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
        )}
        {mode === "company" && (
          <div className="space-y-2">
            <label className="block text-[12px] font-medium text-[#45474a]" htmlFor="module3-jd">Job description <span className="font-normal text-[#8b8d90]">(optional)</span></label>
            <textarea id="module3-jd" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={4} placeholder="Paste the job description to extract relevant skills and requirements..." className="w-full rounded-[6px] border border-[#cdced1] p-3 text-[13px] text-[#131416] outline-none focus:border-[#1b6c80] resize-y" />
            {jdKeywords.length > 0 && (
              <div className="rounded-[6px] bg-[#f9fbfc] border border-[#e8eaec] p-3">
                <p className="text-[11px] font-semibold text-[#5d5f60] mb-2">EXTRACTED JOB DESCRIPTION KEYWORDS · {jdKeywords.length}</p>
                <div className="flex flex-wrap gap-1.5">{jdKeywords.map((word) => <span key={word} className="badge">{word}</span>)}</div>
              </div>
            )}
          </div>
        )}
        {mode === "general" && <p className="text-[12px] text-[#5d5f60] bg-[#f9fbfc] rounded-[6px] p-3">General interview mode uses professional skills and STAR structure. No company or role is required.</p>}
        {mode === "company" && company.trim() && <p className="text-[11px] text-[#5d5f60]">Preparing for {company.trim()} · {role}</p>}
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between items-center gap-2">
          <div>
            <h3 className="font-semibold text-[14px]">Your answer transcript</h3>
            <p className="text-[12px] text-[#5d5f60]">Updates automatically as transcript text changes.</p>
          </div>
          <span className="badge">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</span>
        </div>
        <textarea value={answer} onChange={(e) => updateAnswer(e.target.value)} rows={5} placeholder="Your Module 2 speech-to-text transcript will appear here. You can also paste or type an answer to analyse it..." className="w-full rounded-[6px] border border-[#cdced1] p-3 text-[13px] leading-relaxed text-[#131416] outline-none focus:border-[#1b6c80] resize-y" />
        <p className="text-[11px] text-[#8b8d90]">Integration: pass Module 2 transcript text through the transcript prop and update it with onTranscriptChange.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-[12px] text-[#5d5f60]">STAR completion</p>
          <div className="flex items-end gap-2 mt-1"><strong className="text-[28px] tabular-nums">{starCount}/4</strong><span className="text-[12px] text-[#5d5f60] pb-1">sections detected</span></div>
          <div className="h-2 rounded-full bg-[#ebedee] overflow-hidden mt-3"><div className="h-full bg-[#1b6c80] rounded-full transition-all" style={{ width: `${starCount * 25}%` }} /></div>
        </div>
        <div className="card">
          <p className="text-[12px] text-[#5d5f60]">Keyword coverage</p>
          <div className="flex items-end gap-2 mt-1"><strong className="text-[28px] tabular-nums">{analysis.coverage}%</strong><span className="text-[12px] text-[#5d5f60] pb-1">matched</span></div>
          <p className="text-[11px] text-[#5d5f60] mt-3">{analysis.matchedCount} matched out of {analysis.matchedCount + analysis.missingCount} target keywords.</p>
        </div>
        <div className="card">
          <p className="text-[12px] text-[#5d5f60]">Keyword gaps</p>
          <div className="flex items-end gap-2 mt-1"><strong className="text-[28px] tabular-nums">{analysis.missingCount}</strong><span className="text-[12px] text-[#5d5f60] pb-1">not mentioned</span></div>
          <p className="text-[11px] text-[#5d5f60] mt-3">Potentially relevant terms absent from this answer.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-semibold text-[14px]">STAR checklist</h3><span className="text-[11px] text-[#5d5f60]">{starCount} of 4 found</span></div>
          {STAR.map(({ key, letter, label }) => {
            const section = analysis.star[key];
            return <div key={key} className="border border-[#e8eaec] rounded-[6px] p-3">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${section.found ? "bg-[#dcfae5] text-[#04250e]" : "bg-[#ffedea] text-[#831c1e]"}`}>{letter}</span>
                <strong className="text-[13px]">{label}</strong>
                <span className={`ml-auto text-[11px] font-medium ${section.found ? "text-[#1e7b4f]" : "text-[#c4242a]"}`}>{section.found ? "Found" : "Missing"}</span>
              </div>
              <p className="text-[12px] text-[#5d5f60] mt-2">{section.explanation}</p>
              <p className="text-[12px] text-[#134e5e] mt-1">{section.suggestion}</p>
              {section.sentences.length > 0 && <ul className="mt-2 space-y-1">{section.sentences.map((s, i) => <li key={i} className="text-[11px] text-[#45474a] border-l-2 border-[#1b6c80] pl-2">{s}</li>)}</ul>}
            </div>;
          })}
        </div>
        <div className="card space-y-3">
          <h3 className="font-semibold text-[14px]">Keyword analysis</h3>
          <p className="text-[11px] text-[#5d5f60]">Coverage = unique matched target skills ÷ unique relevant target skills. With a job description, its explicit requirements take priority; additional demonstrated role skills are shown separately. Synonyms are supported, but this is not an answer-quality score.</p>
          {analysis.keywordGroups.map((group) => <div key={group.category} className="border-t border-[#f0f1f2] pt-3 first:border-0 first:pt-0">
            <p className="text-[12px] font-semibold mb-2">{group.label}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#1e7b4f] font-semibold mb-1">Matched · {group.matched.length}</p>
            <div className="flex flex-wrap gap-1 mb-2">{group.matched.length ? group.matched.map((kw) => <span key={kw} className="pill-positive">{kw}</span>) : <span className="text-[11px] text-[#8b8d90]">No target terms found yet.</span>}</div>
            <p className="text-[10px] uppercase tracking-wide text-[#c4242a] font-semibold mb-1">Missing · {group.missing.length}</p>
            <div className="flex flex-wrap gap-1">{group.missing.length ? group.missing.map((kw) => <span key={kw} className="pill-negative">{kw}</span>) : <span className="text-[11px] text-[#8b8d90]">No missing terms in this category.</span>}</div>
          </div>)}
        </div>
      </div>

      <div className="card space-y-3">
        <div><h3 className="font-semibold text-[14px]">Answer breakdown</h3><p className="text-[12px] text-[#5d5f60]">Each sentence is classified using wording and context cues.</p></div>
        {!hasAnswer ? <p className="text-[12px] text-[#8b8d90] py-2">Add a transcript to see sentence-by-sentence classification.</p> :
          <div className="space-y-2">{analysis.sentences.map((item, index) => {
            const name = item.section === "unclassified" ? "Not classified" : STAR.find((s) => s.key === item.section)?.label;
            const style = item.section === "situation" ? "border-[#2f70bb] bg-[#eff6ff]" : item.section === "task" ? "border-[#a86f0c] bg-[#fffbeb]" : item.section === "action" ? "border-[#1b6c80] bg-[#eef4f6]" : item.section === "result" ? "border-[#1e7b4f] bg-[#effaf3]" : "border-[#cdced1] bg-[#f9fbfc]";
            return <div key={index} className={`rounded-[6px] border-l-[3px] p-3 ${style}`}><div className="text-[10px] font-semibold uppercase tracking-wide mb-1">{name}</div><p className="text-[13px] text-[#25272a]">{item.text}</p></div>;
          })}</div>}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold text-[14px]">Personalised coaching</h3>
        {!hasAnswer ? <p className="text-[12px] text-[#5d5f60]">Coaching suggestions will appear once an answer is provided.</p> :
          <ul className="space-y-2">{analysis.coaching.map((tip, index) => <li key={index} className="flex gap-2 text-[13px] text-[#45474a]"><span className="text-[#1b6c80]">•</span><span>{tip}</span></li>)}</ul>}
      </div>
      <p className="text-[11px] leading-relaxed text-[#8b8d90]">Analysis note: this module uses transparent, rule-based keyword matching and sentence-pattern heuristics. It does not understand meaning like a trained language model; wording variations, implied STAR elements, and synonyms may be missed or misclassified. Treat results as coaching guidance, not an automated hiring score.</p>
    </section>
  );
}
