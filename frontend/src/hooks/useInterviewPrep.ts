"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  deleteSetupPreset,
  getPresetsSnapshot,
  getServerPresetsSnapshot,
  saveSetupPreset,
  subscribePresets,
  type SetupPreset,
} from "@/lib/interview/presets";
import {
  getDefaultQuestions,
  type AiProviderUsed,
  type InterviewQuestion,
  type InterviewTarget,
  type PrepareInterviewResponse,
  type QuestionCountOption,
  type ResumeTailorReport,
} from "@/lib/interview/types";

export interface RetryDrillConfig {
  prompt: string;
  role?: string;
  keywords?: string[];
}

export interface UseInterviewPrepOptions {
  isModalOpen: boolean;
  readyAnswerCount: number;
  initialRetry?: RetryDrillConfig | null;
  onQuestionsReplaced: () => void;
}

/**
 * Owns Module 1 & 3 interview setup state: target role/company/level,
 * 3/5/7 question count, resume text, LLM/offline preparation, and `?retryPrompt=` deep-links.
 */
export function useInterviewPrep({
  isModalOpen,
  readyAnswerCount,
  initialRetry = null,
  onQuestionsReplaced,
}: UseInterviewPrepOptions) {
  const [target, setTarget] = useState<InterviewTarget>(() => ({
    mode: "role",
    company: "",
    role: initialRetry?.role || "Software Engineer",
    jobDescription: "",
    experienceLevel: "fresh_grad",
  }));
  const [questionCount, setQuestionCount] = useState<QuestionCountOption>(5);
  const [questions, setQuestions] = useState<InterviewQuestion[]>(() => {
    if (initialRetry?.prompt) {
      return [
        {
          id: "retry-drill-1",
          type: "role_behavioral",
          prompt: initialRetry.prompt,
          keywords:
            initialRetry.keywords && initialRetry.keywords.length > 0
              ? initialRetry.keywords
              : ["Situation", "Task", "Action", "Measured result"],
          rationale: "Focused retry drill from your previous session report.",
        },
      ];
    }
    return getDefaultQuestions(5);
  });
  const [isTailored, setIsTailored] = useState(() => Boolean(initialRetry?.prompt));
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [tailorReport, setTailorReport] = useState<ResumeTailorReport | null>(null);
  const [prepMeta, setPrepMeta] = useState<{
    provider: AiProviderUsed;
    model: string;
    fallbackReason?: string;
  } | null>(null);
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [isSetupExpanded, setIsSetupExpanded] = useState(false);
  const [lastPrepFingerprint, setLastPrepFingerprint] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const variationRef = useRef(0);

  const presets = useSyncExternalStore(
    subscribePresets,
    getPresetsSnapshot,
    getServerPresetsSnapshot
  );

  const currentFingerprint = useMemo(
    () =>
      JSON.stringify({
        mode: target.mode,
        company: target.company.trim(),
        role: target.role,
        experienceLevel: target.experienceLevel ?? "fresh_grad",
        questionCount,
        jobDescription: target.mode === "general" ? "" : target.jobDescription.trim(),
        resumeText: resumeText.trim(),
      }),
    [target, questionCount, resumeText]
  );

  const isSameInputsAsLastPrep =
    lastPrepFingerprint !== null && lastPrepFingerprint === currentFingerprint;

  const handleQuestionCountChange = (
    nextCount: QuestionCountOption,
    clampQuestionIndex: (maxIndex: number) => void
  ) => {
    setQuestionCount(nextCount);
    if (!isTailored && readyAnswerCount === 0) {
      setQuestions(getDefaultQuestions(nextCount));
      clampQuestionIndex(nextCount - 1);
    }
  };

  const handleGeneratePreparation = async (options?: {
    forceRegenerate?: boolean;
  }) => {
    if (isModalOpen || isGeneratingPrep) return;
    const forceRegenerate = Boolean(options?.forceRegenerate);
    if (isSameInputsAsLastPrep && !forceRegenerate && isTailored) {
      return;
    }

    const nextVariation =
      forceRegenerate && isSameInputsAsLastPrep ? variationRef.current + 1 : 0;

    setPrepError(null);
    setIsGeneratingPrep(true);
    try {
      const res = await fetch("/api/interview/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: target.mode,
          company: target.company,
          role: target.role,
          experienceLevel: target.experienceLevel ?? "fresh_grad",
          jobDescription: target.jobDescription,
          resumeText,
          questionCount,
          variation: nextVariation,
        }),
      });
      const data = (await res.json()) as Partial<PrepareInterviewResponse> & {
        detail?: string;
      };
      if (!res.ok || !Array.isArray(data.questions) || !data.tailorReport) {
        setPrepError(data.detail || "Could not prepare interview questions.");
        return;
      }

      variationRef.current = nextVariation;
      onQuestionsReplaced();
      setQuestions(
        data.questions.length > 0 ? data.questions : getDefaultQuestions(questionCount)
      );
      setIsTailored(true);
      setTailorReport(data.tailorReport);
      setPrepMeta({
        provider: data.provider ?? "offline",
        model: data.model ?? "rule-based-nlp",
        fallbackReason: data.fallbackReason,
      });
      setLastPrepFingerprint(currentFingerprint);
    } catch {
      setPrepError("Failed to contact interview preparation service.");
    } finally {
      setIsGeneratingPrep(false);
    }
  };

  const handleResetDefaultQuestions = () => {
    if (isModalOpen || isGeneratingPrep) return;
    onQuestionsReplaced();
    setQuestions(getDefaultQuestions(questionCount));
    setIsTailored(false);
    setTailorReport(null);
    setPrepMeta(null);
    setLastPrepFingerprint(null);
    variationRef.current = 0;
    setPrepError(null);
  };

  const handleClearSetup = () => {
    if (isModalOpen || isGeneratingPrep) return;
    onQuestionsReplaced();
    setTarget({
      mode: "role",
      company: "",
      role: "Software Engineer",
      jobDescription: "",
      experienceLevel: "fresh_grad",
    });
    setResumeText("");
    setResumeFileName(null);
    setQuestions(getDefaultQuestions(questionCount));
    setIsTailored(false);
    setTailorReport(null);
    setPrepMeta(null);
    setLastPrepFingerprint(null);
    setActivePresetId(null);
    variationRef.current = 0;
    setPrepError(null);
  };

  const handleSavePreset = (customName?: string): SetupPreset => {
    const saved = saveSetupPreset({
      name: customName,
      target,
      questionCount,
      resumeText,
      resumeFileName,
    });
    setActivePresetId(saved.id);
    return saved;
  };

  const handleLoadPreset = (
    preset: SetupPreset,
    clampQuestionIndex: (maxIndex: number) => void
  ) => {
    if (isModalOpen || isGeneratingPrep) return;
    onQuestionsReplaced();
    setTarget({
      ...preset.target,
      experienceLevel: preset.target.experienceLevel ?? "fresh_grad",
    });
    setQuestionCount(preset.questionCount);
    setResumeText(preset.resumeText);
    setResumeFileName(preset.resumeFileName);
    setQuestions(getDefaultQuestions(preset.questionCount));
    clampQuestionIndex(preset.questionCount - 1);
    setIsTailored(false);
    setTailorReport(null);
    setPrepMeta(null);
    setLastPrepFingerprint(null);
    setActivePresetId(preset.id);
    variationRef.current = 0;
    setPrepError(null);
  };

  const handleDeletePreset = (id: string) => {
    deleteSetupPreset(id);
    setActivePresetId((prev) => (prev === id ? null : prev));
  };

  return {
    target,
    setTarget,
    questionCount,
    handleQuestionCountChange,
    questions,
    isTailored,
    resumeText,
    setResumeText,
    resumeFileName,
    setResumeFileName,
    tailorReport,
    prepMeta,
    isGeneratingPrep,
    prepError,
    isSetupExpanded,
    setIsSetupExpanded,
    isSameInputsAsLastPrep,
    presets,
    activePresetId,
    handleGeneratePreparation,
    handleResetDefaultQuestions,
    handleClearSetup,
    handleSavePreset,
    handleLoadPreset,
    handleDeletePreset,
  };
}
