"use client";

import { useMemo, useRef, useState } from "react";
import { extractJobDescriptionKeywords } from "@/lib/nlp/keywords";
import {
  INTERVIEW_ROLES,
  type AiProviderUsed,
  type InterviewQuestion,
  type InterviewQuestionType,
  type InterviewTarget,
  type InterviewTargetMode,
  type ResumeTailorReport,
} from "@/lib/interview/types";

export interface SessionSetupCardProps {
  target: InterviewTarget;
  onTargetChange: (next: InterviewTarget) => void;
  resumeText: string;
  resumeFileName: string | null;
  onResumeChange: (text: string, fileName: string | null) => void;
  questions: InterviewQuestion[];
  isTailored: boolean;
  isSameInputsAsLastPrep?: boolean;
  activeQuestionIndex: number;
  onSelectQuestion: (idx: number) => void;
  tailorReport: ResumeTailorReport | null;
  prepMeta: {
    provider: AiProviderUsed;
    model: string;
    fallbackReason?: string;
  } | null;
  isGenerating: boolean;
  generateError: string | null;
  hasRecordedDrafts: boolean;
  recordedCount: number;
  disabled: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onGenerate: (options?: { forceRegenerate?: boolean }) => void;
  onResetDefaults: () => void;
}

const PROVIDER_LABELS: Record<AiProviderUsed, string> = {
  groq: "Groq",
  gemini: "Gemini",
  ollama: "Ollama",
  offline: "Offline NLP",
};

const QUESTION_TYPE_LABELS: Record<InterviewQuestionType, string> = {
  resume_deep_dive: "Resume deep-dive",
  jd_gap: "JD gap",
  role_behavioral: "Role behavioral",
};

function fitPillClass(report: ResumeTailorReport): string {
  if (!report.hasResume || report.matchScore === null) return "badge";
  if (report.matchScore >= 75) return "pill-positive";
  if (report.matchScore >= 45) return "pill-warning";
  return "pill-negative";
}

function targetSummaryLabel(target: InterviewTarget): string {
  if (target.mode === "general") return "General Interview";
  if (target.mode === "company" && target.company.trim()) {
    return `${target.company.trim()} · ${target.role}`;
  }
  return target.role;
}

