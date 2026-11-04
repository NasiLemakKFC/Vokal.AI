"use client";

import { usePathname } from "next/navigation";

interface TopHeaderProps {
  userName?: string;
  onOpenMobileNav: () => void;
}

function titleFor(pathname: string): string {
  if (pathname.startsWith("/interview")) return "Practice";
  if (pathname.startsWith("/reports")) return "Reports";
  return "Home";
}

export default function TopHeader({ userName = "Amirul Haziq", onOpenMobileNav }: TopHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="w-full h-[48px] bg-[#f9fbfc] flex items-center justify-between px-4 lg:px-6 shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="lg:hidden w-8 h-8 -ml-1 rounded-[6px] flex items-center justify-center text-[#5d5f60] hover:bg-[#f0f1f2] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <span className="text-[14px] font-medium text-[#131416]">{titleFor(pathname)}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-[#5d5f60]">
          <span className="material-symbols-outlined text-[15px] text-[#1e7b4f]">lock</span>
          Video stays on your device
        </span>
        <span
          className="w-7 h-7 rounded-full bg-[#dceef2] text-[#134e5e] flex items-center justify-center text-[12px] font-semibold"
          title={`Signed in as ${userName}`}
        >
          {userName.charAt(0).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
