"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopHeaderProps {
  userName?: string;
}

export default function TopHeader({ userName = "Amirul Haziq" }: TopHeaderProps) {
  const pathname = usePathname();
  const isLecturerView = pathname.startsWith("/lecturer");

  return (
    <header className="w-full h-[48px] bg-[#f9fbfc] flex items-center justify-between px-4 lg:px-6 shrink-0 select-none">
      {/* Left: Mobile Brand + Scope Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
          <span className="text-[14px] font-semibold text-[#131416]">
            InterViewAI
          </span>
        </Link>

        {/* Scope Breadcrumb on Desktop */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-[13px]">
          <span className="text-[#5d5f60]">UTeM FTMK</span>
          <span className="text-[#cdced1]">/</span>
          <span className="text-[#5d5f60]">STAR Behavioral Track</span>
          <span className="text-[#cdced1]">/</span>
          <span className="text-[#131416] font-medium">
            {isLecturerView ? "Faculty Evaluation" : "Candidate Workspace"}
          </span>
        </nav>
      </div>

      {/* Center: Quick Mode Switcher (Candidate vs Lecturer Review vs Live Practice) */}
      <div className="flex items-center gap-1 bg-[#ebedee] p-0.5 rounded-[6px] border border-[#e8eaec]">
        <Link
          href="/"
          className={`px-2.5 py-1 rounded-[4px] text-[12px] transition-colors ${
            pathname === "/"
              ? "bg-white text-[#131416] font-medium border border-[#e8eaec]"
              : "text-[#5d5f60] hover:text-[#131416]"
          }`}
        >
          Overview
        </Link>
        <Link
          href="/interview"
          className={`px-2.5 py-1 rounded-[4px] text-[12px] transition-colors ${
            pathname.startsWith("/interview")
              ? "bg-white text-[#131416] font-medium border border-[#e8eaec]"
              : "text-[#5d5f60] hover:text-[#131416]"
          }`}
        >
          Practice Room
        </Link>
        <Link
          href="/lecturer"
          className={`px-2.5 py-1 rounded-[4px] text-[12px] transition-colors ${
            isLecturerView
              ? "bg-white text-[#131416] font-medium border border-[#e8eaec]"
              : "text-[#5d5f60] hover:text-[#131416]"
          }`}
        >
          Lecturer Review
        </Link>
      </div>

      {/* Right: Privacy Indicator + Identity Chip */}
      <div className="flex items-center gap-3">
        <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1e7b4f]" />
          Client-side Vision (Zero Video Upload)
        </span>

        <div
          className="h-7 px-2.5 rounded-[6px] bg-white border border-[#e8eaec] flex items-center gap-2 text-[12px] text-[#131416] font-medium"
          title={`Signed in as ${userName}`}
        >
          <span className="w-4 h-4 rounded-full bg-[#dceef2] text-[#134e5e] flex items-center justify-center text-[11px] font-semibold">
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline">{userName}</span>
        </div>
      </div>
    </header>
  );
}