export default function SessionSetupCard({
  target,
  onTargetChange,
  resumeText,
  resumeFileName,
  onResumeChange,
  questions,
  isTailored,
  isSameInputsAsLastPrep = false,
  activeQuestionIndex,
  onSelectQuestion,
  tailorReport,
  prepMeta,
  isGenerating,
  generateError,
  hasRecordedDrafts,
  recordedCount,
  disabled,
  isExpanded,
  onToggleExpanded,
  onGenerate,
  onResetDefaults,
}: SessionSetupCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeTab, setResumeTab] = useState<"pdf" | "paste">("pdf");
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    null | { kind: "generate"; forceRegenerate: boolean } | { kind: "reset" }
  >(null);

  const jdKeywords = useMemo(
    () =>
      target.mode === "general"
        ? []
        : extractJobDescriptionKeywords(target.jobDescription),
    [target.mode, target.jobDescription]
  );

  const hasResume = resumeText.trim().length > 0;
  const resumeWordCount = hasResume ? resumeText.trim().split(/\s+/).length : 0;

  const updateTarget = (patch: Partial<InterviewTarget>) => {
    setPendingAction(null);
    onTargetChange({ ...target, ...patch });
  };

  const handleModeChange = (mode: InterviewTargetMode) => {
    updateTarget({ mode });
  };

  const handlePdfUpload = async (file: File | undefined) => {
    if (!file) return;
    setPdfError(null);

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setPdfError("Please select a .pdf file, or switch to Paste text");
      return;
    }

    setIsParsingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/interview/parse-resume", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        text?: string;
        pageCount?: number;
        fileName?: string;
        detail?: string;
      };
      if (!res.ok || !data.text) {
        setPdfError(
          data.detail || "Could not extract text from this PDF. Try Paste text instead"
        );
        return;
      }
      setPdfPageCount(typeof data.pageCount === "number" ? data.pageCount : null);
      setPendingAction(null);
      onResumeChange(data.text, data.fileName || file.name);
    } catch {
      setPdfError("Failed to upload PDF for parsing. Check your local server or paste text");
    } finally {
      setIsParsingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearResume = () => {
    setPdfError(null);
    setPdfPageCount(null);
    setPendingAction(null);
    onResumeChange("", null);
  };

  const triggerGenerate = (forceRegenerate: boolean) => {
    if (disabled || isGenerating || isParsingPdf) return;
    if (hasRecordedDrafts) {
      setPendingAction({ kind: "generate", forceRegenerate });
      return;
    }
    setPendingAction(null);
    onGenerate({ forceRegenerate });
  };

  const triggerReset = () => {
    if (disabled || isGenerating) return;
    if (hasRecordedDrafts) {
      setPendingAction({ kind: "reset" });
      return;
    }
    setPendingAction(null);
    onResetDefaults();
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.kind === "generate") {
      onGenerate({ forceRegenerate: action.forceRegenerate });
    } else {
      onResetDefaults();
    }
  };

  const resumeStatusLabel =
    tailorReport?.hasResume && tailorReport.matchScore !== null
      ? `${tailorReport.matchScore}% match`
      : hasResume
        ? resumeFileName || "Resume loaded"
        : "No resume";

  const questionStatusLabel =
    isTailored && prepMeta
      ? `Tailored ${questions.length}Q (${PROVIDER_LABELS[prepMeta.provider]})`
      : `Default ${questions.length}Q`;

  return (
    <section
      aria-label="Interview setup and resume tailoring check"
      className="card !p-0 mb-4 overflow-hidden"
    >
      {/* Collapsible Header Bar */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[var(--raised)]/60">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
        >
          <span className="material-symbols-outlined text-[18px] text-[var(--muted)] shrink-0">
            tune
          </span>
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              Interview setup &amp; resume check
            </span>
            <span className="text-[12px] text-[var(--muted)] font-mono tabular-nums truncate">
              {targetSummaryLabel(target)} · {resumeStatusLabel} · {questionStatusLabel}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          className="btn-secondary h-8 px-3 text-[12px] font-medium flex items-center gap-1 cursor-pointer shrink-0"
        >
          {isExpanded ? "Hide setup" : "Configure"}
          <span className="material-symbols-outlined text-[16px] text-[var(--muted)]">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-[var(--border)] p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Job Target */}
            <div className="lg:col-span-6 space-y-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)]/50 p-4">
              <div>
                <h2 className="text-[14px] font-medium text-[var(--text)]">
                  1. Target role &amp; job description
                </h2>
                <p className="text-[12px] text-[var(--muted)] mt-0.5">
                  Tailors questions and keyword feedback for your target role
                </p>
              </div>

              {/* Mode Selector */}
              <div className="flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-[var(--active)]/80 p-1">
                {(
                  [
                    ["company", "Specific company"],
                    ["role", "General job role"],
                    ["general", "General interview"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleModeChange(value)}
                    className={`h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      target.mode === value
                        ? "bg-[var(--surface)] text-[var(--accent-ink)]"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {target.mode !== "general" ? (
                <div className="space-y-3">
                  <div
                    className={`grid grid-cols-1 ${
                      target.mode === "company" ? "sm:grid-cols-2" : ""
                    } gap-3`}
                  >
                    {target.mode === "company" && (
                      <label className="text-[12px] font-medium text-[var(--text-secondary)] space-y-1 block">
                        Company name{" "}
                        <span className="font-normal text-[var(--subtle)]">(optional)</span>
                        <input
                          value={target.company}
                          disabled={disabled}
                          onChange={(e) => updateTarget({ company: e.target.value })}
                          placeholder="e.g. Grab, Petronas Digital"
                          className="input-field w-full h-9 px-3 text-[13px] disabled:opacity-60"
                        />
                      </label>
                    )}

                    <label className="text-[12px] font-medium text-[var(--text-secondary)] space-y-1 block">
                      Job role
                      <select
                        value={target.role}
                        disabled={disabled}
                        onChange={(e) => updateTarget({ role: e.target.value })}
                        className="input-field w-full h-9 px-3 text-[13px] disabled:opacity-60"
                      >
                        {INTERVIEW_ROLES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="setup-jd-input"
                        className="text-[12px] font-medium text-[var(--text-secondary)]"
                      >
                        Job description{" "}
                        <span className="font-normal text-[var(--subtle)]">
                          (paste JD requirements)
                        </span>
                      </label>
                      {jdKeywords.length > 0 && (
                        <span className="text-[12px] font-medium text-[var(--accent-ink)] font-mono tabular-nums">
                          {jdKeywords.length} skills detected
                        </span>
                      )}
                    </div>
                    <textarea
                      id="setup-jd-input"
                      value={target.jobDescription}
                      disabled={disabled}
                      onChange={(e) => updateTarget({ jobDescription: e.target.value })}
                      rows={4}
                      placeholder="Paste job responsibilities and required skills"
                      className="input-field w-full p-3 text-[13px] resize-y disabled:opacity-60"
                    />
                    {jdKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {jdKeywords.slice(0, 8).map((kw) => (
                          <span key={kw} className="badge">
                            {kw}
                          </span>
                        ))}
                        {jdKeywords.length > 8 && (
                          <span className="badge font-mono tabular-nums">
                            +{jdKeywords.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[var(--muted)] rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)] p-3 leading-relaxed">
                  General interview mode prepares core STAR behavioral questions around
                  problem solving, teamwork, and initiative — and adapts to your
                  resume if provided.
                </p>
              )}
            </div>

            {/* Right Column: Resume Upload (PDF) + Paste Text */}
            <div className="lg:col-span-6 space-y-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)]/50 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-[14px] font-medium text-[var(--text)]">
                    2. Your resume{" "}
                    <span className="font-normal text-[12px] text-[var(--muted)]">
                      (optional · PDF or paste)
                    </span>
                  </h2>
                  <p className="text-[12px] text-[var(--muted)] mt-0.5">
                    Stays in session memory only — checks JD alignment &amp; probes real projects
                  </p>
                </div>
                <div className="flex gap-1 rounded-[var(--radius-control)] bg-[var(--active)]/80 p-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setResumeTab("pdf")}
                    className={`h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium cursor-pointer transition-colors ${
                      resumeTab === "pdf"
                        ? "bg-[var(--surface)] text-[var(--accent-ink)]"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Upload PDF
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setResumeTab("paste")}
                    className={`h-8 px-3 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium cursor-pointer transition-colors ${
                      resumeTab === "paste"
                        ? "bg-[var(--surface)] text-[var(--accent-ink)]"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Paste text
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                disabled={disabled || isParsingPdf}
                onChange={(e) => void handlePdfUpload(e.target.files?.[0])}
                className="hidden"
              />

              {resumeTab === "pdf" ? (
                <div className="space-y-2.5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!disabled && !isParsingPdf) fileInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !disabled && !isParsingPdf) {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!disabled) setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (!disabled && !isParsingPdf) {
                        void handlePdfUpload(e.dataTransfer.files?.[0]);
                      }
                    }}
                    className={`rounded-[var(--radius-card)] border border-dashed p-5 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--control)] bg-[var(--surface)] hover:border-[var(--accent)]"
                    } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-[var(--muted)]">
                      {isParsingPdf ? "hourglass_top" : "upload_file"}
                    </span>
                    <p className="text-[13px] font-medium text-[var(--text)] mt-1">
                      {isParsingPdf
                        ? "Extracting text from PDF…"
                        : "Drop your resume PDF here, or click to browse"}
                    </p>
                    <p className="text-[12px] text-[var(--muted)] mt-0.5">
                      Text-based PDF up to 5 MB · No permanent file storage
                    </p>
                  </div>

                  {hasResume && (
                    <div className="rounded-[var(--radius-control)] border border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--pill-positive-ink)] truncate">
                          {resumeFileName || "Resume text loaded"}
                        </p>
                        <p className="text-[12px] text-[var(--positive)] font-mono tabular-nums">
                          {pdfPageCount ? `${pdfPageCount} page${pdfPageCount > 1 ? "s" : ""} · ` : ""}
                          {resumeWordCount} words · {resumeText.length} chars
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setResumeTab("paste")}
                          className="btn-secondary h-8 px-2.5 text-[12px] font-medium cursor-pointer"
                        >
                          Edit text
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={handleClearResume}
                          className="h-8 px-2.5 rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--surface)] hover:bg-[var(--pill-negative-bg)] text-[12px] font-medium text-[var(--negative)] cursor-pointer transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {pdfError && (
                    <div
                      role="alert"
                      className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3 py-2 text-[12px] text-[var(--pill-negative-ink)]"
                    >
                      {pdfError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="setup-resume-text"
                      className="text-[12px] font-medium text-[var(--text-secondary)]"
                    >
                      Resume text
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[var(--muted)] font-mono tabular-nums">
                        {resumeWordCount} words
                      </span>
                      {hasResume && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={handleClearResume}
                          className="text-[12px] font-medium text-[var(--negative)] hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    id="setup-resume-text"
                    value={resumeText}
                    disabled={disabled}
                    onChange={(e) => {
                      setPendingAction(null);
                      onResumeChange(e.target.value, resumeFileName);
                    }}
                    rows={6}
                    placeholder="Paste skills, projects, internship experience, and coursework"
                    className="input-field w-full p-3 text-[13px] resize-y disabled:opacity-60"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled || isGenerating || isParsingPdf}
                onClick={() => triggerGenerate(isSameInputsAsLastPrep)}
                className="btn-primary h-9 px-4 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isGenerating && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    sync
                  </span>
                )}
                {isGenerating
                  ? "Preparing questions…"
                  : isSameInputsAsLastPrep && isTailored
                    ? "Regenerate questions"
                    : "Prepare questions"}
              </button>

              {isTailored && !isSameInputsAsLastPrep && (
                <button
                  type="button"
                  disabled={disabled || isGenerating || isParsingPdf}
                  onClick={() => triggerGenerate(true)}
                  className="btn-secondary h-9 px-3 text-[13px] font-medium cursor-pointer disabled:opacity-50"
                >
                  New angle
                </button>
              )}

              {isTailored && (
                <button
                  type="button"
                  disabled={disabled || isGenerating}
                  onClick={triggerReset}
                  className="btn-secondary h-9 px-3 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--text)] cursor-pointer disabled:opacity-50"
                >
                  Use default questions
                </button>
              )}
            </div>

            {generateError && (
              <p role="alert" className="text-[12px] text-[var(--negative)]">
                {generateError}
              </p>
            )}
          </div>

          {/* Overwrite Recorded Drafts Confirmation */}
          {pendingAction && (
            <div className="rounded-[var(--radius-control)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[var(--pill-warning-ink)]">
                You already have {recordedCount} recorded/typed{" "}
                {recordedCount === 1 ? "answer" : "answers"}. Replacing the question set
                clears current drafts.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="btn-secondary h-8 px-3 text-[12px] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPendingAction}
                  className="h-8 px-3 rounded-[var(--radius-control)] bg-[var(--warning-ink)] text-white text-[12px] font-medium cursor-pointer"
                >
                  Replace questions
                </button>
              </div>
            </div>
          )}

          {/* Tailoring Report & Generated Questions Preview */}
          {tailorReport && (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)]/60 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-medium text-[var(--text)]">
                      Resume &amp; JD tailoring check
                    </h3>
                    <span className={fitPillClass(tailorReport)}>
                      {tailorReport.matchScore !== null
                        ? `${tailorReport.matchScore}% match · ${tailorReport.verdict}`
                        : tailorReport.verdict}
                    </span>
                    {prepMeta && (
                      <span className="text-[12px] font-mono text-[var(--muted)]">
                        {PROVIDER_LABELS[prepMeta.provider]} · {prepMeta.model}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">{tailorReport.summary}</p>
                </div>

                <button
                  type="button"
                  onClick={onToggleExpanded}
                  className="h-8 px-3 rounded-[var(--radius-control)] border border-[var(--border-accent)] bg-[var(--accent-soft)] hover:opacity-90 text-[12px] font-medium text-[var(--accent-ink)] flex items-center gap-1 cursor-pointer shrink-0 transition-opacity"
                >
                  Done
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_downward
                  </span>
                </button>
              </div>

              {prepMeta?.fallbackReason && (
                <p className="text-[12px] text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-control)] px-3 py-2">
                  {prepMeta.fallbackReason}
                </p>
              )}

              {(tailorReport.matchedSkills.length > 0 ||
                tailorReport.missingSkills.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tailorReport.hasResume && (
                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
                      <p className="text-[12px] font-medium text-[var(--positive)]">
                        Matched on resume · {tailorReport.matchedSkills.length}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tailorReport.matchedSkills.length > 0 ? (
                          tailorReport.matchedSkills.map((skill) => (
                            <span key={skill} className="pill-positive">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] text-[var(--muted)]">
                            No direct target keyword overlap detected yet
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2 ${
                      tailorReport.hasResume ? "" : "md:col-span-2"
                    }`}
                  >
                    <p
                      className={`text-[12px] font-medium ${
                        tailorReport.hasResume ? "text-[var(--negative)]" : "text-[var(--accent-ink)]"
                      }`}
                    >
                      {tailorReport.hasResume
                        ? `Missing or gap to address · ${tailorReport.missingSkills.length}`
                        : `Key target skills to cover · ${tailorReport.missingSkills.length}`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tailorReport.missingSkills.length > 0 ? (
                        tailorReport.missingSkills.map((skill) => (
                          <span
                            key={skill}
                            className={tailorReport.hasResume ? "pill-negative" : "badge"}
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-[12px] text-[var(--positive)]">
                          Your resume covers all extracted target terms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tailorReport.tailoringTips.length > 0 && (
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
                  <p className="text-[12px] font-medium text-[var(--muted)]">
                    Tailoring tips
                  </p>
                  <ul className="space-y-1">
                    {tailorReport.tailoringTips.map((tip, idx) => (
                      <li key={idx} className="flex gap-2 text-[13px] text-[var(--text-secondary)]">
                        <span className="text-[var(--muted)]">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clickable Question Preview */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--muted)]">
                  Generated practice questions ({questions.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {questions.map((q, idx) => {
                    const isActive = idx === activeQuestionIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelectQuestion(idx)}
                        className={`text-left rounded-[var(--radius-control)] border p-3 transition-colors cursor-pointer disabled:opacity-50 ${
                          isActive
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-[12px] font-medium text-[var(--accent-ink)] font-mono tabular-nums">
                            Q{idx + 1}
                          </span>
                          <span className="badge">
                            {QUESTION_TYPE_LABELS[q.type]}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--text)] line-clamp-2 leading-snug">
                          {q.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
