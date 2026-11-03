"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  icon: string;
  href: string;
  count?: number;
}

interface NavSection {
  category: string;
  items: NavItem[];
}

/* ── Navigation structure following design-taste-frontend §3.2 (sentence-case groups, 34px pitch) ── */
const NAV_SECTIONS: NavSection[] = [
  {
    category: "Workspace",
    items: [
      { label: "Overview", icon: "grid_view", href: "/" },
      { label: "Practice Room", icon: "videocam", href: "/interview" },
      { label: "Lecturer Review", icon: "fact_check", href: "/lecturer", count: 3 },
    ],
  },
  {
    category: "Preparation",
    items: [
      { label: "Question Bank", icon: "dynamic_feed", href: "/#question-bank" },
      { label: "STAR Framework Guide", icon: "menu_book", href: "/#star-guide" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-[228px] shrink-0 flex-col h-screen sticky top-0 bg-[#f9fbfc] select-none">
      <nav className="flex-1 flex flex-col px-3 py-3 overflow-hidden">
        {/* Product Mark & Scope Switcher (app-screens §3.2) */}
        <div className="px-2.5 pt-1 pb-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect
                x="1"
                y="1"
                width="22"
                height="22"
                rx="5"
                stroke="#1b6c80"
                strokeWidth="1.75"
                fill="#eef4f6"
              />
              <path
                d="M7.5 8.5V16M7.5 6V6.5M11.5 8.5L14.2 16L17 8.5"
                stroke="#1b6c80"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-[#131416] leading-tight tracking-tight">
                InterViewAI
              </span>
              <span className="text-[11px] text-[#5d5f60] leading-tight">
                FTMK · BITU 3973
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto space-y-5 pt-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.category}>
              <p className="text-[12px] font-normal text-[#5d5f60] px-2.5 mb-1.5">
                {section.category}
              </p>

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`h-[34px] flex items-center gap-2.5 px-2.5 rounded-[6px] text-[14px] transition-colors ${
                        isActive
                          ? "bg-[#ebedee] text-[#131416] font-medium"
                          : "text-[#5d5f60] hover:bg-[#f0f1f2] hover:text-[#131416] font-normal"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[16px] leading-none ${
                          isActive ? "text-[#1b6c80]" : "text-[#5d5f60]"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                      {item.count !== undefined && (
                        <span className="ml-auto text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-[#ffedea] text-[#831c1e] font-medium">
                          {item.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Workspace Scope & Candidate Identity */}
        <div className="pt-3 border-t border-[#e8eaec] space-y-1">
          <div className="px-2.5 py-2 rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec] flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#131416] truncate">
                Amirul Haziq
              </p>
              <p className="text-[11px] text-[#5d5f60] tabular-nums truncate">
                B032110045 · Year 3 CS
              </p>
            </div>
            <span className="pill-positive text-[11px]">Active</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}
