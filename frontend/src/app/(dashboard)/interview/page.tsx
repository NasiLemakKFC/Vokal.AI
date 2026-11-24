"use client";

import { Suspense, useState, useRef, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useVisionCoach } from "@/hooks/useVisionCoach";
import {
  useBackgroundTranscription,
  type BackgroundTranscriptionStatus,
} from "@/hooks/useBackgroundTranscription";
import { useInterviewPrep } from "@/hooks/useInterviewPrep";
import { useInterviewShortcuts } from "@/hooks/useInterviewShortcuts";
import {
  analyzeSpeech,
  type SpeechAnalysisResponse,
  type SpeechLanguageMode,
} from "@/lib/speechApi";
import { formatDuration } from "@/lib/format";
import { analyzeAnswer } from "@/lib/nlp/analyze";
import {
  createSession,
  type SavedSession,
  type VisionSnapshot,
} from "@/lib/nlp/sessionStore";
import {
  EMPTY_DRAFT,
  executeAnalysisQueue,
  isDraftReady,
  type QuestionDraft,
} from "@/lib/interview/analysisQueue";
import { DEFAULT_QUESTIONS } from "@/lib/interview/types";
import QuestionPrompt, {
  type FollowUpProbe,
} from "@/components/interview/QuestionPrompt";
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

function buildFollowUpProbe(
  transcript: string,
  analysis: ReturnType<typeof analyzeAnswer>
): FollowUpProbe | null {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) return null;

  if (!analysis.star.result.found) {
    return {
      pillarLabel: "Missing Result",
      prompt:
        "What measurable outcome or concrete improvement proved your solution worked?",
    };
  }
  if (!analysis.star.action.found) {
    return {
      pillarLabel: "Clarify Action",
      prompt:
        "Walk me through the exact technical steps and decisions you personally took rather than the team as a whole.",
    };
  }
  if (!analysis.star.task.found) {
    return {
      pillarLabel: "Clarify Task",
      prompt:
        "What specific responsibility or target were you personally accountable for in that situation?",
    };
  }
  if (words.length < 30) {
    return {
      pillarLabel: "Add Depth",
      prompt:
        "Could you expand briefly on the biggest technical trade-off you had to make and why?",
    };
  }
  return null;
}

function PracticeRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const webcamRef = useRef<WebcamFeedHandle>(null);

  const initialRetry = useMemo(() => {
    const prompt = searchParams.get("retryPrompt")?.trim();
    if (!prompt) return null;
    const role = searchParams.get("retryRole")?.trim() || undefined;
    const kwRaw = searchParams.get("retryKeywords")?.trim();
    const keywords = kwRaw
      ? kwRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6)
      : undefined;
    return { prompt, role, keywords };
  }, [searchParams]);

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
  const updateDrafts = useCallback((next: Record<number, QuestionDraft>) => {
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const handleBackgroundTranscriptionStatus = useCallback(
    (
      qIdx: number,
      audioVersion: number,
      status: BackgroundTranscriptionStatus,
      result?: SpeechAnalysisResponse,
      errorMessage?: string
    ) => {
      const current = draftsRef.current[qIdx];
      if (!current || current.audioVersion !== audioVersion) return;

      const updated: QuestionDraft = {
        ...current,
        transcriptionStatus: status,
        transcriptionError: status === "error" ? (errorMessage ?? null) : null,
        ...(status === "done" && result
          ? {
              speech: result,
              manualTranscript: result.ui.transcript || current.manualTranscript,
            }
          : {}),
      };
      updateDrafts({ ...draftsRef.current, [qIdx]: updated });
    },
    [updateDrafts]
  );

  const {
    enqueue: enqueueBgTranscription,
    waitForQuestion: waitForBgTranscription,
    cancelAll: cancelAllBgTranscription,
  } = useBackgroundTranscription({
    onStatusChange: handleBackgroundTranscriptionStatus,
  });

  const [speechLang, setSpeechLang] = useState<SpeechLanguageMode>("en");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<"main" | "followup">("main");
  const recordingTargetRef = useRef<"main" | "followup">("main");
  const setRecordingMode = useCallback((mode: "main" | "followup") => {
    recordingTargetRef.current = mode;
    setRecordingTarget(mode);
  }, []);
  const [transcribingFollowUpIdx, setTranscribingFollowUpIdx] = useState<number | null>(
    null
  );
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
  const [sessionSaveError, setSessionSaveError] = useState<string | null>(null);
  const [isRetryingSave, setIsRetryingSave] = useState(false);

  const analysisRunIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const handleQuestionsReplaced = useCallback(() => {
    cancelAllBgTranscription();
    cancelRecording();
    resetVisionSession();
    updateDrafts({});
    setQuestionIndex(0);
    setElapsedSeconds(0);
    setIsSessionActive(false);
    setRecordingMode("main");
    setTranscribingFollowUpIdx(null);
    setSpeechError(null);
  }, [
    cancelAllBgTranscription,
    cancelRecording,
    resetVisionSession,
    updateDrafts,
    setRecordingMode,
  ]);

  // Compute ready count via ref/state cleanly
  const readyAnswerCountForPrep = useMemo(
    () => Object.values(drafts).filter((d) => isDraftReady(d)).length,
    [drafts]
  );

  // Module 1 & 3 setup state (3/5/7Q, experience level, resume & JD tailoring)
  const {
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
  } = useInterviewPrep({
    isModalOpen,
    readyAnswerCount: readyAnswerCountForPrep,
    initialRetry,
    onQuestionsReplaced: handleQuestionsReplaced,
  });

  const readyAnswerCount = useMemo(
    () => questions.filter((_, idx) => isDraftReady(drafts[idx])).length,
    [questions, drafts]
  );

  // Warn before accidental reload/close when unsaved recordings exist
  useEffect(() => {
    const hasUnsavedWork = (readyAnswerCount > 0 || isSessionActive) && !completedSession;
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [readyAnswerCount, isSessionActive, completedSession]);

  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  useEffect(() => {
    setRecorderMuted(!isMicOn);
  }, [isMicOn, setRecorderMuted]);

  useEffect(() => {
    document.documentElement.dataset.onAir = isSessionActive ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.onAir;
    };
  }, [isSessionActive]);

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

  const handleCycleNudgeDelay = () => {
    setNudgeDelaySec((prev) => (prev === 3 ? 1.5 : prev === 1.5 ? 5 : 3));
  };

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
    snap: VisionSnapshot | null,
    options?: { enqueueBackground?: boolean }
  ): Promise<Record<number, QuestionDraft>> => {
    const mode = recordingTargetRef.current;
    setRecordingMode("main");
    const audio = await stopRecording();
    const existing = draftsRef.current[idx] ?? EMPTY_DRAFT;

    if (mode === "followup") {
      const nextFollowUpVersion = (existing.followUpVersion ?? 0) + 1;
      const nextDraft: QuestionDraft =
        audio && audio.size > 0
          ? {
              ...existing,
              followUpAudioBlob: audio,
              followUpDurationSec: durationSec,
              followUpSpeech: null,
              followUpVersion: nextFollowUpVersion,
            }
          : existing;
      const nextMap = { ...draftsRef.current, [idx]: nextDraft };
      updateDrafts(nextMap);

      if (audio && audio.size > 0 && options?.enqueueBackground !== false) {
        setTranscribingFollowUpIdx(idx);
        void analyzeSpeech(audio, speechLang)
          .then((res) => {
            const cur = draftsRef.current[idx];
            if (!cur || (cur.followUpVersion ?? 0) !== nextFollowUpVersion) return;
            updateDrafts({
              ...draftsRef.current,
              [idx]: {
                ...cur,
                followUpSpeech: res,
                followUpTranscript: res.ui.transcript || cur.followUpTranscript || "",
              },
            });
          })
          .catch(() => {
            // Silently defer to final analysisQueue retry if backend is busy/offline
          })
          .finally(() => {
            setTranscribingFollowUpIdx((prev) => (prev === idx ? null : prev));
          });
      }
      return nextMap;
    }

    const nextVersion = existing.audioVersion + 1;
    const nextDraft: QuestionDraft =
      audio && audio.size > 0
        ? {
            ...existing,
            audioBlob: audio,
            durationSec,
            visionSnapshot: snap,
            speech: null,
            audioVersion: nextVersion,
            transcriptionStatus: "idle",
            transcriptionError: null,
            // Clear prior follow-up when re-recording the main answer from scratch
            followUpPrompt: null,
            followUpPillarLabel: null,
            followUpAudioBlob: null,
            followUpDurationSec: 0,
            followUpTranscript: "",
            followUpSpeech: null,
          }
        : {
            ...existing,
            visionSnapshot: snap ?? existing.visionSnapshot,
          };
    const nextMap = { ...draftsRef.current, [idx]: nextDraft };
    updateDrafts(nextMap);

    if (audio && audio.size > 0 && options?.enqueueBackground !== false) {
      enqueueBgTranscription(idx, audio, nextVersion, speechLang);
    }
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

  const handleToggleSession = async () => {
    if (isModalOpen) return;

    if (!isSessionActive) {
      setSpeechError(null);
      setRecordingMode("main");
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

  const handleAnswerFollowUp = async (probe: FollowUpProbe) => {
    if (isModalOpen || isSessionActive) return;
    setSpeechError(null);
    const existing = draftsRef.current[questionIndex] ?? EMPTY_DRAFT;
    updateDrafts({
      ...draftsRef.current,
      [questionIndex]: {
        ...existing,
        followUpPrompt: probe.prompt,
        followUpPillarLabel: probe.pillarLabel,
      },
    });
    setRecordingMode("followup");
    try {
      await startRecording();
      setElapsedSeconds(0);
      setIsSessionActive(true);
      setIsSetupExpanded(false);
    } catch {
      setRecordingMode("main");
      setSpeechError(
        "Cannot use the microphone. Check the browser permission and the selected device."
      );
    }
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
      waitForBackgroundTranscription: waitForBgTranscription,
      updateQueueItems,
      updateDrafts,
      setCompletedSession,
      setIsCompleting,
      setModalPhase,
      setSaveError: setSessionSaveError,
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
        snap,
        { enqueueBackground: false }
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
    setSessionSaveError(null);
    setIsRetryingSave(false);
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
    handleQuestionsReplaced();
    updateQueueItems([]);
    setCompletedSession(null);
    setSessionSaveError(null);
    setIsRetryingSave(false);
    setIsCompleting(false);
    setModalPhase("closed");
  };

  const handleViewFullReport = (sessionId: string) => {
    setModalPhase("closed");
    router.push(`/reports?session=${encodeURIComponent(sessionId)}`);
  };

  const handleRetrySave = async () => {
    if (!completedSession || isRetryingSave) return;
    setIsRetryingSave(true);
    try {
      const saved = await createSession(completedSession);
      setCompletedSession(saved);
      setSessionSaveError(null);
    } catch (err) {
      setSessionSaveError(
        err instanceof Error
          ? `Could not save session: ${err.message}`
          : "Could not save session to your reports."
      );
    } finally {
      setIsRetryingSave(false);
    }
  };

  // Module 3 live NLP & STAR analysis: evaluate main answer to trigger follow-up, and combined answer for live STAR checklist
  const baseAnalysis = useMemo(
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

  const followUpTranscript = currentDraft.followUpTranscript ?? "";
  const combinedTranscript = followUpTranscript.trim()
    ? `${transcript}\n${followUpTranscript.trim()}`.trim()
    : transcript;

  const analysis = useMemo(
    () =>
      followUpTranscript.trim()
        ? analyzeAnswer(combinedTranscript, {
            role: target.mode === "role" || target.mode === "company" ? target.role : "",
            jobDescription: target.mode !== "general" ? target.jobDescription : "",
            question: currentQuestion,
            questionKeywords: currentQuestionItem.keywords,
          })
        : baseAnalysis,
    [
      followUpTranscript,
      combinedTranscript,
      target.mode,
      target.role,
      target.jobDescription,
      currentQuestion,
      currentQuestionItem.keywords,
      baseAnalysis,
    ]
  );

  const isRecordingFollowUp = isSessionActive && recordingTarget === "followup";
  const hasFollowUpRecording = Boolean(
    (currentDraft.followUpAudioBlob && currentDraft.followUpAudioBlob.size > 0) ||
      followUpTranscript.trim().length > 0
  );

  const followUpProbe = useMemo<FollowUpProbe | null>(() => {
    if (isSessionActive && recordingTarget === "main") return null;
    if (currentDraft.followUpPrompt) {
      return {
        pillarLabel: currentDraft.followUpPillarLabel || "Follow-up",
        prompt: currentDraft.followUpPrompt,
      };
    }
    return buildFollowUpProbe(transcript, baseAnalysis);
  }, [
    isSessionActive,
    recordingTarget,
    currentDraft.followUpPrompt,
    currentDraft.followUpPillarLabel,
    transcript,
    baseAnalysis,
  ]);

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

  useInterviewShortcuts({
    toggleSession: handleToggleSession,
    nextQuestion: handleNext,
    prevQuestion: handlePrev,
    toggleMic: () => setIsMicOn((v) => !v),
    disabled: isModalOpen || isDeviceModalOpen || isGeneratingPrep,
  });

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
    <div className="max-w-[1200px] mx-auto pb-10">
      <SessionSetupCard
        target={target}
        onTargetChange={setTarget}
        questionCount={questionCount}
        onQuestionCountChange={(nextCount) =>
          handleQuestionCountChange(nextCount, (maxIdx) =>
            setQuestionIndex((prev) => Math.min(prev, maxIdx))
          )
        }
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
        presets={presets}
        activePresetId={activePresetId}
        onSavePreset={handleSavePreset}
        onLoadPreset={(preset) =>
          handleLoadPreset(preset, (maxIdx) =>
            setQuestionIndex((prev) => Math.min(prev, maxIdx))
          )
        }
        onDeletePreset={handleDeletePreset}
        onClearSetup={handleClearSetup}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted)] min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Questions">
            {questions.map((_, idx) => {
              const isActive = idx === questionIndex;
              const draftForTab = drafts[idx];
              const isReady = isDraftReady(draftForTab);
              const isTranscribingTab =
                draftForTab?.transcriptionStatus === "transcribing" ||
                draftForTab?.transcriptionStatus === "queued";
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={isModalOpen}
                  title={
                    isTranscribingTab
                      ? `Q${idx + 1} · Transcribing in background…`
                      : draftForTab?.speech
                        ? `Q${idx + 1} · Transcribed (${draftForTab.speech.ui.wpm} WPM)`
                        : isReady
                          ? `Q${idx + 1} · Recorded`
                          : `Q${idx + 1}`
                  }
                  onClick={() => void handleSelectQuestion(idx)}
                  className={`h-8 px-3 rounded-[var(--radius-control)] border text-[12px] font-medium tabular-nums flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                    isActive
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--border-accent)]"
                      : isReady
                        ? "bg-[var(--surface)] text-[var(--text)] border-[var(--pill-positive-border)] hover:bg-[var(--raised)]"
                        : "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--raised)] hover:text-[var(--text)]"
                  }`}
                >
                  Q{idx + 1}
                  {isTranscribingTab ? (
                    <span
                      aria-label="Transcribing"
                      className="w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"
                    />
                  ) : isReady ? (
                    <span className="material-symbols-outlined text-[15px] text-[var(--positive)]">
                      check_circle
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <span className="text-[var(--control)]">·</span>
          <span className="truncate font-medium text-[var(--text-secondary)]">
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
            className={`h-8 px-3 rounded-[var(--radius-control)] border flex items-center gap-2 text-[13px] font-medium tabular-nums transition-colors ${
              timerPacingState === "optimal"
                ? "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)] border-[var(--pill-positive-border)]"
                : timerPacingState === "wrap_up"
                  ? "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)] border-[var(--pill-warning-border)]"
                  : "bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isSessionActive
                  ? timerPacingState === "optimal"
                    ? "bg-[var(--positive)]"
                    : timerPacingState === "wrap_up"
                      ? "bg-[var(--warning-ink)]"
                      : "bg-[var(--negative)]"
                  : "bg-[var(--control)]"
              }`}
            />
            <span className="font-mono">{formatDuration(elapsedSeconds)}</span>
            {isSessionActive && (
              <span className="hidden sm:inline text-[12px] font-normal opacity-80">
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
            className={`h-8 px-3 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              canFinish ? "btn-primary" : "btn-secondary"
            }`}
          >
            <span>Finish &amp; analyze</span>
            {readyAnswerCount > 0 && (
              <span className="font-mono tabular-nums">({readyAnswerCount})</span>
            )}
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: question, STAR, tip */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <QuestionPrompt
            question={currentQuestion}
            keywords={currentQuestionItem.keywords}
            isRecording={isSessionActive && isMicOn}
            isRecordingFollowUp={isRecordingFollowUp}
            questionType={currentQuestionItem.type}
            rationale={currentQuestionItem.rationale}
            followUpProbe={followUpProbe}
            hasFollowUpRecording={hasFollowUpRecording}
            isTranscribingFollowUp={transcribingFollowUpIdx === questionIndex}
            followUpTranscript={followUpTranscript}
            onStartRecording={() => {
              if (!isSessionActive) {
                void handleToggleSession();
              }
            }}
            onAnswerFollowUp={() => {
              if (followUpProbe && !isSessionActive) {
                void handleAnswerFollowUp(followUpProbe);
              }
            }}
            onStopFollowUp={() => {
              if (isRecordingFollowUp) {
                void handleToggleSession();
              }
            }}
          />
          <StarChecklist progress={starProgress} />
          <LiveCoachingTip tip={liveTip} />
        </section>

        {/* Right: video + instrument telemetry strip */}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] divide-x divide-[var(--rule)]">
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Posture</span>
                <span className="text-[13px] font-mono font-medium tabular-nums text-[var(--text)]">
                  {vision ? `${Math.round(vision.livePostureScore)}%` : "—"}
                </span>
              </div>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Pace</span>
                <span className="text-[13px] font-mono font-medium tabular-nums text-[var(--text)]">
                  {speech ? `${metrics.wpm} WPM` : "—"}
                </span>
              </div>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Fillers</span>
                <span className="text-[13px] font-mono font-medium tabular-nums text-[var(--text)]">
                  {speech ? metrics.fillerCount : "—"}
                </span>
              </div>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Long pauses</span>
                <span className="text-[13px] font-mono font-medium tabular-nums text-[var(--text)]">
                  {speech ? speech.ui.longPauses : "—"}
                </span>
              </div>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Fluency</span>
                <span className="text-[13px] font-mono font-medium tabular-nums text-[var(--text)]">
                  {speech ? `${speech.ui.fluencyScore}%` : "—"}
                </span>
              </div>
            </div>

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
                className="h-8 px-3 rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--text)] text-[12px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px] text-[var(--muted)]">
                  translate
                </span>
                <span>{speechLang === "en" ? "English (MY)" : "Mixed (BM+EN)"}</span>
                <span className="material-symbols-outlined text-[15px] text-[var(--muted)]">
                  info
                </span>
              </button>
              <div
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 lg:left-auto lg:right-0 mb-2 w-64 rounded-[var(--radius-control)] bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] p-3 text-left z-40"
                style={{ boxShadow: "var(--shadow-popover)" }}
              >
                <p className="text-[12px] font-medium text-[var(--text)]">
                  Speech recognition:{" "}
                  {speechLang === "en" ? "English (MY)" : "Mixed (BM+EN)"}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1 leading-snug">
                  <strong className="font-medium text-[var(--text)]">English (MY)</strong>{" "}
                  (recommended) handles Malaysian English accents and fillers like lah and um
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1 leading-snug">
                  <strong className="font-medium text-[var(--text)]">Mixed (BM+EN)</strong>{" "}
                  supports code-switching between Malay and English
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-1.5">
                  Click to switch mode
                </p>
              </div>
            </div>
          </div>

          {(hasCurrentRecording && !isSessionActive) ||
          (speech && speech.ui.fillers.length > 0) ||
          speechError ? (
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              {hasCurrentRecording && !isSessionActive && (
                currentDraft.transcriptionStatus === "transcribing" ||
                currentDraft.transcriptionStatus === "queued" ? (
                  <span className="badge gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                    {currentDraft.transcriptionStatus === "transcribing"
                      ? `Recorded · ${formatDuration(currentDraft.durationSec)} · Transcribing in background…`
                      : `Recorded · ${formatDuration(currentDraft.durationSec)} · Queued for transcription…`}
                  </span>
                ) : speech ? (
                  <span className="pill-positive gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">
                      check_circle
                    </span>
                    Transcribed · {formatDuration(currentDraft.durationSec)} · Ready for STAR review
                  </span>
                ) : (
                  <span className="pill-positive gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">
                      check_circle
                    </span>
                    Recorded · {formatDuration(currentDraft.durationSec)} · Ready for analysis
                  </span>
                )
              )}
              {speech && speech.ui.fillers.length > 0 && (
                <span className="text-[var(--muted)]">
                  Detected:{" "}
                  <span className="font-medium text-[var(--text)]">
                    {speech.ui.fillers.join(", ")}
                  </span>
                </span>
              )}
              {speechError && (
                <span role="alert" className="text-[var(--negative)]">
                  {speechError}
                </span>
              )}
            </div>
          ) : null}
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
        saveError={sessionSaveError}
        isRetryingSave={isRetryingSave}
        onRetrySave={() => void handleRetrySave()}
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

export default function PracticeRoom() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto py-8 text-[13px] text-[var(--muted)]">
          Loading practice room…
        </div>
      }
    >
      <PracticeRoomContent />
    </Suspense>
  );
}
