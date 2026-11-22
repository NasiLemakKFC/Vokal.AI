"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useVisionCoach } from "@/hooks/useVisionCoach";
import {
  analyzeSpeech,
  type SpeechAnalysisResponse,
  type SpeechLanguageMode,
  type SpeechUi,
} from "@/lib/speechApi";
import { analyzeAnswer } from "@/lib/nlp/analyze";
import {
  computeSessionMetrics,
  saveSession,
  type SavedAnswer,
  type SavedSession,
  type VisionSnapshot,
} from "@/lib/nlp/sessionStore";
import QuestionPrompt from "@/components/interview/QuestionPrompt";
import SessionSetupCard from "@/components/interview/SessionSetupCard";
import StarChecklist, { type StarProgress } from "@/components/interview/StarChecklist";
import LiveCoachingTip from "@/components/interview/LiveCoachingTip";
import CandidateVideoFeed from "@/components/interview/CandidateVideoFeed";
import ControlDock from "@/components/interview/ControlDock";
import type {
  AnalysisModalPhase,
  AnalysisQueueItem,
} from "@/components/interview/SessionAnalysisModal";
import type { WebcamFeedHandle } from "@/components/interview/WebcamFeed";

const Module3Analysis = dynamic(
  () => import("@/components/interview/Module3Analysis"),
  { ssr: false }
);
const DeviceSettingsModal = dynamic(
  () => import("@/components/interview/DeviceSettingsModal"),
  { ssr: false }
);
const SessionAnalysisModal = dynamic(
  () => import("@/components/interview/SessionAnalysisModal"),
  { ssr: false }
);
import {
  DEFAULT_QUESTIONS,
  type AiProviderUsed,
  type InterviewQuestion,
  type InterviewTarget,
  type PrepareInterviewResponse,
  type ResumeTailorReport,
} from "@/lib/interview/types";

interface QuestionDraft {
  audioBlob: Blob | null;
  durationSec: number;
  manualTranscript: string;
  visionSnapshot: VisionSnapshot | null;
  speech: SpeechAnalysisResponse | null;
}

const EMPTY_DRAFT: QuestionDraft = {
  audioBlob: null,
  durationSec: 0,
  manualTranscript: "",
  visionSnapshot: null,
  speech: null,
};

function isDraftReady(draft: QuestionDraft | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    (draft.audioBlob && draft.audioBlob.size > 0) ||
      draft.manualTranscript.trim().length > 0
  );
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

interface ExecuteAnalysisQueueParams {
  startIdx: number;
  initialQueue: AnalysisQueueItem[];
  initialDrafts: Record<number, QuestionDraft>;
  questions: InterviewQuestion[];
  tailorReport: ResumeTailorReport | null;
  speechLang: SpeechLanguageMode;
  target: InterviewTarget;
  analysisRunIdRef: { current: number };
  abortControllerRef: { current: AbortController | null };
  updateQueueItems: (next: AnalysisQueueItem[]) => void;
  updateDrafts: (next: Record<number, QuestionDraft>) => void;
  setCompletedSession: (session: SavedSession | null) => void;
  setIsCompleting: (val: boolean) => void;
  setModalPhase: (phase: AnalysisModalPhase) => void;
}

