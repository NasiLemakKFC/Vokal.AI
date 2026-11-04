"use client";

import { useState } from "react";
import Link from "next/link";
import { SESSIONS, STAR_LABELS } from "@/lib/mockSessions";

function scoreTone(score: number) {
  return score >= 80 ? "text-[#1e7b4f]" : score >= 70 ? "text-[#92400e]" : "text-[#c4242a]";
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[#e8eaec] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 h-[46px] flex items-center justify-between text-left hover:bg-[#f9fbfc] transition-colors cursor-pointer"
      >
        <span className="text-[14px] font-medium text-[#131416]">{title}</span>
        <span className="material-symbols-outlined text-[18px] text-[#5d5f60]">{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Module 6 — one session's performance report. */
export default function ReportsPage() {
  const [sessionId, setSessionId] = useState(SESSIONS[0].id);
  const s = SESSIONS.find((x) => x.id === sessionId) ?? SESSIONS[0];

  const delivery = Math.round(Math.max(0, 100 - s.fillersPerMin * 10 - s.longPauses * 4 - Math.abs(s.wpm - 135) / 2));
  const presence = Math.round(Math.max(0, s.eyeContact - s.postureAlerts * 5));

  const scores = [
    { label: "Overall", value: s.overall },
    { label: "Content (STAR)", value: s.starScore },
    { label: "Delivery", value: delivery },
    { label: "Eye contact & posture", value: presence },
  ];

  return (
    <div className="max-w-[880px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-[22px] font-semibold text-[#131416] tracking-tight">Session report</h1>
          <p className="text-[14px] text-[#5d5f60] truncate">{s.question}</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#5d5f60] shrink-0">
          Session
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="h-[34px] px-2 rounded-[6px] border border-[#cdced1] bg-white text-[13px] text-[#131416] cursor-pointer focus:outline-none focus:border-[#1b6c80]"
          >
            {SESSIONS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.date} · {x.role}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Scores */}
      <section className="rounded-[8px] border border-[#e8eaec] grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e8eaec]">
        {scores.map((sc, i) => (
          <div key={sc.label} className={`p-4 ${i >= 2 ? "border-t sm:border-t-0 border-[#e8eaec]" : ""}`}>
            <div className="text-[13px] text-[#5d5f60]">{sc.label}</div>
            <div className={`mt-1 tabular-nums leading-tight ${i === 0 ? "text-[30px] text-[#131416]" : `text-[24px] ${scoreTone(sc.value)}`}`}>
              {sc.value}%
            </div>
          </div>
        ))}
      </section>

      {/* What to improve */}
      <section className="rounded-[8px] border border-[#e8eaec] p-4 space-y-2">
        <h2 className="text-[15px] font-semibold text-[#131416]">What to improve</h2>
        <ol className="space-y-1.5">
          {s.improvements.slice(0, 3).map((tip, i) => (
            <li key={tip} className="flex gap-2.5 text-[14px] text-[#131416]">
              <span className="w-5 h-5 shrink-0 rounded-full bg-[#eef4f6] text-[#134e5e] text-[12px] font-medium flex items-center justify-center">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ol>
      </section>

      {/* Details, closed by default */}
      <section className="rounded-[8px] border border-[#e8eaec] overflow-hidden">
        <Disclosure title="STAR breakdown">
          <div className="space-y-3">
            {STAR_LABELS.map(([key, label]) => {
              const p = s.star[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium text-[#131416]">{label}</span>
                    <span className={`tabular-nums font-medium ${scoreTone(p.score)}`}>{p.score}%</span>
                  </div>
                  <div className="h-1.5 bg-[#f0f1f2] rounded-[2px] overflow-hidden">
                    <div className={`h-full ${p.score >= 80 ? "bg-[#1b6c80]" : "bg-[#c4242a]"}`} style={{ width: `${p.score}%` }} />
                  </div>
                  <p className="text-[12px] text-[#5d5f60]">{p.note}</p>
                </div>
              );
            })}
          </div>
        </Disclosure>

        <Disclosure title="Speech details">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
            <div>
              <dt className="text-[#5d5f60]">Pace</dt>
              <dd className="text-[#131416] font-medium tabular-nums">{s.wpm} WPM</dd>
            </div>
            <div>
              <dt className="text-[#5d5f60]">Fillers / min</dt>
              <dd className="text-[#131416] font-medium tabular-nums">{s.fillersPerMin.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-[#5d5f60]">Long pauses</dt>
              <dd className="text-[#131416] font-medium tabular-nums">{s.longPauses}</dd>
            </div>
            <div>
              <dt className="text-[#5d5f60]">Words used</dt>
              <dd className="text-[#131416] font-medium">{s.fillers.join(", ")}</dd>
            </div>
          </dl>
        </Disclosure>

        <Disclosure title="Transcript">
          <p className="text-[14px] text-[#45474a] leading-relaxed">{s.transcript}</p>
        </Disclosure>
      </section>

      <div className="flex justify-end">
        <Link
          href="/interview"
          className="h-[36px] px-4 rounded-[6px] bg-[#1b6c80] text-white text-[13px] font-medium hover:bg-[#134e5e] flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">replay</span>
          Practice again
        </Link>
      </div>
    </div>
  );
}

