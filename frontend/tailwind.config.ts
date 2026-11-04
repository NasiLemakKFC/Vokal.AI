import type { Config } from "tailwindcss";

/**
 * Tailwind Configuration — Vokal.ai Framed-Sheet Light-Mode Design System
 * Aligned with globals.css tokens and design-taste-frontend v2.
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
        background: "#f9fbfc",
        surface: "#ffffff",
        "surface-active": "#eef4f6",
        raised: "#f4f6f8",

        // Text Hierarchy
        "on-surface": "#131416",
        "on-surface-variant": "#25272a",
        "on-surface-muted": "#45474a",
        "on-surface-subtle": "#5d5f60",

        // Borders
        outline: "#e8eaec",
        "outline-accent": "#b8d4dc",

        // Primary Palette
        primary: "#1b6c80",
        "primary-strong": "#134e5e",
        secondary: "#2f70bb",

        // Accent
        "accent-coral": "#a86f0c",

        // Badges
        "badge-bg": "#e6f2f5",
        "badge-text": "#134e5e",

        // Semantic
        success: "#1e7b4f",
        error: "#c4242a",
        warning: "#92400e",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "'IBM Plex Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-plex-mono)", "'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        DEFAULT: "8px",
        full: "9999px",
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
