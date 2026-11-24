/**
 * Client for the speech backend (Module 2: transcript, Module 5: speech metrics).
 */

export interface SpeechPauseEvent {
  afterWord: string;
  atSec: number;
  lengthSec: number;
}

export interface SpeechUi {
  wpm: number;
  fillersPerMin: number;
  fillerCount: number;
  /** e.g. ["um ×2", "like ×1", "lah ×1"] */
  fillers: string[];
  manglishCount?: number;
  manglishFillers?: string[];
  longPauses: number;
  /** 0-100 */
  fluencyScore: number;
  durationSec: number;
  /** Module 2 clean transcript (filler words removed). Send this to Module 3. */
  transcript: string;
  /** Raw transcript preserving fillers ("um", "lah", "like") for annotated reports. */
  rawTranscript?: string;
  /** Exact long pause positions for inline transcript markers. */
  pauseEvents?: SpeechPauseEvent[];
}

export function enrichSpeechUi(res: SpeechAnalysisResponse): SpeechUi {
  const pauseEvents: SpeechPauseEvent[] = Array.isArray(res.speech_analysis?.long_pauses)
    ? res.speech_analysis.long_pauses.map((p) => ({
        afterWord: p.after_word,
        atSec: p.at_sec,
        lengthSec: p.length_sec,
      }))
    : res.ui.pauseEvents ?? [];

  return {
    ...res.ui,
    rawTranscript: res.transcript?.raw_text || res.ui.rawTranscript || res.ui.transcript,
    pauseEvents,
  };
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
    manglish_filler_count?: number;
    manglish_breakdown?: Record<string, number>;
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

export type SpeechLanguageMode = "en" | "auto";

export async function analyzeSpeech(
  audio: Blob,
  language: SpeechLanguageMode = "en",
  signal?: AbortSignal
): Promise<SpeechAnalysisResponse> {
  const extension = audio.type.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  form.append("audio", audio, `answer.${extension}`);
  form.append("language", language);

  const res = await fetch("/api/speech", { method: "POST", body: form, signal });
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