async function executeAnalysisQueue({
  startIdx,
  initialQueue,
  initialDrafts,
  questions,
  tailorReport,
  speechLang,
  target,
  analysisRunIdRef,
  abortControllerRef,
  updateQueueItems,
  updateDrafts,
  setCompletedSession,
  setIsCompleting,
  setModalPhase,
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

    const draft = workingDrafts[item.questionIndex] ?? EMPTY_DRAFT;
    let speechUi: SpeechUi | null = draft.speech?.ui ?? null;
    let transcriptText = draft.manualTranscript.trim();

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

        speechUi = speechResult.ui;
        if (speechResult.ui.transcript) {
          transcriptText = speechResult.ui.transcript;
        }
        const updatedDraft: QuestionDraft = {
          ...draft,
          speech: speechResult,
          manualTranscript: speechResult.ui.transcript || draft.manualTranscript,
        };
        workingDrafts = {
          ...workingDrafts,
          [item.questionIndex]: updatedDraft,
        };
        updateDrafts(workingDrafts);

        if (!movedToFluency) {
          patchItem(idx, { subStage: "speech_fluency" });
          if (!(await waitWithRun(320))) return;
        } else if (Date.now() - startedAt < 1850) {
          if (!(await waitWithRun(320))) return;
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
      if (!(await waitWithRun(280))) return;
      patchItem(idx, { subStage: "speech_fluency" });
      if (!(await waitWithRun(240))) return;
    }

    // Module 3: NLP & STAR mapping
    patchItem(idx, { subStage: "nlp_star" });
    const nlpResult = analyzeAnswer(transcriptText, {
      role: target.mode === "role" || target.mode === "company" ? target.role : "",
      jobDescription: target.mode !== "general" ? target.jobDescription : "",
      question: item.question,
      questionKeywords: questions[item.questionIndex]?.keywords ?? [],
    });
    if (!(await waitWithRun(400))) return;

    // Module 4: Merge vision snapshot
    patchItem(idx, { subStage: "vision_merge" });
    const savedAnswer: SavedAnswer = {
      question: item.question,
      transcript: transcriptText,
      analysis: nlpResult,
      speech: speechUi,
      vision: draft.visionSnapshot ?? null,
      durationSec: speechUi?.durationSec ?? draft.durationSec ?? 0,
    };
    if (!(await waitWithRun(300))) return;

    patchItem(idx, {
      status: "done",
      subStage: "done",
      result: savedAnswer,
    });
    if (!(await waitWithRun(200))) return;
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
    id: `session-${Date.now()}`,
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

  saveSession(newSession);
  setCompletedSession(newSession);
  setIsCompleting(true);
  if (!(await waitWithRun(600))) return;

  setIsCompleting(false);
  setModalPhase("review");
}

export default function PracticeRoom() {
  const router = useRouter();
  const webcamRef = useRef<WebcamFeedHandle>(null);

  const {
    audioDevices,
    videoDevices,
    selectedAudioId,
    selectedVideoId,
    setSelectedAudioId,
    setSelectedVideoId,
    micGain,
    setMicGain,
    noiseSuppression,
    setNoiseSuppression,
    refreshDevices,
  } = useMediaDevices();
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const {
    audioLevel,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    setMuted: setRecorderMuted,
  } = useAudioRecorder({
    deviceId: selectedAudioId,
    micGain,
    noiseSuppression,
  });

  const [drafts, setDrafts] = useState<Record<number, QuestionDraft>>({});
  const draftsRef = useRef<Record<number, QuestionDraft>>({});
  const updateDrafts = (next: Record<number, QuestionDraft>) => {
    draftsRef.current = next;
    setDrafts(next);
  };

  const [speechLang, setSpeechLang] = useState<SpeechLanguageMode>("en");
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Module 1 & 3: target role/company, resume & generated questions state
  const [target, setTarget] = useState<InterviewTarget>({
    mode: "role",
    company: "",
    role: "Software Engineer",
    jobDescription: "",
  });
  const [questions, setQuestions] = useState<InterviewQuestion[]>(DEFAULT_QUESTIONS);
  const [isTailored, setIsTailored] = useState(false);
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
  const variationRef = useRef(0);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showVisionOverlay, setShowVisionOverlay] = useState(true);
  const [trackInPreview, setTrackInPreview] = useState(true);
  const [nudgeDelaySec, setNudgeDelaySec] = useState<number>(3.0);
  const [chimeEnabled, setChimeEnabled] = useState(true);

  // Post-session blocking analysis modal & STAR review state
  const [modalPhase, setModalPhase] = useState<AnalysisModalPhase>("closed");
  const [queueItems, setQueueItems] = useState<AnalysisQueueItem[]>([]);
  const queueItemsRef = useRef<AnalysisQueueItem[]>([]);
  const updateQueueItems = (next: AnalysisQueueItem[]) => {
    queueItemsRef.current = next;
    setQueueItems(next);
  };
  const [isCompleting, setIsCompleting] = useState(false);
  const [completedSession, setCompletedSession] = useState<SavedSession | null>(null);

  const analysisRunIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCycleNudgeDelay = () => {
    setNudgeDelaySec((prev) => (prev === 3 ? 1.5 : prev === 1.5 ? 5 : 3));
  };

  const isModalOpen = modalPhase !== "closed";
  const isAnalyzingModal = modalPhase === "analyzing";

  // Module 4: Real-time client-side eye contact & posture tracking (MediaPipe Face + Pose)
  const isVisionPaused = (!isSessionActive && !trackInPreview) || isModalOpen;
  const {
    vision,
    isModelReady: isVisionReady,
    bootStage: visionBootStage,
    error: visionError,
    calibratePosture,
    resetSession: resetVisionSession,
  } = useVisionCoach(webcamRef, {
    enabled: isVideoOn,
    paused: isVisionPaused,
    trackSession: isSessionActive,
    showOverlay: showVisionOverlay,
    nudgeDelaySec,
  });

  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  useEffect(() => {
    setRecorderMuted(!isMicOn);
  }, [isMicOn, setRecorderMuted]);

  useEffect(() => {
    return () => {
      analysisRunIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  const currentDraft = drafts[questionIndex] ?? EMPTY_DRAFT;
  const transcript = currentDraft.manualTranscript;
  const speech = currentDraft.speech;
  const currentQuestionItem = questions[questionIndex] ?? questions[0] ?? DEFAULT_QUESTIONS[0];
  const currentQuestion = currentQuestionItem.prompt;

  const readyAnswerCount = useMemo(
    () => questions.filter((_, idx) => isDraftReady(drafts[idx])).length,
    [questions, drafts]
  );

  const currentFingerprint = useMemo(
    () =>
      JSON.stringify({
        mode: target.mode,
        company: target.company.trim(),
        role: target.role,
        jobDescription: target.mode === "general" ? "" : target.jobDescription.trim(),
        resumeText: resumeText.trim(),
      }),
    [target, resumeText]
  );
  const isSameInputsAsLastPrep =
    lastPrepFingerprint !== null && lastPrepFingerprint === currentFingerprint;

  const captureVisionSnapshot = (): VisionSnapshot | null => {
    if (!isVideoOn || !vision) return null;
    if (vision.summary.totalFrames > 0) {
      return { ...vision.summary };
    }
    return {
      eyeContactScore: vision.liveEyeContactScore,
      postureScore: vision.livePostureScore,
      eyeNudges: 0,
      postureNudges: 0,
      totalFrames: 1,
    };
  };

  const saveStoppedRecordingToDrafts = async (
    idx: number,
    durationSec: number,
    snap: VisionSnapshot | null
  ): Promise<Record<number, QuestionDraft>> => {
    const audio = await stopRecording();
    const existing = draftsRef.current[idx] ?? EMPTY_DRAFT;
    const nextDraft: QuestionDraft =
      audio && audio.size > 0
        ? {
            ...existing,
            audioBlob: audio,
            durationSec,
            visionSnapshot: snap,
            speech: null,
          }
        : {
            ...existing,
            visionSnapshot: snap ?? existing.visionSnapshot,
          };
    const nextMap = { ...draftsRef.current, [idx]: nextDraft };
    updateDrafts(nextMap);
    return nextMap;
  };

  const handleSelectQuestion = async (nextIndex: number) => {
    if (isModalOpen || nextIndex === questionIndex) return;

    if (isSessionActive) {
      setIsSessionActive(false);
      const snap = captureVisionSnapshot();
      await saveStoppedRecordingToDrafts(questionIndex, elapsedSeconds, snap);
    }

    resetVisionSession();
    setQuestionIndex(nextIndex);
    setElapsedSeconds(draftsRef.current[nextIndex]?.durationSec ?? 0);
    setSpeechError(null);
  };

  const handleNext = () => {
    void handleSelectQuestion((questionIndex + 1) % questions.length);
  };

  const handlePrev = () => {
    void handleSelectQuestion(
      (questionIndex - 1 + questions.length) % questions.length
    );
  };

  const handleGeneratePreparation = async (options?: { forceRegenerate?: boolean }) => {
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
          jobDescription: target.jobDescription,
          resumeText,
          questionCount: 3,
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
      cancelRecording();
      resetVisionSession();
      updateDrafts({});
      setQuestions(data.questions.length > 0 ? data.questions : DEFAULT_QUESTIONS);
      setIsTailored(true);
      setTailorReport(data.tailorReport);
      setPrepMeta({
        provider: data.provider ?? "offline",
        model: data.model ?? "rule-based-nlp",
        fallbackReason: data.fallbackReason,
      });
      setLastPrepFingerprint(currentFingerprint);
      setQuestionIndex(0);
      setElapsedSeconds(0);
      setIsSessionActive(false);
      setSpeechError(null);
    } catch {
      setPrepError("Failed to contact interview preparation service.");
    } finally {
      setIsGeneratingPrep(false);
    }
  };

  const handleResetDefaultQuestions = () => {
    if (isModalOpen || isGeneratingPrep) return;
    cancelRecording();
    resetVisionSession();
    updateDrafts({});
    setQuestions(DEFAULT_QUESTIONS);
    setIsTailored(false);
    setTailorReport(null);
    setPrepMeta(null);
    setLastPrepFingerprint(null);
    variationRef.current = 0;
    setQuestionIndex(0);
    setElapsedSeconds(0);
    setIsSessionActive(false);
    setSpeechError(null);
    setPrepError(null);
  };

  // Start = begin recording. Stop = buffer audio & vision snapshot for post-session 1-by-1 analysis.
  const handleToggleSession = async () => {
    if (isModalOpen) return;

    if (!isSessionActive) {
      setSpeechError(null);
      resetVisionSession();
      try {
        await startRecording();
        setElapsedSeconds(0);
        setIsSessionActive(true);
        setIsSetupExpanded(false);
      } catch {
        setSpeechError(
          "Cannot use the microphone. Check the browser permission and the selected device."
        );
      }
      return;
    }

    setIsSessionActive(false);
    const snap = captureVisionSnapshot();
    await saveStoppedRecordingToDrafts(questionIndex, elapsedSeconds, snap);
  };

  const handleTranscriptChange = (value: string) => {
    const existing = draftsRef.current[questionIndex] ?? EMPTY_DRAFT;
    updateDrafts({
      ...draftsRef.current,
      [questionIndex]: { ...existing, manualTranscript: value },
    });
  };

  const runAnalysisQueue = (
    startIdx: number,
    initialQueue: AnalysisQueueItem[],
    initialDrafts: Record<number, QuestionDraft>
  ) =>
    executeAnalysisQueue({
      startIdx,
      initialQueue,
      initialDrafts,
      questions,
      tailorReport,
      speechLang,
      target,
      analysisRunIdRef,
      abortControllerRef,
      updateQueueItems,
      updateDrafts,
      setCompletedSession,
      setIsCompleting,
      setModalPhase,
    });

  const handleFinishSession = async () => {
    if (isModalOpen) return;

    let latestDrafts = { ...draftsRef.current };
    if (isSessionActive) {
      setIsSessionActive(false);
      const snap = captureVisionSnapshot();
      latestDrafts = await saveStoppedRecordingToDrafts(
        questionIndex,
        elapsedSeconds,
        snap
      );
    }

    const answeredIndices = questions.map((_, idx) => idx).filter((idx) =>
      isDraftReady(latestDrafts[idx])
    );

    if (answeredIndices.length === 0) {
      setSpeechError(
        "Record or type at least one answer before finishing the session."
      );
      return;
    }

    const initialQueue: AnalysisQueueItem[] = answeredIndices.map((qIdx) => {
      const d = latestDrafts[qIdx] ?? EMPTY_DRAFT;
      return {
        questionIndex: qIdx,
        question: questions[qIdx].prompt,
        hasAudio: Boolean(d.audioBlob && d.audioBlob.size > 0),
        durationSec: d.durationSec,
        status: "pending",
        subStage: "speech_transcribe",
      };
    });

    setSpeechError(null);
    setIsDeviceModalOpen(false);
    setCompletedSession(null);
    setIsCompleting(false);
    updateQueueItems(initialQueue);
    setModalPhase("analyzing");

    void runAnalysisQueue(0, initialQueue, latestDrafts);
  };

  const handleRetryItem = (queueIndex: number) => {
    void runAnalysisQueue(queueIndex, queueItemsRef.current, draftsRef.current);
  };

  const handleSkipItem = (queueIndex: number) => {
    const nextQueue = queueItemsRef.current.map((it, idx) =>
      idx === queueIndex ? { ...it, status: "skipped" as const, errorMessage: undefined } : it
    );
    updateQueueItems(nextQueue);
    void runAnalysisQueue(queueIndex + 1, nextQueue, draftsRef.current);
  };

  const handleCancelAnalysis = () => {
    analysisRunIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsCompleting(false);
    setModalPhase("closed");
  };

  const handleCloseReview = () => {
    setModalPhase("closed");
  };

  const handleStartNewSession = () => {
    analysisRunIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    cancelRecording();
    resetVisionSession();
    updateDrafts({});
    updateQueueItems([]);
    setCompletedSession(null);
    setIsCompleting(false);
    setIsSessionActive(false);
    setElapsedSeconds(0);
    setSpeechError(null);
    setQuestionIndex(0);
    setModalPhase("closed");
  };

  const handleViewFullReport = (sessionId: string) => {
    setModalPhase("closed");
    router.push(`/reports?session=${encodeURIComponent(sessionId)}`);
  };

  // Module 3 live NLP & STAR analysis driven by current transcript (from Module 2 or typed/pasted)
  const analysis = useMemo(
    () =>
      analyzeAnswer(transcript, {
        role: target.mode === "role" || target.mode === "company" ? target.role : "",
        jobDescription: target.mode !== "general" ? target.jobDescription : "",
        question: currentQuestion,
        questionKeywords: currentQuestionItem.keywords,
      }),
    [
      transcript,
      target.mode,
      target.role,
      target.jobDescription,
      currentQuestion,
      currentQuestionItem.keywords,
    ]
  );

  const starProgress: StarProgress = useMemo(() => {
    const hasText = transcript.trim().length > 0;
    return {
      situation: {
        detected: analysis.star.situation.found,
        summary: analysis.star.situation.found
          ? analysis.star.situation.explanation
          : analysis.star.situation.suggestion,
      },
      task: {
        detected: analysis.star.task.found,
        summary: analysis.star.task.found
          ? analysis.star.task.explanation
          : analysis.star.task.suggestion,
      },
      action: {
        detected: analysis.star.action.found,
        inProgress: !analysis.star.action.found && (isSessionActive || hasText),
        summary: analysis.star.action.found
          ? analysis.star.action.explanation
          : analysis.star.action.suggestion,
      },
      result: {
        detected: analysis.star.result.found,
        summary: analysis.star.result.found
          ? analysis.star.result.explanation
          : analysis.star.result.suggestion,
      },
    };
  }, [analysis.star, isSessionActive, transcript]);

  const liveTip =
    analysis.coaching[0] ??
    "Finish with a number — e.g. latency dropped from 420 ms to 85 ms.";

  // Module 5 values come from speech analysis after completion.
  // Module 4 values (eyeContact, postureAlert) come live from useVisionCoach (rolling 6s score).
  const metrics = {
    wpm: speech?.ui.wpm ?? 0,
    eyeContact: vision ? Math.round(vision.liveEyeContactScore) : 100,
    postureAlert: vision?.postureNudge ?? null,
    fillerCount: speech?.ui.fillerCount ?? 0,
  };

  const hasCurrentRecording = Boolean(
    currentDraft.audioBlob && currentDraft.audioBlob.size > 0
  );
  const canFinish = readyAnswerCount > 0 || isSessionActive;

  // Keyboard shortcuts: Space = start/stop recording, M = toggle mic, Alt+Right/Left = next/prev question
  const shortcutActionsRef = useRef({
    toggleSession: handleToggleSession,
    nextQuestion: handleNext,
    prevQuestion: handlePrev,
    toggleMic: () => setIsMicOn((v) => !v),
    disabled: isModalOpen || isDeviceModalOpen || isGeneratingPrep,
  });
  useEffect(() => {
    shortcutActionsRef.current = {
      toggleSession: handleToggleSession,
      nextQuestion: handleNext,
      prevQuestion: handlePrev,
      toggleMic: () => setIsMicOn((v) => !v),
      disabled: isModalOpen || isDeviceModalOpen || isGeneratingPrep,
    };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (shortcutActionsRef.current.disabled) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Only intercept Space when focus isn't already on a button (avoid double-trigger)
        if (el && el.tagName === "BUTTON") return;
        e.preventDefault();
        void shortcutActionsRef.current.toggleSession();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        shortcutActionsRef.current.nextQuestion();
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        shortcutActionsRef.current.prevQuestion();
      } else if (
        (e.key === "m" || e.key === "M") &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        shortcutActionsRef.current.toggleMic();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Pacing timer cues: 90s–150s (1:30–2:30) is the ideal behavioral STAR response duration
  const timerPacingState =
    elapsedSeconds === 0 && !isSessionActive
      ? "idle"
      : elapsedSeconds < 90
        ? "building"
        : elapsedSeconds <= 150
          ? "optimal"
          : "wrap_up";

  return (
    <div className="max-w-[1180px] mx-auto pb-10">
      <SessionSetupCard
        target={target}
        onTargetChange={setTarget}
        resumeText={resumeText}
        resumeFileName={resumeFileName}
        onResumeChange={(text, fileName) => {
          setResumeText(text);
          setResumeFileName(fileName);
        }}
        questions={questions}
        isTailored={isTailored}
        isSameInputsAsLastPrep={isSameInputsAsLastPrep}
        activeQuestionIndex={questionIndex}
        onSelectQuestion={(idx) => void handleSelectQuestion(idx)}
        tailorReport={tailorReport}
        prepMeta={prepMeta}
        isGenerating={isGeneratingPrep}
        generateError={prepError}
        hasRecordedDrafts={readyAnswerCount > 0}
        recordedCount={readyAnswerCount}
        disabled={isModalOpen || isSessionActive}
        isExpanded={isSetupExpanded}
        onToggleExpanded={() => setIsSetupExpanded((v) => !v)}
        onGenerate={(opts) => void handleGeneratePreparation(opts)}
        onResetDefaults={handleResetDefaultQuestions}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#5d5f60] min-w-0">
          <div className="flex items-center gap-1" role="tablist" aria-label="Questions">
            {questions.map((_, idx) => {
              const isActive = idx === questionIndex;
              const isReady = isDraftReady(drafts[idx]);
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={isModalOpen}
                  onClick={() => void handleSelectQuestion(idx)}
                  className={`h-[28px] px-2.5 rounded-[6px] border text-[12px] font-medium tabular-nums flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 ${
                    isActive
                      ? "bg-[#eef4f6] text-[#134e5e] border-[#b8d4dc]"
                      : isReady
                        ? "bg-white text-[#131416] border-[#b5e8c5] hover:bg-[#f7fcf9]"
                        : "bg-white text-[#5d5f60] border-[#e8eaec] hover:bg-[#f4f6f8]"
                  }`}
                >
                  Q{idx + 1}
                  {isReady && (
                    <span className="material-symbols-outlined text-[14px] text-[#1e7b4f]">
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[#cdced1]">·</span>
          <span className="truncate">
            {target.mode === "general"
              ? "General Interview"
              : target.company.trim()
                ? `${target.company.trim()} · ${target.role}`
                : target.role}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            title="Target STAR answer length: 1:30 to 2:30"
            className={`h-[30px] px-2.5 rounded-[6px] border flex items-center gap-1.5 text-[13px] font-medium tabular-nums transition-colors ${
              timerPacingState === "optimal"
                ? "bg-[#dcfae5] text-[#04250e] border-[#b5e8c5]"
                : timerPacingState === "wrap_up"
                  ? "bg-[#fffbeb] text-[#92400e] border-[#fde68a]"
                  : "bg-white text-[#131416] border-[#e8eaec]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSessionActive
                  ? timerPacingState === "optimal"
                    ? "bg-[#1e7b4f] animate-pulse"
                    : timerPacingState === "wrap_up"
                      ? "bg-[#a86f0c] animate-pulse"
                      : "bg-[#c4242a] animate-pulse"
                  : "bg-[#cdced1]"
              }`}
            />
            <span>{formatDuration(elapsedSeconds)}</span>
            {isSessionActive && (
              <span className="hidden sm:inline text-[11px] font-normal opacity-80">
                {timerPacingState === "optimal"
                  ? "· Optimal 1:30–2:30"
                  : timerPacingState === "wrap_up"
                    ? "· Wrap up soon"
                    : "· Target 1:30+"}
              </span>
            )}
          </span>
          <button
            type="button"
            disabled={isModalOpen}
            onClick={() => void handleFinishSession()}
            className={`h-[30px] px-3 rounded-[6px] text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
              canFinish
                ? "bg-[#1b6c80] text-white hover:bg-[#134e5e]"
                : "text-[#131416] border border-[#cdced1] bg-white hover:bg-[#f4f6f8]"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
            Finish &amp; analyze
            {readyAnswerCount > 0 && (
              <span className="tabular-nums">({readyAnswerCount})</span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: question, STAR, tip */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <QuestionPrompt
            question={currentQuestion}
            keywords={currentQuestionItem.keywords}
            isRecording={isSessionActive && isMicOn}
            questionType={currentQuestionItem.type}
            rationale={currentQuestionItem.rationale}
          />
          <StarChecklist progress={starProgress} />
          <LiveCoachingTip tip={liveTip} />
        </section>

        {/* Right: video + speech chips */}
        <section className="lg:col-span-7 flex flex-col gap-3">
          <CandidateVideoFeed
            ref={webcamRef}
            metrics={metrics}
            isSessionActive={isSessionActive}
            selectedVideoId={selectedVideoId}
            isVideoOn={isVideoOn}
            onDevicesDiscovered={refreshDevices}
            eyeNudgeCue={vision?.eyeNudgeCue ?? null}
            postureNudgeCue={vision?.postureNudgeCue ?? null}
            visionDebug={vision?.debug ?? null}
            isVisionReady={isVisionReady}
            visionBootStage={visionBootStage}
            isCalibrating={vision?.isCalibrating ?? false}
            visionError={visionError}
            showOverlay={showVisionOverlay}
            onToggleOverlay={() => setShowVisionOverlay((v) => !v)}
            nudgeDelaySec={nudgeDelaySec}
            onCycleNudgeDelay={handleCycleNudgeDelay}
            soundEnabled={chimeEnabled && !isModalOpen}
            onToggleSound={() => setChimeEnabled((v) => !v)}
            onCalibratePosture={calibratePosture}
            trackInPreview={trackInPreview}
            onToggleTrackInPreview={() => setTrackInPreview((v) => !v)}
          />
          <div className="flex items-center gap-2 text-[13px] flex-wrap">
            <span className="badge !text-[12px] !py-1">
              Posture{" "}
              <span className="font-semibold tabular-nums">
                {vision ? `${Math.round(vision.livePostureScore)}%` : "—"}
              </span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Pace{" "}
              <span className="font-semibold tabular-nums">
                {speech ? `${metrics.wpm} WPM` : "—"}
              </span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Fillers{" "}
              <span className="font-semibold tabular-nums">
                {speech ? metrics.fillerCount : "—"}
              </span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Long pauses{" "}
              <span className="font-semibold tabular-nums">
                {speech ? speech.ui.longPauses : "—"}
              </span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Fluency{" "}
              <span className="font-semibold tabular-nums">
                {speech ? `${speech.ui.fluencyScore}%` : "—"}
              </span>
            </span>
            <div className="relative group">
              <button
                type="button"
                disabled={isModalOpen}
                onClick={() =>
                  setSpeechLang((l) => (l === "en" ? "auto" : "en"))
                }
                aria-label={`Speech recognition mode: ${
                  speechLang === "en" ? "English (MY)" : "Mixed (BM+EN)"
                }. Click to switch mode.`}
                className="h-[26px] px-2.5 rounded-[4px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[#131416] text-[11.5px] font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px] text-[#1b6c80]">
                  translate
                </span>
                {speechLang === "en" ? "English (MY)" : "Mixed (BM+EN)"}
                <span className="material-symbols-outlined text-[13px] opacity-60">
                  info
                </span>
              </button>
              <div
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 lg:left-auto lg:right-0 mb-2 w-[255px] rounded-[6px] bg-[#131416]/95 border border-white/15 p-2.5 text-left shadow-xl z-40"
              >
                <p className="text-[11.5px] font-semibold text-white">
                  Speech Recognition:{" "}
                  {speechLang === "en" ? "English (MY)" : "Mixed (BM+EN)"}
                </p>
                <p className="text-[11px] text-white/80 mt-1 leading-snug">
                  <strong className="text-white">English (MY)</strong>{" "}
                  (recommended): Best for English interviews with a Malaysian
                  accent or Manglish fillers (lah, kan, um) — keeps STAR &amp;
                  keyword scoring accurate.
                </p>
                <p className="text-[11px] text-white/80 mt-1 leading-snug">
                  <strong className="text-white">Mixed (BM+EN)</strong>: Best if
                  you mix Malay and English sentences — STAR structure and
                  common BM skill phrases are also supported.
                </p>
                <p className="text-[10.5px] text-[#4edea3] mt-1.5 font-medium">
                  Click to switch mode
                </p>
              </div>
            </div>

            {hasCurrentRecording && !speech && !isSessionActive && (
              <span className="pill-positive gap-1">
                <span className="material-symbols-outlined text-[13px]">
                  check_circle
                </span>
                Recorded · {formatDuration(currentDraft.durationSec)} · Ready for
                analysis
              </span>
            )}

            {speech && speech.ui.fillers.length > 0 && (
              <span className="text-[11.5px] text-[#5d5f60]">
                Detected:{" "}
                <span className="font-medium text-[#131416]">
                  {speech.ui.fillers.join(", ")}
                </span>
              </span>
            )}
            {speechError && (
              <span role="alert" className="text-[12px] text-[#c4242a]">
                {speechError}
              </span>
            )}
          </div>
        </section>
      </div>

      <ControlDock
        isMicOn={isMicOn}
        isVideoOn={isVideoOn}
        isSessionActive={isSessionActive}
        audioLevel={audioLevel}
        disabled={isModalOpen}
        hasRecordedCurrent={hasCurrentRecording}
        isLastQuestion={questionIndex === questions.length - 1}
        readyAnswerCount={readyAnswerCount}
        onToggleMic={() => setIsMicOn((v) => !v)}
        onToggleVideo={() => setIsVideoOn((v) => !v)}
        onToggleSession={() => void handleToggleSession()}
        onOpenSettings={() => setIsDeviceModalOpen(true)}
        onNextQuestion={handleNext}
        onFinishSession={() => void handleFinishSession()}
      />

      {/* Module 3: Collapsible interactive NLP & STAR analysis drawer */}
      <Module3Analysis
        question={currentQuestion}
        questionKeywords={currentQuestionItem.keywords}
        target={target}
        hideTargetConfig
        collapsible
        defaultExpanded={false}
        transcript={transcript}
        precomputedAnalysis={analysis}
        onTranscriptChange={handleTranscriptChange}
      />

      <DeviceSettingsModal
        isOpen={isDeviceModalOpen && !isAnalyzingModal}
        onClose={() => setIsDeviceModalOpen(false)}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioId={selectedAudioId}
        selectedVideoId={selectedVideoId}
        onSelectAudio={setSelectedAudioId}
        onSelectVideo={setSelectedVideoId}
        micGain={micGain}
        onChangeMicGain={setMicGain}
        noiseSuppression={noiseSuppression}
        onToggleNoiseSuppression={setNoiseSuppression}
        onRefreshDevices={refreshDevices}
      />

      <SessionAnalysisModal
        phase={modalPhase}
        items={queueItems}
        isCompleting={isCompleting}
        completedSession={completedSession}
        onRetryItem={handleRetryItem}
        onSkipItem={handleSkipItem}
        onCancelAnalysis={handleCancelAnalysis}
        onCloseReview={handleCloseReview}
        onStartNewSession={handleStartNewSession}
        onViewFullReport={handleViewFullReport}
      />
    </div>
  );
}
