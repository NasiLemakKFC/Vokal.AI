"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  THEME_PRESETS,
  useTheme,
  type ThemeMode,
} from "@/hooks/useTheme";

const MODE_OPTIONS: { id: ThemeMode; label: string; icon: string }[] = [
  { id: "light", label: "Day", icon: "light_mode" },
  { id: "dark", label: "Night", icon: "dark_mode" },
  { id: "system", label: "Auto", icon: "contrast" },
];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export default function AppearanceMenu() {
  const { theme, mode, resolvedMode, isDark, setTheme, setMode, toggleMode } =
    useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePreset =
    THEME_PRESETS.find((t) => t.id === theme) ?? THEME_PRESETS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      {/* 1-Click Day / Night Toggle */}
      <button
        type="button"
        onClick={toggleMode}
        aria-label={isDark ? "Switch to Day mode" : "Switch to Night mode"}
        title={isDark ? "Switch to Day mode" : "Switch to Night mode"}
        className="h-8 w-8 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolvedMode}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            className="material-symbols-outlined text-[16px]"
          >
            {isDark ? "light_mode" : "dark_mode"}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* Theme Preset Switcher Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Appearance and theme settings"
        title="Appearance"
        className={`h-8 px-2.5 rounded-[var(--radius-control)] border text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
          open
            ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
            : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[var(--text)]"
        }`}
      >
        <span className="material-symbols-outlined text-[16px] text-[var(--muted)]">
          palette
        </span>
        <span className="hidden sm:inline">{activePreset.name}</span>
        <span className="material-symbols-outlined text-[16px] text-[var(--muted)]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Popover Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Appearance settings"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[304px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4"
            style={{ boxShadow: "var(--shadow-popover)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-medium text-[var(--text)]">
                Appearance
              </h3>
              <span className="badge capitalize">{resolvedMode}</span>
            </div>

            {/* Day / Night / Auto Segmented Control */}
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[var(--muted)]">
                Mode
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)]">
                {MODE_OPTIONS.map((opt) => {
                  const selected = mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      className={`relative h-8 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        selected
                          ? "text-[var(--text)]"
                          : "text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="appearance-mode-pill"
                          transition={{ duration: 0.18, ease: EASE_OUT }}
                          className="absolute inset-0 rounded-[calc(var(--radius-control)-2px)] bg-[var(--surface)] border border-[var(--border)]"
                        />
                      )}
                      <span className="relative flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">
                          {opt.icon}
                        </span>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Presets */}
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[var(--muted)]">
                Theme preset
              </div>
              <div className="space-y-2">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = theme === preset.id;
                  const [bgHex, cardHex, accentHex] = isDark
                    ? preset.nightSwatches
                    : preset.daySwatches;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(preset.id)}
                      className={`w-full text-left p-2.5 rounded-[var(--radius-control)] border flex items-center gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-[var(--raised)]/60 hover:bg-[var(--raised)] hover:border-[var(--control)]"
                      }`}
                    >
                      {/* Mini UI Preview Swatch */}
                      <div
                        className={`w-12 h-9 shrink-0 p-1 border border-black/10 flex flex-col justify-between overflow-hidden ${preset.radiusPreview}`}
                        style={{ backgroundColor: bgHex }}
                        aria-hidden="true"
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: accentHex }}
                          />
                          <span
                            className="h-1 flex-1 rounded-full opacity-25"
                            style={{
                              backgroundColor: isDark ? "#ffffff" : "#111827",
                            }}
                          />
                        </div>
                        <div
                          className="h-3.5 w-full rounded-[3px] flex items-center px-1 gap-1"
                          style={{ backgroundColor: cardHex }}
                        >
                          <span
                            className="h-1.5 w-4 rounded-full"
                            style={{ backgroundColor: accentHex }}
                          />
                          <span
                            className="h-1 flex-1 rounded-full opacity-20"
                            style={{
                              backgroundColor: isDark ? "#ffffff" : "#111827",
                            }}
                          />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium text-[var(--text)] truncate">
                            {preset.name}
                          </span>
                          {preset.id === "editorial" && (
                            <span className="text-[11px] font-normal px-1.5 py-0.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[var(--muted)] leading-snug mt-0.5 line-clamp-1">
                          {preset.tagline}
                        </p>
                      </div>

                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                            : "border border-[var(--control)] text-transparent"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          check
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
