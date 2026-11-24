import type {
  InterviewTarget,
  QuestionCountOption,
} from "@/lib/interview/types";

export interface SetupPreset {
  id: string;
  name: string;
  savedAt: string;
  target: InterviewTarget;
  questionCount: QuestionCountOption;
  resumeText: string;
  resumeFileName: string | null;
}

const STORAGE_KEY = "vokalai_setup_presets_v1";
const MAX_PRESETS = 6;
const EMPTY_PRESETS: SetupPreset[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null = null;
let cachedParsed: SetupPreset[] = EMPTY_PRESETS;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePresets(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getServerPresetsSnapshot(): SetupPreset[] {
  return EMPTY_PRESETS;
}

export function getPresetsSnapshot(): SetupPreset[] {
  if (typeof window === "undefined") return EMPTY_PRESETS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_PRESETS;
      return cachedParsed;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedParsed = EMPTY_PRESETS;
      return cachedParsed;
    }
    cachedParsed = parsed.filter(
      (item): item is SetupPreset =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            item.target
        )
    );
    return cachedParsed;
  } catch {
    return EMPTY_PRESETS;
  }
}

function writePresets(next: SetupPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(next.slice(0, MAX_PRESETS));
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedParsed = next.slice(0, MAX_PRESETS);
    emitChange();
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function buildDefaultPresetName(target: InterviewTarget): string {
  if (target.mode === "general") return "General Interview";
  const company = target.company.trim();
  return company ? `${company} · ${target.role}` : target.role;
}

export function saveSetupPreset(input: {
  name?: string;
  target: InterviewTarget;
  questionCount: QuestionCountOption;
  resumeText: string;
  resumeFileName: string | null;
}): SetupPreset {
  const existing = getPresetsSnapshot();
  const cleanName = (input.name?.trim() || buildDefaultPresetName(input.target)).slice(0, 64);
  const normName = cleanName.toLowerCase();
  const matched = existing.find((p) => p.name.toLowerCase() === normName);

  const preset: SetupPreset = {
    id: matched?.id ?? `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    savedAt: new Date().toISOString(),
    target: {
      mode: input.target.mode,
      company: input.target.company.trim(),
      role: input.target.role,
      jobDescription: input.target.jobDescription,
      experienceLevel: input.target.experienceLevel ?? "fresh_grad",
    },
    questionCount: input.questionCount,
    resumeText: input.resumeText,
    resumeFileName: input.resumeFileName,
  };

  const remaining = existing.filter((p) => p.id !== preset.id);
  writePresets([preset, ...remaining]);
  return preset;
}

export function deleteSetupPreset(id: string): void {
  const existing = getPresetsSnapshot();
  writePresets(existing.filter((p) => p.id !== id));
}
