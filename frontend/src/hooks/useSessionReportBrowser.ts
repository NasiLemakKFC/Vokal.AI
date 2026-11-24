"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteSession as deleteSessionApi,
  fetchSessionById,
  fetchSessionSummaries,
  SESSIONS_UPDATED_EVENT,
  type SavedSession,
  type SessionSortOption,
  type SessionSummary,
} from "@/lib/nlp/sessionStore";

export type SessionModeFilter = "all" | "company" | "role" | "general";

const PAGE_SIZE = 25;

export function useSessionReportBrowser(requestedId: string | null) {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<SessionModeFilter>("all");
  const [sortBy, setSortBy] = useState<SessionSortOption>("newest");

  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [sessionCache, setSessionCache] = useState<Record<string, SavedSession>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Debounce search input to avoid spamming MongoDB on every keystroke
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(t);
  }, [search]);

  // Listen for cross-page session mutations
  useEffect(() => {
    const onUpdated = () => {
      setSessionCache({});
      setReloadTick((v) => v + 1);
    };
    window.addEventListener(SESSIONS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(SESSIONS_UPDATED_EVENT, onUpdated);
  }, []);

  // Fetch page 1 whenever filters or reloadTick change
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void fetchSessionSummaries(
      {
        page: 1,
        limit: PAGE_SIZE,
        q: debouncedSearch,
        mode: modeFilter,
        sort: sortBy,
      },
      controller.signal
    )
      .then((data) => {
        if (!active) return;
        setSummaries(data.summaries);
        setTotal(data.total);
        setPage(1);
        setHasMore(data.hasMore);
        setListError(null);
        setLoadingList(false);
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setListError(
          err instanceof Error ? err.message : "Failed to load session reports."
        );
        setLoadingList(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedSearch, modeFilter, sortBy, reloadTick]);

  // Effective selected ID: explicit selection > requested URL param > first summary
  const effectiveSelectedId =
    selectedId ?? requestedId ?? summaries[0]?.id ?? null;

  const resolvedSession = effectiveSelectedId
    ? (sessionCache[effectiveSelectedId] ?? null)
    : null;

  // Fetch full session detail on demand when not yet cached
  useEffect(() => {
    if (!effectiveSelectedId || resolvedSession) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void fetchSessionById(effectiveSelectedId, controller.signal)
      .then((session) => {
        if (!active) return;
        if (session) {
          setSessionCache((prev) => ({ ...prev, [session.id]: session }));
          setDetailError(null);
        } else if (summaries[0] && summaries[0].id !== effectiveSelectedId) {
          setSelectedId(summaries[0].id);
        }
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setDetailError(
          err instanceof Error ? err.message : "Failed to load session details."
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [effectiveSelectedId, resolvedSession, summaries]);

  const isDetailLoading =
    Boolean(effectiveSelectedId) && !resolvedSession && !detailError;

  const selectSession = useCallback((id: string) => {
    setDetailError(null);
    setSelectedId(id);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchSessionSummaries({
        page: nextPage,
        limit: PAGE_SIZE,
        q: debouncedSearch,
        mode: modeFilter,
        sort: sortBy,
      });
      setSummaries((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const merged = [...prev];
        for (const item of data.summaries) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTotal(data.total);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Failed to load more sessions."
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, debouncedSearch, modeFilter, sortBy]);

  const removeSession = useCallback(
    async (id: string) => {
      await deleteSessionApi(id);
      setSessionCache((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setSummaries((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (effectiveSelectedId === id) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
      setTotal((t) => Math.max(0, t - 1));
    },
    [effectiveSelectedId]
  );

  const reload = useCallback(() => {
    setSessionCache({});
    setLoadingList(true);
    setListError(null);
    setDetailError(null);
    setReloadTick((v) => v + 1);
  }, []);

  const activeIdx = effectiveSelectedId
    ? summaries.findIndex((s) => s.id === effectiveSelectedId)
    : -1;
  const previousSummary =
    sortBy === "newest" && activeIdx >= 0 && activeIdx + 1 < summaries.length
      ? summaries[activeIdx + 1]
      : null;

  return {
    summaries,
    total,
    hasMore,
    loadingList,
    loadingMore,
    listError,
    search,
    setSearch,
    modeFilter,
    setModeFilter,
    sortBy,
    setSortBy,
    selectedId: effectiveSelectedId,
    activeSession: resolvedSession,
    loadingDetail: isDetailLoading,
    detailError,
    activeIdx,
    previousSummary,
    selectSession,
    loadMore,
    removeSession,
    reload,
  };
}
