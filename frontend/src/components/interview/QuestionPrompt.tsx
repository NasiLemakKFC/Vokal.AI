"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { InterviewQuestionType } from "@/lib/interview/types";

export interface FollowUpProbe {
  pillarLabel: string;
  prompt: string;
}

interface QuestionPromptProps {
  question: string;
  keywords?: string[];
  isRecording?: boolean;
  isRecordingFollowUp?: boolean;
  questionType?: InterviewQuestionType;
  rationale?: string;
  /** Optional dynamic follow-up probe surfaced after a short or incomplete STAR draft. */
  followUpProbe?: FollowUpProbe | null;
  hasFollowUpRecording?: boolean;
  isTranscribingFollowUp?: boolean;
  followUpTranscript?: string;
  onStartRecording?: () => void;
  onAnswerFollowUp?: () => void;
  onStopFollowUp?: () => void;
}

const QUESTION_TYPE_LABELS: Record<InterviewQuestionType, string> = {
  resume_deep_dive: "Resume deep-dive",
  jd_gap: "JD gap probe",
  role_behavioral: "Role behavioral",
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const THINK_TIME_SEC = 15;

/** Module 1 — interview prompt with browser TTS read-aloud, 15s think timer, keywords toggle & follow-up probe. */
export default function QuestionPrompt({
  question,
  keywords = [],
  isRecording = false,
  isRecordingFollowUp = false,
  questionType,
  rationale,
  followUpProbe = null,
  hasFollowUpRecording = false,
  isTranscribingFollowUp = false,
  followUpTranscript = "",
  onStartRecording,
  onAnswerFollowUp,
  onStopFollowUp,
}: QuestionPromptProps) {
  const [showKeywords, setShowKeywords] = useState(false);
  const [speakingQuestion, setSpeakingQuestion] = useState<string | null>(null);
  const [thinkState, setThinkState] = useState<{
    question: string;
    left: number;
  } | null>(null);

  const canSpeak =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const isSpeaking = !isRecording && speakingQuestion === question;
  const thinkLeft =
    !isRecording && thinkState && thinkState.question === question
      ? thinkState.left
      : null;

  // Cancel browser TTS (external API) when switching questions, recording, or unmounting
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [question, isRecording]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 15-second optional prep / think countdown (all state updates happen inside timeout callback)
  useEffect(() => {
    if (thinkLeft === null) return;
    const timer = window.setTimeout(() => {
      if (thinkLeft <= 1) {
        setThinkState(null);
        onStartRecording?.();
      } else {
        setThinkState({ question, left: thinkLeft - 1 });
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [thinkLeft, question, onStartRecording]);

  const handleToggleSpeak = () => {
    if (!canSpeak) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setSpeakingQuestion(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.rate = 0.96;
    utterance.onend = () => setSpeakingQuestion(null);
    utterance.onerror = () => setSpeakingQuestion(null);
    setSpeakingQuestion(question);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleThinkTimer = () => {
    if (isRecording) return;
    setThinkState((prev) =>
      prev && prev.question === question
        ? null
        : { question, left: THINK_TIME_SEC }
    );
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-2 text-[12px] font-medium ${
              isRecording ? "text-[var(--negative)]" : "text-[var(--muted)]"
            }`}
          >
            <span
              className={`inline-block rounded-full h-2 w-2 ${
                isRecording ? "bg-[var(--negative)]" : "bg-[var(--control)]"
              }`}
            />
            {isRecording ? "Listening" : "Ready"}
          </span>
          {questionType && (
            <span className="badge">{QUESTION_TYPE_LABELS[questionType]}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {canSpeak && (
            <button
              type="button"
              onClick={handleToggleSpeak}
              aria-pressed={isSpeaking}
              title={
                isSpeaking
                  ? "Stop reading aloud"
                  : "Read question aloud so you can keep looking at the camera"
              }
              className={`h-8 px-2.5 rounded-[var(--radius-control)] text-[12px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                isSpeaking
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isSpeaking ? "stop_circle" : "volume_up"}
              </span>
              <span className="hidden sm:inline">
                {isSpeaking ? "Stop" : "Read aloud"}
              </span>
            </button>
          )}

          {!isRecording && (
            <button
              type="button"
              onClick={handleToggleThinkTimer}
              aria-pressed={thinkLeft !== null}
              title="15-second prep countdown before recording starts"
              className={`h-8 px-2.5 rounded-[var(--radius-control)] text-[12px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                thinkLeft !== null
                  ? "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)] border border-[var(--pill-warning-border)]"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">timer</span>
              <span className="font-mono tabular-nums">
                {thinkLeft !== null ? `${thinkLeft}s` : "15s prep"}
              </span>
            </button>
          )}

          {keywords.length > 0 && (
            <button
              type="button"
              onClick={() => setShowKeywords((prev) => !prev)}
              aria-expanded={showKeywords}
              className={`h-8 px-2.5 rounded-[var(--radius-control)] text-[12px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                showKeywords
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]/70"
              }`}
            >
              Keywords
              <motion.span
                animate={{ rotate: showKeywords ? 180 : 0 }}
                transition={{ duration: 0.16, ease: EASE_OUT }}
                className="material-symbols-outlined text-[16px]"
              >
                expand_more
              </motion.span>
            </button>
          )}
        </div>
      </div>

      <h2 className="text-[18px] font-medium text-[var(--text)] leading-snug">
        {question}
      </h2>

      {rationale && (
        <p className="text-[13px] text-[var(--muted)] leading-snug">
          {rationale}
        </p>
      )}

      {thinkLeft !== null && (
        <div
          aria-live="polite"
          className="rounded-[var(--radius-control)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3 py-2 flex items-center justify-between gap-2 text-[12px] text-[var(--pill-warning-ink)]"
        >
          <span>
            Outline your S · T · A · R points — recording begins in{" "}
            <strong className="font-mono tabular-nums">{thinkLeft}s</strong>
          </span>
          <button
            type="button"
            onClick={() => setThinkState(null)}
            className="font-medium underline cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showKeywords && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex flex-wrap gap-1.5 pt-1"
          >
            {keywords.map((kw) => (
              <span key={kw} className="badge">
                {kw}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Interviewer Follow-Up Probe */}
      <AnimatePresence initial={false}>
        {followUpProbe && (!isRecording || isRecordingFollowUp) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className={`rounded-[var(--radius-control)] border p-3 space-y-2 transition-colors ${
              isRecordingFollowUp
                ? "border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)]/60"
                : hasFollowUpRecording
                  ? "border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)]/45"
                  : "border-[var(--border-accent)] bg-[var(--accent-soft)]/60"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                  isRecordingFollowUp
                    ? "text-[var(--pill-negative-ink)]"
                    : hasFollowUpRecording
                      ? "text-[var(--pill-positive-ink)]"
                      : "text-[var(--accent-ink)]"
                }`}
              >
                {isRecordingFollowUp ? (
                  <span className="w-2 h-2 rounded-full bg-[var(--negative)] animate-pulse" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">
                    {hasFollowUpRecording ? "check_circle" : "forum"}
                  </span>
                )}
                {isRecordingFollowUp
                  ? "Listening to follow-up…"
                  : hasFollowUpRecording
                    ? `Follow-up recorded · ${followUpProbe.pillarLabel}`
                    : `Interviewer follow-up · ${followUpProbe.pillarLabel}`}
              </span>

              {isRecordingFollowUp ? (
                onStopFollowUp && (
                  <button
                    type="button"
                    onClick={onStopFollowUp}
                    className="h-7 px-2.5 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--pill-negative-border)] text-[11px] font-medium text-[var(--pill-negative-ink)] hover:bg-[var(--raised)] cursor-pointer transition-colors"
                  >
                    Stop follow-up
                  </button>
                )
              ) : (
                onAnswerFollowUp && (
                  <button
                    type="button"
                    onClick={onAnswerFollowUp}
                    className="h-7 px-2.5 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border-accent)] text-[11px] font-medium text-[var(--accent-ink)] hover:bg-[var(--raised)] cursor-pointer transition-colors"
                  >
                    {hasFollowUpRecording ? "Re-record follow-up" : "Answer follow-up"}
                  </button>
                )
              )}
            </div>

            <p className="text-[13px] text-[var(--text)] leading-snug">
              &ldquo;{followUpProbe.prompt}&rdquo;
            </p>

            {isTranscribingFollowUp && !isRecordingFollowUp && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span className="w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                Transcribing follow-up in background…
              </div>
            )}

            {followUpTranscript && !isRecordingFollowUp && (
              <p className="text-[12px] text-[var(--text-secondary)] border-l-2 border-[var(--positive)] pl-2.5 leading-snug">
                {followUpTranscript}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
