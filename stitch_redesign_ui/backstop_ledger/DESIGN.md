---
name: Backstop Ledger
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#006243'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d57'
  on-tertiary-container: '#bdffdc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  gutter-mobile: 1rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system delivers an engineering-grade, deterministic intelligence environment tailored for mission-critical developer handovers and architectural state tracking. The aesthetic balances deep systemic rigor with quiet authority, taking visual cues from reliable infrastructure consoles and developer tools.

### Target Audience & Psychological Response
- **Audience:** Senior software engineers, engineering managers, systems architects, and technical compliance auditors.
- **Evoked Feelings:** Absolute certainty, cognitive ease under pressure, auditability, stability, and zero ambiguity.

### Design Philosophy
The system adheres to an **Engineered Corporate Minimalism** doctrine:
- **Precision scaffolding:** Information density is structured through deliberate structural lines, precise borders, and strict spatial alignment rather than dramatic decorative elements.
- **Unobtrusive utility:** Chrome and surfaces recede into the canvas so verification statuses, diff states, and provenance chains command immediate clarity.
- **Earned emphasis:** Color is restricted to status-bearing metadata and focused interactive affordances. No superfluous gradients, ambient glows, or aggressive alerts.

## Colors

The palette is engineered for protracted operational focus, pairing a cool slate foundation with purposeful cobalt accents and high-fidelity semantic indicators.

### Base Canvas & Structure
- **Canvas Root:** `#F8FAFC` (Slate 50) establishes a low-glare backdrop.
- **Surfaces & Cards:** `#FFFFFF` (Pure white) for distinct container elevations.
- **Borders & Dividers:** `#E2E8F0` (Slate 200) for structural framing and compartmentalization.
- **Muted Borders:** `#F1F5F9` (Slate 100) for internal tabular divisions and nested metadata rows.

### Text Contrast
- **Heading & Primary Text:** `#0F172A` (Slate 900) ensures maximum contrast (minimum 12:1 against white).
- **Secondary / Supporting:** `#334155` (Slate 700) for body narratives and explanatory contextual notes.
- **Tertiary / Subdued:** `#64748B` (Slate 500) for labels, timestamps, commit hashes, and disabled elements.

### Semantic Status Tokens
- **Verified:** Primary `#059669` (Emerald 600) on `#ECFDF5` (Emerald 50). Signifies deterministic proof and signed artifacts.
- **Inferred:** Primary `#D97706` (Amber 600) on `#FFFBEB` (Amber 50). Flags heuristics requiring human verification.
- **Conflicting:** Primary `#DC2626` (Red 600) on `#FEF2F2` (Red 50). Signifies divergent architectural states.
- **Missing Evidence:** Primary `#64748B` (Slate 500) on `#F1F5F9` (Slate 100). Indicates untracked dependencies or missing telemetry.

### Provenance Kind Badges
- **Derived:** Primary `#4F46E5` (Indigo 600) on `#EEF2FF` (Indigo 50). Indicates automated AST/pipeline parsing.
- **Interpreted:** Primary `#7C3AED` (Purple 600) on `#F5F3FF` (Purple 50). Indicates LLM/agent contextual summarization.

## Typography

Typography establishes clear visual parsing for complex dependency trees and code audit trails.

- **Typeface Selection:** Inter is implemented uniformly across all typographic roles, capitalizing on its balanced x-height, clear numeric tabular styling, and neutral grotesque construction.
- **Readability Floor:** Standard body text is strictly locked at 15px (`body-md`) with a generous 1.6 relative line height (`24px`), preventing visual fatigue during comprehensive handover assessments.
- **Hierarchy Rules:** All headings leverage tighter letter spacing (`-0.02em` to `-0.005em`) to preserve crisp lockups. Metadata tags and state chips utilize uppercase or title-cased `label-sm` with slight positive tracking (`0.02em`) for immediate legibility at small scale.

## Layout & Spacing

The system is constructed on a mathematical 4px baseline rhythm with consistent structural margins.

### Grid & Composition
- **Desktop (1280px+):** Fixed-fluid hybrid layout anchored by a 240px persistent operational sidebar and a 12-column content grid with `gutter` (24px) and page boundaries capped at 1440px with `margin` (32px).
- **Tablet (768px - 1279px):** 8-column layout. Sidebar collapses to an icon bar or drawer. Gutter shifts to 16px.
- **Mobile (< 768px):** Single-column stacked stream. Margins and gutters lock to 16px (`margin-mobile`, `gutter-mobile`). Data tables reflow into discrete accordion cards.

