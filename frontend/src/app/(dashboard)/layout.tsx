"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";

const SIDEBAR_STORAGE_KEY = "vokalai_sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Desktop: expanded (228px) or collapsed icon rail (56px), persisted.
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

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }, []);

  // "[" toggles the sidebar (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "[") toggleCollapsed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  return (
    <div className="flex min-h-screen bg-[#f9fbfc]">
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapsed={toggleCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <TopHeader onOpenMobileNav={() => setIsMobileOpen(true)} />
        <main className="flex-1 bg-white lg:mr-2 lg:mb-2 lg:rounded-[16px] border-t lg:border border-[#e8eaec] p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
