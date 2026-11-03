import type { Config } from "tailwindcss";

/**
 * Tailwind Configuration — MockIF Light-Mode Design System
 * Based on DESIGN (1).md — Strict light-only enforcement.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canvas & Surface
        background: "#F9FAFB",
        surface: "#FFFFFF",
        "surface-active": "#F5F3FF",

        // Text Hierarchy
        "on-surface": "#111827",
        "on-surface-variant": "#1F2937",
        "on-surface-muted": "#374151",
        "on-surface-subtle": "#6B7280",

        // Borders
        outline: "#E5E7EB",
        "outline-accent": "#C4B5FD",

        // Primary Palette
        primary: "#818CF8",
        "primary-strong": "#6D28D9",
        secondary: "#A78BFA",

        // Accent
        "accent-coral": "#E2725B",

        // Badges
        "badge-bg": "#EDE9FE",
        "badge-text": "#6D28D9",

        // Semantic
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        DEFAULT: "16px",
        full: "9999px",
      },
      boxShadow: {
        card: "0px 1px 3px rgba(17, 24, 39, 0.04)",
        elevated: "0px 4px 12px rgba(17, 24, 39, 0.06)",
        cta: "0px 8px 20px -4px rgba(167, 139, 250, 0.4)",
      },
      spacing: {
        xs: "0.5rem",     // 8px
        sm: "0.75rem",    // 12px
        md: "1.25rem",    // 20px
        lg: "1.75rem",    // 28px
        xl: "2.25rem",    // 36px
      },
    },
  },
  plugins: [],
};

export default config;