### Spacing Principles
- Internal card padding is standardized at `space-lg` (24px) for master records and `space-md` (16px) for nested evidence sub-panels.
- Dense data displays utilize `space-xs` (4px) and `space-sm` (8px) for tightly grouped key-value pairs, ensuring relationships are perceptually bonded through proximity.

## Elevation & Depth

Visual hierarchy relies on structural planes and subtle tonal framing rather than high-contrast drops.

### Elevation Levels
- **Canvas Base (Level 0):** Pure `#F8FAFC`. Zero elevation, providing the foundation for all workspace canvases.
- **Surface Cards (Level 1):** Solid `#FFFFFF`, framed with a 1px border of `#E2E8F0` and an ultra-subtle ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05)`.
- **Hover & Interactive (Level 2):** Retains `#FFFFFF` with an expanded shadow of `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`. Border shifts dynamically to `#CBD5E1`.
- **Modals, Flyouts & Overlays (Level 3):** `#FFFFFF` with `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)` and a 1px border in `#CBD5E1`. Backdrops use `rgba(15, 23, 42, 0.4)` with zero blur to retain sharpness.

## Shapes

The design uses a clean, architectural curvature standard:
- **Base Components:** Controls, inputs, and chips share an 8px (`0.5rem`) radius, balancing modern ergonomics with engineering precision.
- **Containers & Cards:** Primary containers and surfaces scale to 12px or 16px (`1rem`), defining crisp, distinct content modules.
- **Tags & Indicators:** Status chips and badges utilize an inner 6px radius or standard 8px radius to echo host containers. Pill radiuses are reserved exclusively for standalone badge tags and notification count bubbles.

## Components

### Buttons & Interactive Affordances
- **Primary:** Solid `#2563EB`, text `#FFFFFF`, 8px radius, height 38px, horizontal padding `space-md`. Hover: `#1D4ED8`. Active: `#1E40AF`.
- **Secondary / Outline:** Background `#FFFFFF`, border 1px `#E2E8F0`, text `#0F172A`. Hover: background `#F8FAFC`, border `#CBD5E1`.
- **Tertiary / Ghost:** No border, transparent background, text `#334155`. Hover: background `#F1F5F9`.

### Status & Kind Badges
- **Dimensions:** Height 22px, padding 2px 8px, font token `label-sm`, rounded 6px.
- **Statuses:**
  - *Verified:* Text `#059669`, background `#ECFDF5`, border 1px `#A7F3D0`. Includes a 6px solid emerald dot before text.
  - *Inferred:* Text `#D97706`, background `#FFFBEB`, border 1px `#FDE68A`. Includes a 6px hollow amber dot.
  - *Conflicting:* Text `#DC2626`, background `#FEF2F2`, border 1px `#FECACA`. Includes an alert indicator icon.
  - *Missing Evidence:* Text `#64748B`, background `#F1F5F9`, border 1px `#E2E8F0`.
- **Kind Badges:**
  - *Derived:* Text `#4F46E5`, background `#EEF2FF`, border 1px `#C7D2FE`.
  - *Interpreted:* Text `#7C3AED`, background `#F5F3FF`, border 1px `#DDD6FE`.

### Input Fields & Controls
- **Inputs:** Height 38px, background `#FFFFFF`, border 1px `#E2E8F0`, font size 15px, text `#0F172A`. Focus: border `#2563EB`, outline 2px solid `rgba(37, 99, 235, 0.15)`.
- **Checkboxes & Radios:** 16px bounding box, border `#CBD5E1`, selected background `#2563EB`.

### Cards & Ledger Blocks
- **Container Standard:** Pure `#FFFFFF` background, 1px `#E2E8F0` border, subtle elevation `0 1px 3px rgba(15, 23, 42, 0.05)`, border-radius 12px.
- **Ledger Row Items:** Divided by 1px `#F1F5F9` rules. Hover transition highlights the row with `#F8FAFC`.

### Locked & Role-Gated Items
- **Visual Presentation:** Subdued background `#F8FAFC`, dashed 1px border `#CBD5E1`, inner elements rendered at 50% opacity.
- **Affordance Structure:** Centered or inline discreet lock icon (`#64748B`, 16px) accompanied by clear human-readable permission criteria (e.g., *"Requires Maintainer role or signed GPG verification to inspect audit trail"*). Direct call-to-action link provided for role escalation requests.

### Simulated Demo Banner
- **Format:** Top-pinned non-intrusive utility ribbon.
- **Styling:** Neutral background `#F1F5F9`, subtle bottom border `#E2E8F0`, text `#475569`, 13px medium typography. Includes a calm badge labeled `SANDBOX PLAYGROUND` (border `#CBD5E1`, background `#FFFFFF`) with a one-click action to reset state.