---
version: 1.0
name: MockIF-Dashboard
description: "Clean light-mode consumer dashboard measured from app.mockif.com/dashboard: Snow gray canvas, pure white bordered cards, soft lavender active states, and purple-to-coral pill buttons."
theme-mode: light-only
colors:
  background: "#F9FAFB"
  surface: "#FFFFFF"
  surface-container-low: "#FFFFFF"
  surface-active-tint: "#F5F3FF"
  on-surface: "#111827"
  on-background: "#111827"
  on-surface-variant: "#1F2937"
  on-surface-muted: "#374151"
  on-surface-subtle: "#6B7280"
  outline: "#E5E7EB"
  outline-accent: "#C4B5FD"
  primary: "#818CF8"
  primary-strong: "#6D28D9"
  secondary: "#A78BFA"
  accent-coral: "#E2725B"
  badge-bg: "#EDE9FE"
  badge-text: "#6D28D9"
gradients:
  primary-cta: "linear-gradient(90deg, #9370DB 0%, #A78BFA 35%, #E2725B 100%)"
typography:
  page-title:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  section-title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.01em
  card-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  sidebar-category:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.05em
    textTransform: uppercase
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: 10px
  md: 16px
  full: 9999px
spacing:
  xs: 8px
  sm: 12px
  md: 20px
  lg: 28px
  xl: 36px
components:
  card-default:
    backgroundColor: "#FFFFFF"
    border: "1px solid #E5E7EB"
    rounded: "16px"
    padding: "24px"
    shadow: "0px 1px 3px rgba(17, 24, 39, 0.04)"
  card-highlighted-step:
    backgroundColor: "#F5F3FF"
    border: "1px solid #EDE9FE"
    rounded: "16px"
    padding: "20px 24px"
  button-primary-gradient:
    background: "linear-gradient(90deg, #9370DB 0%, #A78BFA 35%, #E2725B 100%)"
    textColor: "#FFFFFF"
    typography: "{typography.label-md}"
    rounded: "9999px"
    padding: "12px 24px"
    height: "44px"
    shadow: "0px 8px 20px -4px rgba(167, 139, 250, 0.4)"
  button-outline-pill:
    backgroundColor: "#FFFFFF"
    border: "1.5px solid #C4B5FD"
    textColor: "#111827"
    typography: "{typography.label-md}"
    rounded: "9999px"
    padding: "10px 22px"
    height: "42px"
  sidebar-nav-item-active:
    backgroundColor: "#F5F3FF"
    textColor: "#111827"
    fontWeight: 600
    rounded: "9999px"
    padding: "10px 16px"
  badge-pill:
    backgroundColor: "#EDE9FE"
    textColor: "#6D28D9"
    fontSize: "10px"
    fontWeight: 700
    rounded: "9999px"
    padding: "2px 8px"
---

# MockIF Dashboard Design System

## 1. Overview & Strict Light-Mode Enforcement
The interface is strictly a bright, high-whitespace **Light Mode** consumer web app built on a **Snow (#F9FAFB)** canvas with **Pure White (#FFFFFF)** cards, **Deep Navy (#111827)** typography, **Soft Lavender (#F5F3FF)** active surfaces, and **Purple-to-Coral (`#9370DB` -> `#E2725B`)** pill-shaped primary buttons.

## 2. Layout & Information Density Rules
- **Top Header Bar:** 64px height, `#FFFFFF` background, bottom border `1px solid #E5E7EB`. Brand logo on far left, centered user greeting (`Welcome back, [Name]! 👋`), right-aligned notification bell and `#E2725B` coral user avatar circle.
- **Left Floating Sidebar:** 250px width, `#FFFFFF` surface with `16px` radius. Grouped into uppercase muted categories (`OVERVIEW`, `PREPARATION`, `PRACTICE & INTERVIEWS`, `PERFORMANCE`). Active item uses a `#F5F3FF` pill fill.
- **Main Workspace Grid:** 2-column asymmetric split (`65%` main left column, `35%` right utility column) with `20px` gap and generous whitespace.
- **Low Density Rule:** Never place multi-line charts, dense data tables, or more than 3 cards in a single column on the dashboard.

## 3. Do's and Don'ts
- **DO** use `#F9FAFB` for the main background and `#FFFFFF` for elevated card containers.
- **DO** highlight the primary active onboarding step or active sidebar tab with `#F5F3FF` (soft lavender).
- **DO** make all action buttons pill-shaped (`9999px`) and all card containers `16px` rounded.
- **DO** use the purple-to-coral gradient (`linear-gradient(90deg, #9370DB, #E2725B)`) ONLY for the primary CTA buttons.
- **DON'T** use dark backgrounds (`#111827` or `#1F2937`) for pages or cards; those colors are strictly for text.
- **DON'T** crowd the page with analytics graphs on the main view.