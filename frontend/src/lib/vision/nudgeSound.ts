/**
 * =============================================================================
 * nudgeSound.ts — Soft Web Audio Earphone Chimes for Module 4 Nudges
 * =============================================================================
 *
 * Synthesizes subtle, pleasant chime tones using the browser's Web Audio API
 * (zero external audio asset files needed). Designed for earphone usage so
 * coaching cues register cleanly without distracting the speaker.
 * =============================================================================
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? win.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  peakGain: number,
  waveform: OscillatorType = "sine"
): void {
  const start = ctx.currentTime + startOffsetSec;
  const end = start + durationSec;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, start);

  // Smooth attack and exponential decay to prevent clicks
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(end + 0.01);
}

/**
 * Plays an earphone chime when a nudge activates or resolves.
 */
export function playNudgeChime(type: "eye" | "posture" | "resolved"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (type === "eye") {
      // Clear, crisp attention cue (D5 -> A4)
      playTone(ctx, 587.33, 0, 0.12, 0.26, "triangle");
      playTone(ctx, 440.0, 0.09, 0.16, 0.22, "triangle");
    } else if (type === "posture") {
      // Distinct lower posture cue (G4 -> E4)
      playTone(ctx, 392.0, 0, 0.13, 0.26, "triangle");
      playTone(ctx, 329.63, 0.1, 0.17, 0.22, "triangle");
    } else {
      // Pleasant confirmation ping when fixed (C5 -> E5)
      playTone(ctx, 523.25, 0, 0.09, 0.18, "sine");
      playTone(ctx, 659.25, 0.07, 0.12, 0.18, "sine");
    }
  } catch {
    // Ignore Web Audio errors (e.g. autoplay policy before user gesture)
  }
}
