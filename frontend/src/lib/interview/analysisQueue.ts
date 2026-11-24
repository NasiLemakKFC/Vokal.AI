import {
  analyzeSpeech,
  enrichSpeechUi,
  type SpeechAnalysisResponse,
  type SpeechLanguageMode,
  type SpeechUi,
} from "@/lib/speechApi";
import { analyzeAnswer } from "@/lib/nlp/analyze";
import type { AnswerAnalysis, LlmStarEvaluation, StarKey } from "@/lib/nlp/types";
import {
  computeSessionMetrics,
  createSession,
  type SavedAnswer,
  type SavedSession,
  type VisionSnapshot,
} from "@/lib/nlp/sessionStore";
import type {
  InterviewQuestion,
  InterviewTarget,
  ResumeTailorReport,
} from "@/lib/interview/types";
import type {
  AnalysisModalPhase,
  AnalysisQueueItem,
} from "@/components/interview/SessionAnalysisModal";
import type { BackgroundTranscriptionStatus } from "@/hooks/useBackgroundTranscription";

export interface QuestionDraft {
  audioBlob: Blob | null;
  durationSec: number;
  manualTranscript: string;
  visionSnapshot: VisionSnapshot | null;
  speech: SpeechAnalysisResponse | null;
  audioVersion: number;
  transcriptionStatus: BackgroundTranscriptionStatus;
  transcriptionError?: string | null;
  followUpPrompt?: string | null;
  followUpPillarLabel?: string | null;
  followUpAudioBlob?: Blob | null;
  followUpDurationSec?: number;
  followUpTranscript?: string;
  followUpSpeech?: SpeechAnalysisResponse | null;
  followUpVersion?: number;
}

export const EMPTY_DRAFT: QuestionDraft = {
  audioBlob: null,
  durationSec: 0,
  manualTranscript: "",
  visionSnapshot: null,
  speech: null,
  audioVersion: 0,
  transcriptionStatus: "idle",
  transcriptionError: null,
  followUpPrompt: null,
  followUpPillarLabel: null,
  followUpAudioBlob: null,
  followUpDurationSec: 0,
  followUpTranscript: "",
  followUpSpeech: null,
  followUpVersion: 0,
};

export function isDraftReady(draft: QuestionDraft | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    (draft.audioBlob && draft.audioBlob.size > 0) ||
      draft.manualTranscript.trim().length > 0
  );
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session-${crypto.randomUUID()}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchLlmStarEvaluation(
  params: {
    question: string;
    transcript: string;
    target: InterviewTarget;
    questionKeywords: string[];
  },
  signal?: AbortSignal
): Promise<LlmStarEvaluation | null> {
  const words = params.transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length < 15) return null;

  try {
    const res = await fetch("/api/interview/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: params.question,
        transcript: params.transcript,
        role: params.target.mode === "general" ? "General Behavioral" : params.target.role,
        experienceLevel: params.target.experienceLevel ?? "fresh_grad",
        jobDescription: params.target.mode === "general" ? "" : params.target.jobDescription,
        questionKeywords: params.questionKeywords,
      }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      evaluated?: boolean;
      evaluation?: LlmStarEvaluation | null;
    };
    return data.evaluated && data.evaluation ? data.evaluation : null;
  } catch {
    return null;
  }
}

function mergeLlmIntoAnalysis(
  baseline: AnswerAnalysis,
  llm: LlmStarEvaluation | null
): AnswerAnalysis {
  if (!llm) return baseline;

  const keys: StarKey[] = ["situation", "task", "action", "result"];
  const upgradedStar = { ...baseline.star };
  for (const key of keys) {
    const baseSection = baseline.star[key];
    const llmScore = llm.pillarScores[key];
    const llmTip = llm.pillarFeedback[key];
    upgradedStar[key] = {
      ...baseSection,
      // Respect semantic detection if LLM finds a pillar the regex missed (score >= 45)
      found: baseSection.found || llmScore >= 45,
      suggestion: llmTip || baseSection.suggestion,
    };
  }

  const mergedCoaching: string[] = [];
  const seen = new Set<string>();
  for (const tip of [...llm.topCoaching, ...baseline.coaching]) {
    const norm = tip.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    mergedCoaching.push(tip.trim());
  }

  return {
    ...baseline,
    star: upgradedStar,
    coaching: mergedCoaching.slice(0, 6),
    llmEvaluation: llm,
  };
}

export interface ExecuteAnalysisQueueParams {
  startIdx: number;
  initialQueue: AnalysisQueueItem[];
  initialDrafts: Record<number, QuestionDraft>;
  questions: InterviewQuestion[];
  tailorReport: ResumeTailorReport | null;
  speechLang: SpeechLanguageMode;
  target: InterviewTarget;
  analysisRunIdRef: { current: number };
  abortControllerRef: { current: AbortController | null };
  waitForBackgroundTranscription?: (
    questionIndex: number,
    audioVersion: number
  ) => Promise<SpeechAnalysisResponse | null>;
  updateQueueItems: (next: AnalysisQueueItem[]) => void;
  updateDrafts: (next: Record<number, QuestionDraft>) => void;
  setCompletedSession: (session: SavedSession | null) => void;
  setIsCompleting: (val: boolean) => void;
  setModalPhase: (phase: AnalysisModalPhase) => void;
  setSaveError: (msg: string | null) => void;
}

