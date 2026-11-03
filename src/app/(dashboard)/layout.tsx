"use client";

import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f9fbfc]">
      {/* Framed-Sheet L-Frame Sidebar */}
      <Sidebar />

      {/* Framed-Sheet Right Column: 48px TopHeader + Inset White Sheet */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <TopHeader userName="Amirul Haziq" />
        <main className="flex-1 bg-white lg:mr-2 lg:mb-2 lg:rounded-[16px] border-t lg:border border-[#e8eaec] p-5 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
