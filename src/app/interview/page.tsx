"use client";

import { useState, useRef, useEffect } from "react";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import SessionHeader from "@/components/interview/SessionHeader";
import QuestionPrompt from "@/components/interview/QuestionPrompt";
import StarChecklist from "@/components/interview/StarChecklist";
import LiveCoachingTip from "@/components/interview/LiveCoachingTip";
import CandidateVideoFeed from "@/components/interview/CandidateVideoFeed";
import DiagnosticsBar from "@/components/interview/DiagnosticsBar";
import ControlDock from "@/components/interview/ControlDock";
import DeviceSettingsModal from "@/components/interview/DeviceSettingsModal";
import type { WebcamFeedHandle } from "@/components/interview/WebcamFeed";

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

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  const handleEndSession = () => {
    setIsSessionActive(false);
    setElapsedSeconds(0);
  };

  // STAR detection state (collapsed by default inside StarChecklist until clicked)
  const [starProgress] = useState({
    situation: {
      detected: true,
      summary: "Production staging constraint & deadline stress identified.",
    },
    task: {
      detected: true,
      summary: "Individual ownership & team responsibility scoped clearly.",
    },
    action: {
      detected: false,
      inProgress: true,
      summary:
        "Currently explaining debugging methodology, APM logs, and patch isolation.",
    },
    result: {
      detected: false,
      inProgress: false,
      summary:
        "Awaiting quantifiable business impact & retrospective insights.",
    },
  });

  // Real-time HUD metrics
  const [metrics] = useState({
    wpm: 135,
    wpmStatus: "Optimal pace",
    eyeContact: 94,
    eyeContactStatus: "Stable",
    postureAlert: "Slouching detected" as string | null,
    fillerWords: ["um", "actually"],
    volumeConsistency: 98,
    clarityIndex: 91,
    confidenceSignal: "Strong",
  });

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fbfc]">
      {/* Top 48px Studio Session Header */}
      <SessionHeader
        elapsedTime={formatTime(elapsedSeconds)}
        questionNumber={2}
        totalQuestions={5}
        role="Junior Software Engineer"
        track="Malaysian Tech Track"
        isAiListening={isSessionActive}
        onEndSession={handleEndSession}
      />

      {/* Main Split Studio Sheet */}
      <main className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1">
        {/* LEFT PANEL (5 cols): Question + Collapsible STAR Matrix + Collapsible Hint */}
        <section className="lg:col-span-5 flex flex-col gap-3.5 w-full">
          <QuestionPrompt
            question={`"Tell me about a time you faced a critical bug in production right before a project deadline. How did you diagnose the issue and communicate with your team?"`}
            isRecording={isSessionActive}
          />
          <StarChecklist progress={starProgress} />
          <LiveCoachingTip tip="Quantify the outcome (e.g., downtime avoided, latency reduced from 420ms to 85ms, or regression tests added)." />
        </section>

        {/* RIGHT PANEL (7 cols): Video Feed + Collapsible Telemetry Strip */}
        <section className="lg:col-span-7 flex flex-col gap-3.5 w-full">
          <CandidateVideoFeed
            ref={webcamRef}
            metrics={metrics}
            isSessionActive={isSessionActive}
            selectedVideoId={selectedVideoId}
            isVideoOn={isVideoOn}
            onDevicesDiscovered={refreshDevices}
          />
          <DiagnosticsBar
            volumeConsistency={metrics.volumeConsistency}
            clarityIndex={metrics.clarityIndex}
            confidenceSignal={metrics.confidenceSignal}
          />
        </section>
      </main>

      {/* Bottom Control Dock */}
      <ControlDock
        isMicOn={isMicOn}
        isVideoOn={isVideoOn}
        isSessionActive={isSessionActive}
        onToggleMic={() => setIsMicOn(!isMicOn)}
        onToggleVideo={() => setIsVideoOn(!isVideoOn)}
        onToggleSession={() => setIsSessionActive(!isSessionActive)}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioId={selectedAudioId}
        selectedVideoId={selectedVideoId}
        onSelectAudio={setSelectedAudioId}
        onSelectVideo={setSelectedVideoId}
        onOpenSettings={() => setIsDeviceModalOpen(true)}
      />

      {/* Audio & Video Device Settings Modal */}
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
