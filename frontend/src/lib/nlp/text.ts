export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+#./\s-]/g, " ").replace(/\s+/g, " ").trim();
}
export function splitSentences(value: string): string[] {
  return value
    .split(/\n+/)
    .flatMap((line) => line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}
export function includesKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return false;
  const pattern = normalizedKeyword.split(" ").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, "i").test(normalizeText(text));
}
export function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}
