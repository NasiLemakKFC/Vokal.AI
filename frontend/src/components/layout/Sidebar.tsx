"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { prewarmVisionFileset } from "@/lib/vision/MediaPipeSetup";

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Practice", icon: "videocam", href: "/interview" },
  { label: "Reports", icon: "insights", href: "/reports" },
];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        stroke="var(--text)"
        strokeWidth="1.5"
      />
      <path
        d="M7 8L11.5 16L16 8"
        stroke="var(--text)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="15.5" r="1.25" fill="var(--accent)" />
    </svg>
  );
}

function NavList({
  collapsed,
  pathname,
  onNavigate,
  layoutPrefix,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  layoutPrefix: string;
}) {
  return (
    <div className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            onMouseEnter={() => {
              if (item.href === "/interview") {
                void prewarmVisionFileset();
              }
            }}
            onFocus={() => {
              if (item.href === "/interview") {
                void prewarmVisionFileset();
              }
            }}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={`relative h-9 flex items-center gap-2 rounded-[var(--radius-control)] text-[14px] transition-colors ${
              collapsed ? "justify-center px-0" : "px-3"
            } ${
              isActive
                ? "text-[var(--text)] font-medium"
                : "text-[var(--muted)] hover:bg-[var(--active)]/65 hover:text-[var(--text)]"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={`${layoutPrefix}-active-nav`}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="absolute inset-0 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)]"
              />
            )}
            <span className="relative w-5 flex items-center justify-center shrink-0">
              <span
                className={`material-symbols-outlined text-[18px] leading-none transition-colors ${
                  isActive ? "text-[var(--text)]" : "text-[var(--muted)]"
                }`}
              >
                {item.icon}
              </span>
            </span>
            {!collapsed && <span className="relative truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapsed,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: persistent, collapsible */}
      <aside
        className={`on-air-chrome-dim hidden lg:flex shrink-0 flex-col h-screen sticky top-0 bg-[var(--ground)] select-none transition-[width] duration-200 ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        <nav className="flex-1 flex flex-col px-3 py-4 overflow-hidden">
          <Link
            href="/"
            className={`h-10 mb-6 flex items-center gap-2.5 ${
              isCollapsed ? "justify-center" : "px-2"
            }`}
            title="Vokal.ai"
          >
            <BrandMark />
            {!isCollapsed && (
              <div className="flex flex-col leading-none">
                <span className="text-[16px] font-semibold text-[var(--text)]">
                  Vokal.ai
                </span>
                <span className="text-[12px] text-[var(--muted)] mt-1">
                  Interview studio
                </span>
              </div>
            )}
          </Link>

          <div className="flex-1">
            <NavList
              collapsed={isCollapsed}
              pathname={pathname}
              layoutPrefix="desktop"
            />
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            title={
              isCollapsed ? "Expand sidebar ( [ )" : "Collapse sidebar ( [ )"
            }
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`h-9 flex items-center gap-2 rounded-[var(--radius-control)] text-[13px] text-[var(--muted)] hover:bg-[var(--active)]/70 hover:text-[var(--text)] transition-colors cursor-pointer ${
              isCollapsed ? "justify-center px-0" : "px-3"
            }`}
          >
            <span className="w-5 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px] leading-none">
                {isCollapsed ? "left_panel_open" : "left_panel_close"}
              </span>
            </span>
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">Collapse</span>
                <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] leading-none">
                  [
                </kbd>
              </>
            )}
          </button>
        </nav>
      </aside>

      {/* Mobile: off-canvas drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={onCloseMobile}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="absolute inset-0 bg-black/45 cursor-pointer"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
              className="absolute inset-y-0 left-0 w-64 bg-[var(--ground)] border-r border-[var(--border)] px-3 py-4 flex flex-col"
            >
              <div className="h-10 mb-6 px-2 flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <BrandMark />
                  <span className="text-[16px] font-semibold text-[var(--text)]">
                    Vokal.ai
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close menu"
                  className="w-8 h-8 rounded-[var(--radius-control)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--active)] hover:text-[var(--text)] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>
              <NavList
                collapsed={false}
                pathname={pathname}
                onNavigate={onCloseMobile}
                layoutPrefix="mobile"
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
