"use client";

import { usePathname } from "next/navigation";
import AppearanceMenu from "@/components/ui/AppearanceMenu";

interface TopHeaderProps {
  userName: string;
  onLogout?: () => void;
  onOpenMobileNav: () => void;
}

function titleFor(pathname: string): string {
  if (pathname.startsWith("/interview")) return "Practice Studio";
  if (pathname.startsWith("/reports")) return "Session Reports";
  return "Home";
}

export default function TopHeader({
  userName,
  onLogout,
  onOpenMobileNav,
}: TopHeaderProps) {
  const pathname = usePathname();
  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="on-air-chrome-dim w-full h-14 bg-[var(--ground)] flex items-center justify-between px-4 lg:px-6 shrink-0 select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="lg:hidden w-8 h-8 -ml-1 rounded-[var(--radius-control)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--active)] hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">menu</span>
        </button>
        <span className="text-[14px] font-medium text-[var(--text)] truncate">
          {titleFor(pathname)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden lg:inline-flex items-center gap-2 text-[12px] text-[var(--muted)] mr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] shrink-0" />
          Video stays on your device
        </span>

        <AppearanceMenu />

        <div className="flex items-center gap-2 pl-1">
          <span
            className="w-8 h-8 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center text-[12px] font-medium shrink-0"
            title={`Signed in as ${userName}`}
          >
            {initial}
          </span>
          <span className="hidden sm:inline text-[13px] font-medium text-[var(--text)] max-w-[140px] truncate">
            {userName}
          </span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="h-8 px-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)] text-[12px] font-medium text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                logout
              </span>
              <span className="hidden md:inline">Sign out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
