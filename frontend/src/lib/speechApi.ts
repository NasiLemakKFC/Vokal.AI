/**
 * Client for the speech backend (Module 2: transcript, Module 5: speech metrics).
 * `ui` already matches the field names of PracticeSession in mockSessions.ts.
 */

export interface SpeechUi {
  wpm: number;
  fillersPerMin: number;
  fillerCount: number;
  /** e.g. ["um ×2", "like ×1"] */
  fillers: string[];
  longPauses: number;
  /** 0-100 */
  fluencyScore: number;
  durationSec: number;
  /** Module 2 clean transcript (filler words removed). Send this to Module 3. */
  transcript: string;
}

export interface SpeechAnalysisResponse {
  ui: SpeechUi;
  transcript: {
    duration_sec: number;
    words: { word: string; start: number; end: number }[];
    raw_text: string;
    clean_text: string;
  };
  speech_analysis: {
    filler_count: number;
    filler_rate_per_100_words: number;
    filler_breakdown: Record<string, number>;
    long_pause_count: number;
    longest_pause_sec: number;
    total_long_pause_sec: number;
    long_pauses: { after_word: string; at_sec: number; length_sec: number }[];
    wpm: number;
    wpm_status: "too slow" | "good" | "too fast";
    fluency_score: number;
    fluency_penalties: { filler: number; pause: number; speaking_rate: number };
  };
}

export async function analyzeSpeech(audio: Blob): Promise<SpeechAnalysisResponse> {
  const extension = audio.type.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  form.append("audio", audio, `answer.${extension}`);

  const res = await fetch("/api/speech", { method: "POST", body: form });
  if (!res.ok) {
    let message = `Speech analysis failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* keep the default message */
    }
    throw new Error(message);
  }
  return res.json();
}
