"use client";

import { useState } from "react";
import Link from "next/link";
import { SESSIONS, STAR_LABELS } from "@/lib/mockSessions";

function scoreTone(score: number) {
  return score >= 80 ? "text-[#1e7b4f]" : score >= 70 ? "text-[#92400e]" : "text-[#c4242a]";
}

export default function Home() {
  const [openId, setOpenId] = useState<string | null>(null);
  const last = SESSIONS[0];
  const prev = SESSIONS[1];
  const weakest = STAR_LABELS.reduce((min, cur) =>
    last.star[cur[0]].score < last.star[min[0]].score ? cur : min
  );

  const figures = [
    { label: "STAR score", value: `${last.starScore}%`, delta: last.starScore - prev.starScore, higherIsBetter: true },
    { label: "Eye contact", value: `${last.eyeContact}%`, delta: last.eyeContact - prev.eyeContact, higherIsBetter: true },
    {
      label: "Fillers per minute",
      value: last.fillersPerMin.toFixed(1),
      delta: +(last.fillersPerMin - prev.fillersPerMin).toFixed(1),
      higherIsBetter: false,
    },
  ];

  return (
    <div className="max-w-[880px] mx-auto space-y-6">
      {/* Title + one finding + main action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold text-[#131416] tracking-tight">Welcome back, Amirul</h1>
          <p className="text-[14px] text-[#5d5f60]">
            Last session scored <span className="font-medium text-[#131416]">{last.overall}%</span>. Work on your{" "}
            <span className="font-medium text-[#131416]">{weakest[1]}</span> — {last.star[weakest[0]].note.toLowerCase()}
          </p>
        </div>
        <Link
          href="/interview"
          className="h-[36px] px-4 rounded-[6px] bg-[#1b6c80] text-white text-[13px] font-medium hover:bg-[#134e5e] transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
          Start practice
        </Link>
      </div>

      {/* Three figures from the latest session */}
      <section className="rounded-[8px] border border-[#e8eaec] grid grid-cols-3 divide-x divide-[#e8eaec]">
        {figures.map((f) => {
          const good = f.higherIsBetter ? f.delta >= 0 : f.delta <= 0;
          return (
            <div key={f.label} className="p-4">
              <div className="text-[13px] text-[#5d5f60]">{f.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[26px] text-[#131416] tabular-nums leading-tight">{f.value}</span>
                <span className={`text-[12px] tabular-nums ${good ? "text-[#1e7b4f]" : "text-[#c4242a]"}`}>
                  {f.delta > 0 ? "+" : ""}
                  {f.delta}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Recent sessions */}
      <section className="rounded-[8px] border border-[#e8eaec]">
        <div className="px-4 h-[48px] flex items-center justify-between border-b border-[#e8eaec]">
          <h2 className="text-[15px] font-semibold text-[#131416]">Recent sessions</h2>
          <Link href="/reports" className="text-[13px] font-medium text-[#1b6c80] hover:underline">
            All reports
          </Link>
        </div>

        <ul className="divide-y divide-[#f0f1f2]">
          {SESSIONS.map((s) => {
            const isOpen = openId === s.id;
            return (
              <li key={s.id}>
                <div className="px-4 py-3 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-[#131416] truncate">{s.question}</div>
                    <div className="text-[12px] text-[#5d5f60]">
                      {s.role} · {s.date}
                    </div>
                  </div>
                  <span className={`text-[15px] font-medium tabular-nums ${scoreTone(s.overall)}`}>{s.overall}%</span>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : s.id)}
                    aria-expanded={isOpen}
                    className="h-[30px] px-2.5 rounded-[6px] border border-[#cdced1] bg-white hover:bg-[#f4f6f8] text-[12px] font-medium text-[#131416] flex items-center gap-0.5 cursor-pointer"
                  >
                    STAR
                    <span className="material-symbols-outlined text-[16px]">{isOpen ? "expand_less" : "expand_more"}</span>
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {STAR_LABELS.map(([key, label]) => {
                        const p = s.star[key];
                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex justify-between text-[12px]">
                              <span className="text-[#131416]">{label}</span>
                              <span className={`tabular-nums font-medium ${scoreTone(p.score)}`}>{p.score}%</span>
                            </div>
                            <div className="h-1.5 bg-[#f0f1f2] rounded-[2px] overflow-hidden">
                              <div
                                className={`h-full ${p.score >= 80 ? "bg-[#1b6c80]" : "bg-[#c4242a]"}`}
                                style={{ width: `${p.score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[13px] text-[#45474a]">{s.improvements[0]}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
