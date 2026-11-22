"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

/* Three destinations only — one per job (practice, review results). */
const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Practice", icon: "videocam", href: "/interview" },
  { label: "Reports", icon: "insights", href: "/reports" },
];

function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="22" height="22" rx="5" stroke="#1b6c80" strokeWidth="1.75" fill="#eef4f6" />
      <path
        d="M6.75 7.75L11.25 16.5L15.75 7.75M17.5 15.75V16.25"
        stroke="#1b6c80"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavList({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
            className={`h-[34px] flex items-center gap-2.5 rounded-[6px] text-[14px] transition-colors ${
              collapsed ? "justify-center px-0" : "px-2.5"
            } ${
              isActive
                ? "bg-[#ebedee] text-[#131416] font-medium"
                : "text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416]"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] leading-none ${
                isActive ? "text-[#1b6c80]" : "text-[#5d5f60]"
              }`}
            >
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
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
        className={`hidden lg:flex shrink-0 flex-col h-screen sticky top-0 bg-[#f9fbfc] select-none transition-[width] duration-200 ${
          isCollapsed ? "w-[56px]" : "w-[228px]"
        }`}
      >
        <nav className="flex-1 flex flex-col px-2 py-3 overflow-hidden">
          <Link
            href="/"
            className={`h-[40px] mb-4 flex items-center gap-2.5 ${isCollapsed ? "justify-center" : "px-2.5"}`}
            title="Vokal.ai"
          >
            <BrandMark />
            {!isCollapsed && (
              <span className="text-[15px] font-semibold text-[#131416] tracking-tight">Vokal.ai</span>
            )}
          </Link>

          <div className="flex-1">
            <NavList collapsed={isCollapsed} pathname={pathname} />
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            title={isCollapsed ? "Expand sidebar ( [ )" : "Collapse sidebar ( [ )"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`h-[34px] flex items-center gap-2.5 rounded-[6px] text-[13px] text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416] transition-colors cursor-pointer ${
              isCollapsed ? "justify-center" : "px-2.5"
            }`}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              {isCollapsed ? "left_panel_open" : "left_panel_close"}
            </span>
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </nav>
      </aside>

      {/* Mobile: off-canvas drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-black/30 cursor-pointer"
          />
          <aside className="absolute inset-y-0 left-0 w-[240px] bg-[#f9fbfc] border-r border-[#e8eaec] px-2 py-3 flex flex-col">
            <div className="h-[40px] mb-4 px-2.5 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <BrandMark />
                <span className="text-[15px] font-semibold text-[#131416]">Vokal.ai</span>
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#5d5f60] hover:bg-[#f0f1f2] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <NavList collapsed={false} pathname={pathname} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
