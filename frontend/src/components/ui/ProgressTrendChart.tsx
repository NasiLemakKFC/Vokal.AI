"use client";

import { useState } from "react";

export interface TrendPoint {
  id: string;
  dateLabel: string;
  overall: number;
  star: number;
  delivery: number | null;
  eyeContact: number | null;
}

type MetricKey = "overall" | "star" | "delivery" | "eyeContact";

const SERIES_META: {
  key: MetricKey;
  label: string;
  colorVar: string;
}[] = [
  { key: "overall", label: "Overall", colorVar: "var(--accent)" },
  { key: "star", label: "STAR", colorVar: "var(--secondary)" },
  { key: "delivery", label: "Fluency", colorVar: "var(--warning-ink)" },
  { key: "eyeContact", label: "Eye contact", colorVar: "var(--positive)" },
];

export default function ProgressTrendChart({ points }: { points: TrendPoint[] }) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("overall");

  // Plot chronologically left-to-right (up to last 10 sessions)
  const chronological = [...points].slice(0, 10).reverse();
  const plotted = chronological
    .map((pt, idx) => ({
      idx,
      dateLabel: pt.dateLabel,
      value: pt[activeMetric],
    }))
    .filter((d): d is { idx: number; dateLabel: string; value: number } => d.value !== null);

  if (chronological.length < 2) return null;

  const meta = SERIES_META.find((s) => s.key === activeMetric) ?? SERIES_META[0];
  const width = 640;
  const height = 160;
  const padLeft = 34;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xFor = (idx: number) =>
    chronological.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (chronological.length - 1)) * plotW;

  const yFor = (val: number) =>
    padTop + ((100 - Math.max(0, Math.min(100, val))) / 100) * plotH;

  const pathD = plotted
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${xFor(pt.idx).toFixed(1)} ${yFor(pt.value).toFixed(1)}`)
    .join(" ");

  const firstVal = plotted[0]?.value ?? null;
  const lastVal = plotted[plotted.length - 1]?.value ?? null;
  const delta =
    firstVal !== null && lastVal !== null && plotted.length >= 2
      ? lastVal - firstVal
      : null;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2 className="text-[15px] font-medium text-[var(--text)]">
            Progress across sessions
          </h2>
          {delta !== null && (
            <span
              className={`text-[12px] font-mono font-medium tabular-nums ${
                delta >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}% over {plotted.length} sessions
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-[var(--active)]/80 p-1">
          {SERIES_META.map((s) => {
            const active = s.key === activeMetric;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveMetric(s.key)}
                className={`h-7 px-2.5 rounded-[calc(var(--radius-control)-2px)] text-[12px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? "bg-[var(--surface)] text-[var(--text)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.colorVar }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {plotted.length < 2 ? (
        <p className="text-[13px] text-[var(--muted)] py-6 text-center">
          Complete at least 2 sessions with {meta.label.toLowerCase()} data to see a trend.
        </p>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${meta.label} score trend across ${plotted.length} sessions`}
            className="w-full h-[160px] min-w-[360px]"
          >
            {/* Horizontal grid lines */}
            {[0, 50, 100].map((tick) => {
              const y = yFor(tick);
              return (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    x2={width - padRight}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray={tick === 50 ? "3 3" : undefined}
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--muted)"
                    className="font-mono"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Trend line */}
            <path
              d={pathD}
              fill="none"
              stroke={meta.colorVar}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points & date labels */}
            {plotted.map((pt) => {
              const cx = xFor(pt.idx);
              const cy = yFor(pt.value);
              return (
                <g key={`${pt.idx}-${pt.dateLabel}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="var(--surface)"
                    stroke={meta.colorVar}
                    strokeWidth="2.25"
                  >
                    <title>
                      {pt.dateLabel}: {pt.value}%
                    </title>
                  </circle>
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="500"
                    fill="var(--text)"
                    className="font-mono"
                  >
                    {pt.value}%
                  </text>
                  <text
                    x={cx}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--muted)"
                  >
                    {pt.dateLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
