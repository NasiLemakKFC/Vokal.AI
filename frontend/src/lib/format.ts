export function scoreTone(score: number): string {
  return score >= 80
    ? "text-[var(--positive)]"
    : score >= 70
      ? "text-[var(--warning-ink)]"
      : "text-[var(--negative)]";
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

export function stripTrailingPeriod(text: string): string {
  return text.trim().replace(/\.+$/, "");
}
