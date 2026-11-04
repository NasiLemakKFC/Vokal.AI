"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import QuestionPrompt from "@/components/interview/QuestionPrompt";
import StarChecklist from "@/components/interview/StarChecklist";
import LiveCoachingTip from "@/components/interview/LiveCoachingTip";
import CandidateVideoFeed from "@/components/interview/CandidateVideoFeed";
import ControlDock from "@/components/interview/ControlDock";
import DeviceSettingsModal from "@/components/interview/DeviceSettingsModal";
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

  const [questionIndex, setQuestionIndex] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  const handleNext = () => {
    setIsSessionActive(false);
    setElapsedSeconds(0);
    setQuestionIndex((i) => (i + 1) % QUESTIONS.length);
  };

  // Mock STAR detection (Module 3) — to be driven by backend NLP.
  const [starProgress] = useState({
    situation: { detected: true, summary: "Production outage and deadline pressure described." },
    task: { detected: true, summary: "Your own responsibility is clear." },
    action: { detected: false, inProgress: true, summary: "Explaining how you debugged and fixed it." },
    result: { detected: false, inProgress: false, summary: "Not yet — finish with a measurable outcome." },
  });

  // Mock live metrics (Modules 4 & 5) — to be driven by MediaPipe + Whisper.
  const [metrics] = useState({
    wpm: 135,
    eyeContact: 94,
    postureAlert: "Sit up straight" as string | null,
    fillerCount: 2,
  });

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timer = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <div className="max-w-[1180px] mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2 text-[13px] text-[#5d5f60] min-w-0">
          <span className="font-medium text-[#131416] tabular-nums">
            Question {questionIndex + 1} of {QUESTIONS.length}
          </span>
          <span className="text-[#cdced1]">·</span>
          <span className="truncate">Junior Software Engineer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-[30px] px-2.5 rounded-[6px] border border-[#e8eaec] flex items-center gap-1.5 text-[13px] font-medium text-[#131416] tabular-nums">
            <span className={`w-2 h-2 rounded-full ${isSessionActive ? "bg-[#c4242a]" : "bg-[#cdced1]"}`} />
            {timer}
          </span>
          <Link
            href="/reports"
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
            question={QUESTIONS[questionIndex]}
            keywords={["Root cause", "Logs / monitoring", "Rollback plan", "Team update", "Measured result"]}
            isRecording={isSessionActive && isMicOn}
          />
          <StarChecklist progress={starProgress} />
          <LiveCoachingTip tip="Finish with a number — e.g. latency dropped from 420 ms to 85 ms." />
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
          />
          <div className="flex items-center gap-2 text-[13px]">
            <span className="badge !text-[12px] !py-1">
              Pace <span className="font-semibold tabular-nums">{metrics.wpm} WPM</span>
            </span>
            <span className="badge !text-[12px] !py-1">
              Fillers <span className="font-semibold tabular-nums">{metrics.fillerCount}</span>
            </span>
          </div>
        </section>
      </div>

      <ControlDock
        isMicOn={isMicOn}
        isVideoOn={isVideoOn}
        isSessionActive={isSessionActive}
        onToggleMic={() => setIsMicOn((v) => !v)}
        onToggleVideo={() => setIsVideoOn((v) => !v)}
        onToggleSession={() => setIsSessionActive((v) => !v)}
        onOpenSettings={() => setIsDeviceModalOpen(true)}
        onNextQuestion={handleNext}
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