export async function executeAnalysisQueue({
  startIdx,
  initialQueue,
  initialDrafts,
  questions,
  tailorReport,
  speechLang,
  target,
  analysisRunIdRef,
  abortControllerRef,
  waitForBackgroundTranscription,
  updateQueueItems,
  updateDrafts,
  setCompletedSession,
  setIsCompleting,
  setModalPhase,
  setSaveError,
}: ExecuteAnalysisQueueParams): Promise<void> {
  const runId = ++analysisRunIdRef.current;
  let workingQueue = initialQueue.map((it) => ({ ...it }));
  let workingDrafts = { ...initialDrafts };

  const waitWithRun = (ms: number) =>
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => {
        resolve(analysisRunIdRef.current === runId);
      }, ms);
    });

  const patchItem = (idx: number, patch: Partial<AnalysisQueueItem>) => {
    workingQueue = workingQueue.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    updateQueueItems(workingQueue);
  };

  for (let idx = startIdx; idx < workingQueue.length; idx++) {
    if (analysisRunIdRef.current !== runId) return;
    const item = workingQueue[idx];
    if (item.status === "done" || item.status === "skipped") continue;

    patchItem(idx, {
      status: "analyzing",
      subStage: "speech_transcribe",
      errorMessage: undefined,
    });

    let draft = workingDrafts[item.questionIndex] ?? EMPTY_DRAFT;
    let speechUi: SpeechUi | null = draft.speech ? enrichSpeechUi(draft.speech) : null;
    let transcriptText = draft.manualTranscript.trim();

    // If background transcription is already in-flight for this recording, await it first
    if (
      draft.audioBlob &&
      draft.audioBlob.size > 0 &&
      !draft.speech &&
      waitForBackgroundTranscription &&
      (draft.transcriptionStatus === "queued" || draft.transcriptionStatus === "transcribing")
    ) {
      const bgResult = await waitForBackgroundTranscription(
        item.questionIndex,
        draft.audioVersion
      );
      if (analysisRunIdRef.current !== runId) return;
      if (bgResult) {
        speechUi = enrichSpeechUi(bgResult);
        if (speechUi.transcript) {
          transcriptText = speechUi.transcript;
        }
        draft = {
          ...draft,
          speech: bgResult,
          manualTranscript: speechUi.transcript || draft.manualTranscript,
          transcriptionStatus: "done",
          transcriptionError: null,
        };
        workingDrafts = { ...workingDrafts, [item.questionIndex]: draft };
        updateDrafts(workingDrafts);
      }
    }

    if (draft.audioBlob && draft.audioBlob.size > 0 && !draft.speech) {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const startedAt = Date.now();
      let movedToFluency = false;

      const fluencyTimer = window.setTimeout(() => {
        if (analysisRunIdRef.current !== runId) return;
        movedToFluency = true;
        patchItem(idx, { subStage: "speech_fluency" });
      }, 1500);

      try {
        const speechResult = await analyzeSpeech(
          draft.audioBlob,
          speechLang,
          controller.signal
        );
        window.clearTimeout(fluencyTimer);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (analysisRunIdRef.current !== runId) return;

        speechUi = enrichSpeechUi(speechResult);
        if (speechUi.transcript) {
          transcriptText = speechUi.transcript;
        }
        const updatedDraft: QuestionDraft = {
          ...draft,
          speech: speechResult,
          manualTranscript: speechUi.transcript || draft.manualTranscript,
          transcriptionStatus: "done",
          transcriptionError: null,
        };
        workingDrafts = {
          ...workingDrafts,
          [item.questionIndex]: updatedDraft,
        };
        updateDrafts(workingDrafts);

        if (!movedToFluency) {
          patchItem(idx, { subStage: "speech_fluency" });
          if (!(await waitWithRun(220))) return;
        } else if (Date.now() - startedAt < 1850) {
          if (!(await waitWithRun(220))) return;
        }
      } catch (err) {
        window.clearTimeout(fluencyTimer);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (controller.signal.aborted || analysisRunIdRef.current !== runId) return;
        const message =
          err instanceof Error ? err.message : "Speech analysis failed.";
        patchItem(idx, { status: "error", errorMessage: message });
        return;
      }
    } else {
      // Already transcribed in background or text-only draft
      if (!(await waitWithRun(120))) return;
      patchItem(idx, { subStage: "speech_fluency" });
      if (!(await waitWithRun(120))) return;
    }

    // Transcribe optional follow-up clip if recorded and not yet transcribed in background
    let followUpTranscript = (draft.followUpTranscript ?? "").trim();
    if (
      draft.followUpAudioBlob &&
      draft.followUpAudioBlob.size > 0 &&
      !draft.followUpSpeech
    ) {
      const fuController = new AbortController();
      abortControllerRef.current = fuController;
      try {
        const fuSpeech = await analyzeSpeech(
          draft.followUpAudioBlob,
          speechLang,
          fuController.signal
        );
        if (abortControllerRef.current === fuController) {
          abortControllerRef.current = null;
        }
        if (analysisRunIdRef.current !== runId) return;
        if (fuSpeech.ui.transcript) {
          followUpTranscript = fuSpeech.ui.transcript;
        }
        draft = {
          ...draft,
          followUpSpeech: fuSpeech,
          followUpTranscript: followUpTranscript || draft.followUpTranscript,
        };
        workingDrafts = { ...workingDrafts, [item.questionIndex]: draft };
        updateDrafts(workingDrafts);
      } catch {
        if (abortControllerRef.current === fuController) {
          abortControllerRef.current = null;
        }
        if (fuController.signal.aborted || analysisRunIdRef.current !== runId) return;
        // Keep going with main answer if follow-up clip failed to transcribe
      }
    }

    const combinedTranscript = followUpTranscript
      ? `${transcriptText}\n${followUpTranscript}`.trim()
      : transcriptText;

    // Module 3: Hybrid NLP & Semantic STAR Evaluation (grades main answer + follow-up together)
    patchItem(idx, { subStage: "nlp_star" });
    const questionKeywords = questions[item.questionIndex]?.keywords ?? [];
    const baselineNlp = analyzeAnswer(combinedTranscript, {
      role: target.mode === "role" || target.mode === "company" ? target.role : "",
      jobDescription: target.mode !== "general" ? target.jobDescription : "",
      question: item.question,
      questionKeywords,
    });

    const evalController = new AbortController();
    abortControllerRef.current = evalController;
    const llmEval = await fetchLlmStarEvaluation(
      {
        question: item.question,
        transcript: combinedTranscript,
        target,
        questionKeywords,
      },
      evalController.signal
    );
    if (abortControllerRef.current === evalController) {
      abortControllerRef.current = null;
    }
    if (analysisRunIdRef.current !== runId) return;

    const nlpResult = mergeLlmIntoAnalysis(baselineNlp, llmEval);

    // Module 4: Merge vision snapshot
    patchItem(idx, { subStage: "vision_merge" });
    const fuUi = draft.followUpSpeech?.ui;
    const savedFollowUp =
      draft.followUpPrompt && followUpTranscript
        ? {
            pillarLabel: draft.followUpPillarLabel || "Follow-up",
            prompt: draft.followUpPrompt,
            transcript: followUpTranscript,
            durationSec:
              fuUi?.durationSec ??
              draft.followUpDurationSec ??
              undefined,
            ...(typeof fuUi?.wpm === "number" ? { wpm: fuUi.wpm } : {}),
            ...(typeof fuUi?.fillerCount === "number"
              ? { fillerCount: fuUi.fillerCount }
              : {}),
            ...(typeof fuUi?.fluencyScore === "number"
              ? { fluencyScore: fuUi.fluencyScore }
              : {}),
          }
        : null;

    const savedAnswer: SavedAnswer = {
      question: item.question,
      transcript: transcriptText,
      analysis: nlpResult,
      speech: speechUi,
      vision: draft.visionSnapshot ?? null,
      durationSec: speechUi?.durationSec ?? draft.durationSec ?? 0,
      ...(savedFollowUp ? { followUp: savedFollowUp } : {}),
    };
    if (!(await waitWithRun(160))) return;

    patchItem(idx, {
      status: "done",
      subStage: "done",
      result: savedAnswer,
    });
    if (!(await waitWithRun(120))) return;
  }

  if (analysisRunIdRef.current !== runId) return;
  const doneAnswers = workingQueue
    .filter((it) => it.status === "done" && it.result)
    .map((it) => it.result as SavedAnswer);

  if (doneAnswers.length === 0) {
    setModalPhase("closed");
    return;
  }

  const sessionMetrics = computeSessionMetrics(doneAnswers);
  const newSession: SavedSession = {
    id: generateSessionId(),
    completedAt: new Date().toISOString(),
    mode: target.mode,
    company: target.company,
    role: target.role,
    jobDescription: target.jobDescription,
    tailorReport,
    answers: doneAnswers,
    overallScore: sessionMetrics.overallScore,
    starScore: sessionMetrics.starScore,
    deliveryScore: sessionMetrics.deliveryScore,
    presenceScore: sessionMetrics.presenceScore,
  };

  let persistedSession = newSession;
  try {
    persistedSession = await createSession(newSession);
    setSaveError(null);
  } catch (err) {
    setSaveError(
      err instanceof Error
        ? `Could not save session: ${err.message}`
        : "Could not save session to your reports."
    );
  }
  setCompletedSession(persistedSession);
  setIsCompleting(true);
  if (!(await waitWithRun(500))) return;

  setIsCompleting(false);
  setModalPhase("review");
}
