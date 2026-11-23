"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_SESSIONS,
  SESSIONS_UPDATED_EVENT,
  deleteSession as deleteSessionApi,
  fetchSessions,
  type SavedSession,
} from "@/lib/nlp/sessionStore";

export function useSessions() {
  const [sessions, setSessions] = useState<SavedSession[]>(EMPTY_SESSIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const sync = () => {
      void fetchSessions()
        .then((data) => {
          if (!active) return;
          setSessions(data);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          setError(
            err instanceof Error ? err.message : "Failed to load sessions."
          );
          setLoading(false);
        });
    };

    sync();
    window.addEventListener(SESSIONS_UPDATED_EVENT, sync);
    return () => {
      active = false;
      window.removeEventListener(SESSIONS_UPDATED_EVENT, sync);
    };
  }, []);

  const removeSession = useCallback(async (id: string) => {
    await deleteSessionApi(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { sessions, loading, error, reload, removeSession };
}
