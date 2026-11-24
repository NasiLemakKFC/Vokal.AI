"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  SessionSortOption,
  SessionSummary,
} from "@/lib/nlp/sessionStore";
import type { SessionModeFilter } from "@/hooks/useSessionReportBrowser";
import { scoreTone } from "@/lib/format";

interface SessionSwitcherProps {
  summaries: SessionSummary[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  selectedId: string | null;
  activeSummary: SessionSummary | null;
  activeIdx: number;
  search: string;
  onSearchChange: (val: string) => void;
  modeFilter: SessionModeFilter;
  onModeFilterChange: (mode: SessionModeFilter) => void;
  sortBy: SessionSortOption;
  onSortByChange: (sort: SessionSortOption) => void;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSummaryTarget(s: SessionSummary): string {
  if (s.mode === "general") return "General Interview";
  if (s.company.trim()) return `${s.company.trim()} · ${s.role}`;
  return s.role || "Practice Session";
}

function dateBucketLabel(iso: string): "Today" | "This week" | "Earlier" {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = (startOfToday.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return "Today";
  if (diffDays <= 7) return "This week";
  return "Earlier";
}

export default function SessionSwitcher({
  summaries,
  total,
  hasMore,
  loadingMore,
  selectedId,
  activeSummary,
  activeIdx,
  search,
  onSearchChange,
  modeFilter,
  onModeFilterChange,
  sortBy,
  onSortByChange,
  onSelect,
  onLoadMore,
}: SessionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const grouped = useMemo(() => {
    if (sortBy !== "newest") {
      return [{ label: sortBy === "highest" ? "Highest score" : "Lowest score", items: summaries }];
    }
    const order: ("Today" | "This week" | "Earlier")[] = [
      "Today",
      "This week",
      "Earlier",
    ];
    const map = new Map<string, SessionSummary[]>();
    for (const item of summaries) {
      const key = dateBucketLabel(item.completedAt);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return order
      .map((label) => ({ label, items: map.get(label) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [summaries, sortBy]);

  const canGoNewer = activeIdx > 0;
  const canGoOlder = activeIdx >= 0 && activeIdx + 1 < summaries.length;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 no-print">
      {/* Prev / Next session steppers */}
      <div className="hidden sm:flex items-center rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] overflow-hidden">
        <button
          type="button"
          disabled={!canGoNewer}
          onClick={() => canGoNewer && onSelect(summaries[activeIdx - 1].id)}
          title="Previous session in list"
          aria-label="Previous session in list"
          className="h-9 w-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <button
          type="button"
          disabled={!canGoOlder}
          onClick={() => canGoOlder && onSelect(summaries[activeIdx + 1].id)}
          title="Next session in list"
          aria-label="Next session in list"
          className="h-9 w-8 border-l border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      {/* Main Switcher Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="h-9 px-3 rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[13px] text-[var(--text)] flex items-center gap-2 cursor-pointer transition-colors max-w-[320px] sm:max-w-[380px]"
      >
        <span className="material-symbols-outlined text-[16px] text-[var(--muted)] shrink-0">
          history
        </span>
        <span className="truncate font-medium">
          {activeSummary
            ? `${formatShortDate(activeSummary.completedAt)} · ${formatSummaryTarget(activeSummary)}`
            : "Select session"}
        </span>
        {activeSummary && (
          <span
            className={`text-[12px] font-mono font-medium tabular-nums shrink-0 ${scoreTone(activeSummary.overallScore)}`}
          >
            {activeSummary.overallScore}%
          </span>
        )}
        <span className="text-[11px] font-mono tabular-nums text-[var(--muted)] bg-[var(--raised)] px-1.5 py-0.5 rounded-[4px] shrink-0">
          {total}
        </span>
        <span className="material-symbols-outlined text-[16px] text-[var(--muted)] shrink-0">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Searchable, Filterable, Date-Grouped Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Browse practice sessions"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="absolute right-0 top-full mt-2 z-50 w-[min(92vw,420px)] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
            style={{ boxShadow: "var(--shadow-popover)" }}
          >
            {/* Search & Filters Header */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--raised)]/60 space-y-2.5">
              <div className="relative">
                <span className="material-symbols-outlined text-[16px] text-[var(--muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search company, role, or question…"
                  className="input-field w-full h-8 pl-8 pr-3 text-[12px]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--active)]/80 p-0.5">
                  {(
                    [
                      ["all", "All"],
                      ["company", "Company"],
                      ["role", "Role"],
                      ["general", "General"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onModeFilterChange(val)}
                      className={`h-6 px-2 rounded-[calc(var(--radius-control)-2px)] text-[11px] font-medium cursor-pointer transition-colors ${
                        modeFilter === val
                          ? "bg-[var(--surface)] text-[var(--accent-ink)]"
                          : "text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Sort sessions"
                  value={sortBy}
                  onChange={(e) => onSortByChange(e.target.value as SessionSortOption)}
                  className="input-field h-7 px-2 text-[11px] cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="highest">Highest score</option>
                  <option value="lowest">Lowest score</option>
                </select>
              </div>
            </div>

            {/* Session List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--rule)]">
              {summaries.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[var(--muted)]">
                  No sessions match your filter.
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 py-1.5 text-[11px] font-medium text-[var(--muted)] bg-[var(--raised)]/40 sticky top-0">
                      {group.label}
                    </div>
                    <ul className="divide-y divide-[var(--rule)]">
                      {group.items.map((item) => {
                        const isSelected = item.id === selectedId;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(item.id);
                                setOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[var(--accent-soft)]/60"
                                  : "hover:bg-[var(--raised)]/60"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[13px] font-medium truncate ${
                                      isSelected
                                        ? "text-[var(--accent-ink)]"
                                        : "text-[var(--text)]"
                                    }`}
                                  >
                                    {formatSummaryTarget(item)}
                                  </span>
                                  <span className="text-[11px] font-mono tabular-nums text-[var(--muted)] shrink-0">
                                    {item.answerCount}Q
                                  </span>
                                </div>
                                <div className="text-[11px] text-[var(--muted)] truncate mt-0.5">
                                  {formatShortDate(item.completedAt)}
                                  {item.firstQuestion ? ` · ${item.firstQuestion}` : ""}
                                </div>
                              </div>

                              <span
                                className={`text-[13px] font-mono font-medium tabular-nums shrink-0 ${scoreTone(item.overallScore)}`}
                              >
                                {item.overallScore}%
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}

              {hasMore && (
                <div className="p-2.5 text-center bg-[var(--raised)]/30">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={onLoadMore}
                    className="btn-secondary h-8 px-3 text-[12px] font-medium cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore
                      ? "Loading more…"
                      : `Load more (${summaries.length} of ${total})`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
