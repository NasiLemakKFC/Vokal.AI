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
  resume_deep_dive: "Resume Deep-Dive",
  jd_gap: "JD Gap",
  role_behavioral: "Role Behavioral",
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
      setPdfError("Please select a .pdf file, or switch to Paste text.");
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
          data.detail || "Could not extract text from this PDF. Try Paste text instead."
        );
        return;
      }
      setPdfPageCount(typeof data.pageCount === "number" ? data.pageCount : null);
      setPendingAction(null);
      onResumeChange(data.text, data.fileName || file.name);
    } catch {
      setPdfError("Failed to upload PDF for parsing. Check your local server or paste text.");
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

  const resumeBadgeLabel =
    tailorReport?.hasResume && tailorReport.matchScore !== null
      ? `${tailorReport.matchScore}% match · ${tailorReport.verdict}`
      : hasResume
        ? resumeFileName
          ? `Resume · ${resumeFileName}`
          : "Resume loaded"
        : "No resume";

  const questionStatusLabel =
    isTailored && prepMeta
      ? `Tailored · ${questions.length}Q · ${PROVIDER_LABELS[prepMeta.provider]}`
      : `Default ${questions.length}Q`;

  return (
    <section
      aria-label="Interview setup and resume tailoring check"
      className="rounded-[8px] border border-[#e8eaec] bg-white mb-4 overflow-hidden"
    >
      {/* Collapsible Header Bar */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#f9fbfc]">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
        >
          <span className="w-7 h-7 rounded-[6px] bg-[#eef4f6] border border-[#b8d4dc] text-[#134e5e] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[16px]">tune</span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold text-[#131416] group-hover:text-[#1b6c80] transition-colors">
                Interview setup &amp; resume check
              </span>
              <span className="badge">{targetSummaryLabel(target)}</span>
              <span
                className={
                  tailorReport
                    ? fitPillClass(tailorReport)
                    : hasResume
                      ? "pill-positive"
                      : "badge"
                }
              >
                {resumeBadgeLabel}
              </span>
              <span className={isTailored ? "pill-positive" : "badge"}>
                {questionStatusLabel}
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          className="h-[28px] px-2.5 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] flex items-center gap-1 cursor-pointer shrink-0"
        >
          {isExpanded ? "Hide setup" : "Configure"}
          <span className="material-symbols-outlined text-[16px] text-[#5d5f60]">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-[#e8eaec] p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Job Target */}
            <div className="lg:col-span-6 space-y-3 rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] p-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-[13.5px] font-semibold text-[#131416]">
                    1. Target role &amp; job description
                  </h2>
                  <p className="text-[11.5px] text-[#5d5f60]">
                    Drives both tailored interview questions and Module 3 keyword scoring.
                  </p>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="flex flex-wrap gap-1 rounded-[7px] bg-[#ebedee] p-1">
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
                    className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      target.mode === value
                        ? "bg-white text-[#134e5e] shadow-sm"
                        : "text-[#5d5f60] hover:text-[#131416]"
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
                    } gap-2.5`}
                  >
                    {target.mode === "company" && (
                      <label className="text-[12px] font-medium text-[#45474a] space-y-1 block">
                        Company name{" "}
                        <span className="font-normal text-[#8b8d90]">(optional)</span>
                        <input
                          value={target.company}
                          disabled={disabled}
                          onChange={(e) => updateTarget({ company: e.target.value })}
                          placeholder="e.g. Grab, Petronas Digital"
                          className="w-full h-9 rounded-[6px] border border-[#cdced1] bg-white px-2.5 text-[13px] text-[#131416] outline-none focus:border-[#1b6c80] disabled:opacity-60"
                        />
                      </label>
                    )}

                    <label className="text-[12px] font-medium text-[#45474a] space-y-1 block">
                      Job role
                      <select
                        value={target.role}
                        disabled={disabled}
                        onChange={(e) => updateTarget({ role: e.target.value })}
                        className="w-full h-9 rounded-[6px] border border-[#cdced1] bg-white px-2.5 text-[13px] text-[#131416] outline-none focus:border-[#1b6c80] disabled:opacity-60"
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
                        className="text-[12px] font-medium text-[#45474a]"
                      >
                        Job description{" "}
                        <span className="font-normal text-[#8b8d90]">
                          (paste JD requirements)
                        </span>
                      </label>
                      {jdKeywords.length > 0 && (
                        <span className="text-[11px] font-medium text-[#134e5e] tabular-nums">
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
                      placeholder="Paste the job responsibilities and required skills here..."
                      className="w-full rounded-[6px] border border-[#cdced1] bg-white p-2.5 text-[12.5px] text-[#131416] outline-none focus:border-[#1b6c80] resize-y disabled:opacity-60"
                    />
                    {jdKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {jdKeywords.slice(0, 8).map((kw) => (
                          <span key={kw} className="badge">
                            {kw}
                          </span>
                        ))}
                        {jdKeywords.length > 8 && (
                          <span className="badge tabular-nums">
                            +{jdKeywords.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[12.5px] text-[#5d5f60] rounded-[6px] bg-white border border-[#e8eaec] p-3 leading-relaxed">
                  General interview mode prepares core STAR behavioral questions around
                  problem solving, teamwork, and initiative — and still adapts to your
                  resume if provided.
                </p>
              )}
            </div>

            {/* Right Column: Resume Upload (PDF) + Paste Text */}
            <div className="lg:col-span-6 space-y-3 rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] p-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-[13.5px] font-semibold text-[#131416]">
                    2. Your resume{" "}
                    <span className="font-normal text-[12px] text-[#5d5f60]">
                      (optional · PDF or paste)
                    </span>
                  </h2>
                  <p className="text-[11.5px] text-[#5d5f60]">
                    Stays in session memory only — checks JD alignment &amp; probes real projects.
                  </p>
                </div>
                <div className="flex gap-1 rounded-[7px] bg-[#ebedee] p-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setResumeTab("pdf")}
                    className={`px-2.5 py-1 rounded-[5px] text-[12px] font-medium cursor-pointer transition-colors ${
                      resumeTab === "pdf"
                        ? "bg-white text-[#134e5e] shadow-sm"
                        : "text-[#5d5f60] hover:text-[#131416]"
                    }`}
                  >
                    Upload PDF
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setResumeTab("paste")}
                    className={`px-2.5 py-1 rounded-[5px] text-[12px] font-medium cursor-pointer transition-colors ${
                      resumeTab === "paste"
                        ? "bg-white text-[#134e5e] shadow-sm"
                        : "text-[#5d5f60] hover:text-[#131416]"
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
                    className={`rounded-[8px] border border-dashed p-5 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-[#1b6c80] bg-[#eef4f6]"
                        : "border-[#cdced1] bg-white hover:border-[#1b6c80]"
                    } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <span className="material-symbols-outlined text-[24px] text-[#1b6c80]">
                      {isParsingPdf ? "hourglass_top" : "upload_file"}
                    </span>
                    <p className="text-[13px] font-medium text-[#131416] mt-1">
                      {isParsingPdf
                        ? "Extracting text from PDF…"
                        : "Drop your resume PDF here, or click to browse"}
                    </p>
                    <p className="text-[11.5px] text-[#5d5f60] mt-0.5">
                      Text-based PDF up to 5 MB · No permanent file storage
                    </p>
                  </div>

                  {hasResume && (
                    <div className="rounded-[6px] border border-[#b5e8c5] bg-[#f7fcf9] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-[#04250e] truncate">
                          {resumeFileName || "Resume text loaded"}
                        </p>
                        <p className="text-[11px] text-[#1e7b4f] tabular-nums">
                          {pdfPageCount ? `${pdfPageCount} page${pdfPageCount > 1 ? "s" : ""} · ` : ""}
                          {resumeWordCount} words · {resumeText.length} chars
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setResumeTab("paste")}
                          className="h-[26px] px-2 rounded-[5px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[11.5px] font-medium text-[#131416] cursor-pointer"
                        >
                          Edit text
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={handleClearResume}
                          className="h-[26px] px-2 rounded-[5px] border border-[#cdced1] bg-white hover:bg-[#fff5f5] text-[11.5px] font-medium text-[#c4242a] cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {pdfError && (
                    <div
                      role="alert"
                      className="rounded-[6px] border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[12px] text-[#831c1e]"
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
                      className="text-[12px] font-medium text-[#45474a]"
                    >
                      Resume text
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#5d5f60] tabular-nums">
                        {resumeWordCount} words
                      </span>
                      {hasResume && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={handleClearResume}
                          className="text-[11.5px] font-medium text-[#c4242a] hover:underline cursor-pointer"
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
                    placeholder="Paste your skills, projects, internship experience, and coursework..."
                    className="w-full rounded-[6px] border border-[#cdced1] bg-white p-2.5 text-[12.5px] text-[#131416] outline-none focus:border-[#1b6c80] resize-y disabled:opacity-60"
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
                className="h-[34px] px-3.5 rounded-[6px] bg-[#1b6c80] text-white text-[13px] font-medium hover:bg-[#134e5e] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isGenerating ? "sync" : "auto_awesome"}
                </span>
                {isGenerating
                  ? "Analyzing & generating…"
                  : isSameInputsAsLastPrep && isTailored
                    ? "Regenerate questions"
                    : "Analyze fit & generate questions"}
              </button>

              {isTailored && !isSameInputsAsLastPrep && (
                <button
                  type="button"
                  disabled={disabled || isGenerating || isParsingPdf}
                  onClick={() => triggerGenerate(true)}
                  className="h-[34px] px-3 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12.5px] font-medium text-[#131416] cursor-pointer disabled:opacity-50"
                >
                  New angle
                </button>
              )}

              {isTailored && (
                <button
                  type="button"
                  disabled={disabled || isGenerating}
                  onClick={triggerReset}
                  className="h-[34px] px-3 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12.5px] font-medium text-[#5d5f60] hover:text-[#131416] cursor-pointer disabled:opacity-50"
                >
                  Use default questions
                </button>
              )}
            </div>

            {generateError && (
              <p role="alert" className="text-[12px] text-[#c4242a]">
                {generateError}
              </p>
            )}
          </div>

          {/* Overwrite Recorded Drafts Confirmation */}
          {pendingAction && (
            <div className="rounded-[8px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] text-[#92400e]">
                You already have {recordedCount} recorded/typed{" "}
                {recordedCount === 1 ? "answer" : "answers"}. Replacing the question set
                will clear current drafts.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="h-[28px] px-2.5 rounded-[5px] border border-[#cdced1] bg-white text-[12px] font-medium text-[#131416] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPendingAction}
                  className="h-[28px] px-3 rounded-[5px] bg-[#92400e] text-white text-[12px] font-medium cursor-pointer"
                >
                  Replace questions
                </button>
              </div>
            </div>
          )}

          {/* Tailoring Report & Generated Questions Preview */}
          {tailorReport && (
            <div className="rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[#131416]">
                      Resume &amp; JD tailoring check
                    </h3>
                    <span className={fitPillClass(tailorReport)}>
                      {tailorReport.matchScore !== null
                        ? `${tailorReport.matchScore}% match · ${tailorReport.verdict}`
                        : tailorReport.verdict}
                    </span>
                    {prepMeta && (
                      <span className="badge font-mono">
                        {PROVIDER_LABELS[prepMeta.provider]} · {prepMeta.model}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#45474a]">{tailorReport.summary}</p>
                </div>

                <button
                  type="button"
                  onClick={onToggleExpanded}
                  className="h-[30px] px-3 rounded-[6px] border border-[#b8d4dc] bg-[#eef4f6] hover:bg-[#e1edf1] text-[12px] font-medium text-[#134e5e] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  Collapse &amp; start practicing
                  <span className="material-symbols-outlined text-[15px]">
                    arrow_downward
                  </span>
                </button>
              </div>

              {prepMeta?.fallbackReason && (
                <p className="text-[11.5px] text-[#5d5f60] bg-white border border-[#e8eaec] rounded-[6px] px-3 py-1.5">
                  {prepMeta.fallbackReason}
                </p>
              )}

              {(tailorReport.matchedSkills.length > 0 ||
                tailorReport.missingSkills.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tailorReport.hasResume && (
                    <div className="rounded-[6px] border border-[#e8eaec] bg-white p-3 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1e7b4f]">
                        Matched on resume · {tailorReport.matchedSkills.length}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tailorReport.matchedSkills.length > 0 ? (
                          tailorReport.matchedSkills.map((skill) => (
                            <span key={skill} className="pill-positive">
                              ✓ {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] text-[#5d5f60]">
                            No direct target keyword overlap detected yet.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`rounded-[6px] border border-[#e8eaec] bg-white p-3 space-y-1.5 ${
                      tailorReport.hasResume ? "" : "md:col-span-2"
                    }`}
                  >
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        tailorReport.hasResume ? "text-[#c4242a]" : "text-[#134e5e]"
                      }`}
                    >
                      {tailorReport.hasResume
                        ? `Missing / gap to address · ${tailorReport.missingSkills.length}`
                        : `Key target skills to cover · ${tailorReport.missingSkills.length}`}
                    </p>
                    <div className="flex flex-wrap gap-1">
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
                        <span className="text-[12px] text-[#1e7b4f]">
                          Your resume covers all extracted target terms.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tailorReport.tailoringTips.length > 0 && (
                <div className="rounded-[6px] border border-[#e8eaec] bg-white p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5d5f60]">
                    Tailoring tips
                  </p>
                  <ul className="space-y-1">
                    {tailorReport.tailoringTips.map((tip, idx) => (
                      <li key={idx} className="flex gap-2 text-[12.5px] text-[#25272a]">
                        <span className="text-[#1b6c80] font-semibold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clickable Question Preview */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5d5f60]">
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
                        className={`text-left rounded-[6px] border p-2.5 transition-colors cursor-pointer disabled:opacity-50 ${
                          isActive
                            ? "border-[#1b6c80] bg-[#eef4f6]"
                            : "border-[#e8eaec] bg-white hover:bg-[#f4f6f8]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-[11px] font-semibold text-[#134e5e] tabular-nums">
                            Q{idx + 1}
                          </span>
                          <span className="badge !text-[10.5px]">
                            {QUESTION_TYPE_LABELS[q.type]}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#131416] line-clamp-2 leading-snug">
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
