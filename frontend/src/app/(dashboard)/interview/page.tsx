"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useVisionCoach } from "@/hooks/useVisionCoach";
import { analyzeSpeech, type SpeechAnalysisResponse, type SpeechLanguageMode } from "@/lib/speechApi";
import { analyzeAnswer } from "@/lib/nlp/analyze";
import { saveSession } from "@/lib/nlp/sessionStore";
import QuestionPrompt from "@/components/interview/QuestionPrompt";
import StarChecklist, { type StarProgress } from "@/components/interview/StarChecklist";
import LiveCoachingTip from "@/components/interview/LiveCoachingTip";
import CandidateVideoFeed from "@/components/interview/CandidateVideoFeed";
import ControlDock from "@/components/interview/ControlDock";
import DeviceSettingsModal from "@/components/interview/DeviceSettingsModal";
import Module3Analysis from "@/components/interview/Module3Analysis";
import type { WebcamFeedHandle } from "@/components/interview/WebcamFeed";

const QUESTIONS = [
  "Tell me about a time you faced a critical bug in production right before a deadline. How did you handle it?",
  "Describe a disagreement with a teammate and how you resolved it.",
  "Tell me about a time you automated a repetitive task.",
];

export default function PracticeRoom() {
  const webcamRef = useRef<WebcamFeedHandle>(null);

  const {
    audioDevices,
    videoDevices,
    selectedAudioId,
    selectedVideoId,
    setSelectedAudioId,
    setSelectedVideoId,
    refreshDevices,
  } = useMediaDevices();
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  // Modules 2 and 5: record one answer, then send it to the Python backend.
  const {
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    setMuted: setRecorderMuted,
  } = useAudioRecorder(selectedAudioId);
  const [speech, setSpeech] = useState<SpeechAnalysisResponse | null>(null);
  const [speechLang, setSpeechLang] = useState<SpeechLanguageMode>("en");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Module 3: transcript and target role/company state
  const [transcript, setTranscript] = useState("");
  const [target, setTarget] = useState<{
    mode: "company" | "role" | "general";
    company: string;
    role: string;
    jobDescription: string;
  }>({
    mode: "role",
    company: "",
    role: "Software Engineer",
    jobDescription: "",
  });

  const [questionIndex, setQuestionIndex] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showVisionOverlay, setShowVisionOverlay] = useState(true);
  const [nudgeDelaySec, setNudgeDelaySec] = useState<number>(3.0);
  const [chimeEnabled, setChimeEnabled] = useState(true);

  const handleCycleNudgeDelay = () => {
    setNudgeDelaySec((prev) => (prev === 3 ? 1.5 : prev === 1.5 ? 5 : 3));
  };

  // Module 4: Real-time client-side eye contact & posture tracking (MediaPipe Face + Pose)
  const {
    vision,
    isModelReady: isVisionReady,
    error: visionError,
    calibratePosture,
    resetSession: resetVisionSession,
  } = useVisionCoach(webcamRef, {
    enabled: isVideoOn,
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

  const handleNext = () => {
    cancelRecording();
    resetVisionSession();
    setIsSessionActive(false);
    setElapsedSeconds(0);
    setSpeech(null);
    setSpeechError(null);
    setTranscript("");
    setQuestionIndex((i) => (i + 1) % QUESTIONS.length);
  };

  // Start = begin recording. Stop = send the audio for analysis (Modules 2 and 5).
  const handleToggleSession = async () => {
    if (isAnalyzing) return;

    if (!isSessionActive) {
      setSpeech(null);
      setSpeechError(null);
      resetVisionSession();
      try {
        await startRecording();
        setElapsedSeconds(0);
        setIsSessionActive(true);
      } catch {
        setSpeechError("Cannot use the microphone. Check the browser permission and the selected device.");
      }
      return;
    }

    setIsSessionActive(false);
    const audio = await stopRecording();
    if (!audio || audio.size === 0) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeSpeech(audio, speechLang);
      setSpeech(result);
      if (result.ui.transcript) {
        setTranscript(result.ui.transcript);
      }
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : "Speech analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Module 3 live NLP & STAR analysis driven by current transcript (from Module 2 or typed/pasted)
  const currentQuestion = QUESTIONS[questionIndex];
  const analysis = useMemo(
    () =>
      analyzeAnswer(transcript, {
        role: target.mode === "role" || target.mode === "company" ? target.role : "",
        jobDescription: target.mode === "company" ? target.jobDescription : "",
        question: currentQuestion,
      }),
    [transcript, target.mode, target.role, target.jobDescription, currentQuestion]
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

  const handleEndSession = () => {
    if (transcript.trim()) {
      saveSession({
        id: `session-${Date.now()}`,
        completedAt: new Date().toISOString(),
        mode: target.mode,
        company: target.company,
        role: target.role,
        jobDescription: target.jobDescription,
        answers: [{ question: currentQuestion, transcript, analysis }],
      });
    }
  };

  // Module 5 values come from the speech backend after each answer.
  // Module 4 values (eyeContact, postureAlert) come live from useVisionCoach (rolling 6s score).
  const metrics = {
    wpm: speech?.ui.wpm ?? 0,
    eyeContact: vision ? Math.round(vision.liveEyeContactScore) : 100,
    postureAlert: vision?.postureNudge ?? null,
    fillerCount: speech?.ui.fillerCount ?? 0,
  };

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timer = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <div className="max-w-[1180px] mx-auto pb-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2 text-[13px] text-[#5d5f60] min-w-0">
          <span className="font-medium text-[#131416] tabular-nums">
            Question {questionIndex + 1} of {QUESTIONS.length}
          </span>
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
          <span className="h-[30px] px-2.5 rounded-[6px] border border-[#e8eaec] flex items-center gap-1.5 text-[13px] font-medium text-[#131416] tabular-nums">
            <span className={`w-2 h-2 rounded-full ${isSessionActive ? "bg-[#c4242a]" : "bg-[#cdced1]"}`} />
            {timer}
          </span>
          <Link
            href="/reports"
            onClick={handleEndSession}
            className="h-[30px] px-3 rounded-[6px] text-[13px] font-medium text-[#131416] border border-[#cdced1] hover:bg-[#f4f6f8] flex items-center"
          >
            End session
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: question, STAR, tip */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <QuestionPrompt
            question={currentQuestion}
            keywords={["Root cause", "Logs / monitoring", "Rollback plan", "Team update", "Measured result"]}
            isRecording={isSessionActive && isMicOn}
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
            isCalibrating={vision?.isCalibrating ?? false}
            visionError={visionError}
            showOverlay={showVisionOverlay}
            onToggleOverlay={() => setShowVisionOverlay((v) => !v)}
            nudgeDelaySec={nudgeDelaySec}
            onCycleNudgeDelay={handleCycleNudgeDelay}
            soundEnabled={chimeEnabled}
            onToggleSound={() => setChimeEnabled((v) => !v)}
            onCalibratePosture={calibratePosture}
          />
          <div className="flex items-center gap-2 text-[13px] flex-wrap">
            <span className="badge !text-[12px] !py-1">
              Posture <span className="font-semibold tabular-nums">{vision ? `${Math.round(vision.livePostureScore)}%` : "—"}</span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Pace <span className="font-semibold tabular-nums">{speech ? `${metrics.wpm} WPM` : "—"}</span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Fillers <span className="font-semibold tabular-nums">{speech ? metrics.fillerCount : "—"}</span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Long pauses <span className="font-semibold tabular-nums">{speech ? speech.ui.longPauses : "—"}</span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Fluency <span className="font-semibold tabular-nums">{speech ? `${speech.ui.fluencyScore}%` : "—"}</span>
            </span>
            <button
              type="button"
              onClick={() => setSpeechLang((l) => (l === "en" ? "auto" : "en"))}
              title="Switch speech recognition mode: Manglish (English script) vs Auto (Malay + English code-switching)"
              className="h-[26px] px-2.5 rounded-[4px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[#131416] text-[11.5px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] text-[#1b6c80]">translate</span>
              {speechLang === "en" ? "Manglish (EN)" : "Auto (BM+EN)"}
            </button>
            {speech && speech.ui.fillers.length > 0 && (
              <span className="text-[11.5px] text-[#5d5f60]">
                Detected: <span className="font-medium text-[#131416]">{speech.ui.fillers.join(", ")}</span>
              </span>
            )}
            {isAnalyzing && <span className="text-[12px] text-[#5d5f60]">Analysing your answer…</span>}
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
        onToggleMic={() => setIsMicOn((v) => !v)}
        onToggleVideo={() => setIsVideoOn((v) => !v)}
        onToggleSession={handleToggleSession}
        onOpenSettings={() => setIsDeviceModalOpen(true)}
        onNextQuestion={handleNext}
      />

      {/* Module 3: Full interactive NLP & STAR analysis panel */}
      <Module3Analysis
        question={currentQuestion}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        onTargetChange={setTarget}
      />

      <DeviceSettingsModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioId={selectedAudioId}
        selectedVideoId={selectedVideoId}
        onSelectAudio={setSelectedAudioId}
        onSelectVideo={setSelectedVideoId}
        onRefreshDevices={refreshDevices}
      />
    </div>
  );
}
