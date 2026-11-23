"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import { useAuth } from "@/hooks/useAuth";

const SIDEBAR_STORAGE_KEY = "vokalai_sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // Desktop: expanded (240px) or collapsed icon rail (64px), persisted.
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Mobile: off-canvas drawer.
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "collapsed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted UI preference once on mount
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        next ? "collapsed" : "expanded"
      );
      return next;
    });
  }, []);

  // "[" toggles the sidebar (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "[") toggleCollapsed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ground)] text-[var(--muted)] flex items-center justify-center text-[14px]">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[var(--ground)] text-[var(--text)]">
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapsed={toggleCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <TopHeader
          userName={user.name}
          onLogout={() => void logout()}
          onOpenMobileNav={() => setIsMobileOpen(true)}
        />
        <main className="app-sheet flex-1 lg:mr-4 lg:mb-4 border-t lg:border p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
