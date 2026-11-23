"use client";

import { motion } from "framer-motion";

interface ScoreRingProps {
  /** Score percentage 0-100 (or null for unavailable). */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  /** Optional override color token (CSS variable or color). */
  color?: string;
  label?: string;
  className?: string;
}

export default function ScoreRing({
  value,
  size = 64,
  strokeWidth = 6,
  color,
  label,
  className = "",
}: ScoreRingProps) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  const toneColor =
    color ??
    (value === null
      ? "var(--muted)"
      : clamped >= 80
        ? "var(--positive)"
        : clamped >= 70
          ? "var(--warning)"
          : "var(--negative)");

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={strokeWidth}
        />
        {value !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={toneColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-medium tabular-nums text-[var(--text)]"
          style={{ fontSize: size >= 76 ? 19 : size >= 56 ? 15 : 12 }}
        >
          {value !== null ? `${Math.round(value)}%` : "—"}
        </span>
        {label && (
          <span className="text-[11px] font-normal text-[var(--muted)] mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
