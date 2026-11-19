---
name: Backstop
description: Neutral herbarium sheet. Claims are mounted specimens on a graphite-framed neutral board of white sheets, and accession-stamp violet, the one colour, is spent only on human decisions.
colors:
  background: "#f4f4f3"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f9f9f8"
  surface-container: "#ededec"
  surface-container-high: "#e4e5e3"
  surface-container-highest: "#d9dad8"
  outline-variant: "#d9dad7"
  outline: "#686c69"
  on-surface: "#1a1c1b"
  on-surface-variant: "#545956"
  ink: "#1d201f"
  ink-2: "#2a2e2c"
  ink-line: "#3a3f3d"
  on-ink: "#f1f2f1"
  on-ink-muted: "#a9aeab"
  primary: "#232826"
  primary-container: "#3a403d"
  on-primary: "#ffffff"
  secondary: "#1d201f"
  secondary-container: "#2a2e2c"
  on-secondary: "#ffffff"
  stamp: "#4b3fa6"
  stamp-2: "#3d3290"
  stamp-container: "#ebe8f8"
  on-stamp-container: "#2a2170"
  canary: "#dcd9ee"
  canary-container: "#efedf7"
  on-canary: "#2a2170"
  tertiary: "#2f6b3f"
  tertiary-fixed: "#dcebdc"
  on-tertiary-fixed: "#163a20"
  goldenrod: "#93641a"
  goldenrod-container: "#f3e7cc"
  on-goldenrod: "#4a3307"
  error: "#a3392b"
  error-container: "#f6e0db"
  on-error-container: "#5e1a11"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.015em"
  specimen:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  body-lead:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "28px"
  label:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: "16px"
  typed:
    fontFamily: "Courier Prime, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.01em"
rounded:
  tick: "2px"
  label: "3px"
  control: "6px"
  panel: "8px"
  dialog: "10px"
  sheet: "12px"
  pill: "9999px"
spacing:
  space-xs: "4px"
  space-sm: "8px"
  space-md: "16px"
  space-lg: "24px"
  space-xl: "32px"
  space-2xl: "48px"
  gutter-mobile: "16px"
  gutter: "24px"
  margin: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
  button-stamp:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-stamp-hover:
    backgroundColor: "{colors.stamp-2}"
  button-outline:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-outline-hover:
    backgroundColor: "{colors.surface-container-low}"
  button-danger:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-danger-hover:
    backgroundColor: "{colors.error-container}"
  button-ghost:
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
  input-text:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 10px"
  chip-matched:
    backgroundColor: "{colors.tertiary-fixed}"
    textColor: "{colors.on-tertiary-fixed}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-inferred:
    backgroundColor: "{colors.goldenrod-container}"
    textColor: "{colors.on-goldenrod}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-conflicting:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-missing:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  determination-slip:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-stamp-container}"
    rounded: "{rounded.label}"
    padding: "8px 12px"
  collection-label:
    textColor: "{colors.on-surface}"
    typography: "{typography.typed}"
    rounded: "{rounded.label}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.panel}"
  specimen-sheet:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sheet}"
    padding: "32px 36px 24px"
  rail:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    width: "248px"
  rail-link-active:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.control}"
    height: "40px"
  queue-row-selected:
    backgroundColor: "{colors.canary-container}"
    textColor: "{colors.on-surface}"
---

# Design System: Backstop

## Overview

**Creative North Star: "The Herbarium Sheet"**

Every claim Backstop finds is a collected specimen. It is mounted on a clean white sheet, carries a typed collection label (source, claim number, version, access), and gathers violet determination slips as people verify it. The app is a working collection room rather than a dashboard: a neutral graphite board and white sheets, generous margins, hairline rules instead of boxes, one graphite rail that holds the steps, and a sheet index that shows the whole collection as small mounted tiles filling violet as people decide.

The register is calm and exact, and the palette is neutral on purpose. Accession-stamp violet is the single unique colour, and it means one thing: a person decided. The only other hues are the four muted check-status colours (leaf, ochre, rust, graphite), which say what the automated checks found. Hanken Grotesk carries the interface; Courier Prime is set like a typed label for anything verbatim or catalogued (quotes, claim numbers, accession numbers, dates, counts).

This build replaced an earlier consignment-note world (blue-green ink, boxed forms, yellow canary). The token names `canary`, `canary-container` and `on-canary` survive from it, but here they hold pale lilac tints of the stamp and do a different job (see Colors). The confirmed rejections are the blue card-grid SaaS dashboard, its dark-terminal opposite, and the old boxed-form consignment note.

**Key Characteristics:**
- Neutral board (#f4f4f3 page, white sheets) with hairline rules; almost no boxes.
- One fixed graphite rail (248px) on desktop; a graphite top bar with scrolling numbered steps below 1024px.
- One colour: accession-stamp violet, reserved for human decisions (Approve, determination slips, decided ticks, readiness fill, the Received stamp).
- Four muted status colours for what the checks found; everything else is graphite and white.
- Courier Prime as the typed collection label: quotes, numbers, dates.
- Flat by default; only floating things (slips, dialogs, palette, toasts) cast a shadow.
- Motion is physical and settling: one ease-out curve (cubic-bezier(0.16, 1, 0.3, 1)), slips drop and settle, sheets file to the back, ticks fill in order.

## Colors

A neutral graphite-and-white world with one saturated violet that means "a person decided", plus four muted natural status colours.

### Primary
- **Accession-Stamp Violet** (stamp): the one unique colour, reserved for human decisions. The Approve button, determination slip borders, approved ticks in the sheet index and tally strip (corrected ticks at 55% opacity), the readiness bar fill, the "Ready to hand over" verdict, and the rotated Received stamp. Hover deepens to **Deep Stamp** (stamp-2); **Stamp Wash** (stamp-container) and **Stamp Ink** (on-stamp-container) are its pale ground and text.
- **Graphite** (primary): the action colour for forward motion and links that are not decisions: the primary button ("Check the claims"), text links, caret. Hover lifts to **Soft Graphite** (primary-container). It is near-black, not a hue.

### Secondary
- **Graphite Rail** (ink): the fixed side rail and mobile top bar. **Rail Raised** (ink-2) marks the active step and hover; **Rail Rule** (ink-line) draws hairlines inside it. Text on the rail is **Rail Paper** (on-ink) and **Rail Ash** (on-ink-muted). `secondary` and `secondary-container` carry the same two graphites for the "ink" button variant.

### Tertiary (check status)
These say what the automated checks found, never what a person decided. Each pairs a dot colour with a pale chip ground.
- **Pressed Leaf** (tertiary on tertiary-fixed): Quote matched. Leaf also draws the pressed stem in the brand mark.
- **Dried Ochre** (goldenrod on goldenrod-container): Inferred.
- **Iron-Gall Rust** (error on error-container): Conflicting; also destructive (Reject) and the "Not ready yet" verdict.
- **Graphite Grey** (outline on surface-container-high): Missing evidence. Withheld uses outline-variant on surface-container.

### Lilac highlight (the `canary` tokens)
The `canary`, `canary-container` and `on-canary` tokens keep their names from the replaced world but now hold pale lilac tints of the stamp (on-canary is stamp ink). They mark **selection and quote highlight**: the selected row in the claim queue (canary-container, claim number in on-canary), the matched quote inside a source excerpt (canary with on-canary text), the highlighter sweep behind a quote on the specimen stack and in Check a change (canary-container), and the active step number and underline on the graphite rail and the active role's access level (canary). They are never a status and never a decision.

### Neutral
- **Neutral Board** (background): the page.
- **Mounting White** (surface-container-lowest): specimen sheets, panels, slips, inputs, buttons in outline form.
- **Board Tints** (surface-container-low through -highest): hover grounds, excerpt grounds, dialog footers, pending ticks (highest), skeletons (container).
- **Hairline** (outline-variant): every rule and border at rest. **Graphite Rule** (outline): hover borders, placeholders, secondary numbers.
- **Specimen Ink** (on-surface) and **Label Grey** (on-surface-variant): body text and quiet labels.

### Named Rules
**The One Colour Rule.** The world is graphite and white; accession-stamp violet is the only unique colour, and the four status hues are the only others. Do not introduce a brand hue, a second accent, or tinted grounds.

**The Stamp Rule.** Violet appears only where a person has decided or is about to decide (Approve, slips, decided ticks, readiness fill, Received). If nobody's judgment is behind it, it is not violet. The build also uses violet for the keyboard focus ring, the skip link and text `::selection`; those are interaction affordances, not licence to use violet elsewhere.

**The Two Signals Rule.** Status colours (leaf, ochre, rust, graphite) report what the checks found; violet reports what a person decided. Never colour a decision with a status hue or a check result with violet.

**The Renamed Canary Rule.** `canary*` tokens are pale lilac highlights for "this one is selected" and "this is the quoted text". Do not reintroduce yellow, and do not use them for status or as a solid accent.

## Typography

**Display Font:** Hanken Grotesk Variable (with Hanken Grotesk, ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk Variable
**Label/Mono Font:** Courier Prime (with ui-monospace, SFMono-Regular, Menlo)

**Character:** A clean, slightly warm grotesk for the interface, against a typewriter face that makes every quote and catalogue number read like a typed collection label.

### Hierarchy
- **Display** (700, 52px desktop / 36px mobile, line-height 1.05, -0.03em): the Overview opening line only.
- **Headline** (700 to 800, 26 to 28px, 34px line-height, -0.015em): page titles (Check the claims, Handover, Check a change, Trust report). Debrief titles and Overview section heads run larger, 30 to 38px at 1.08 to 1.1.
- **Specimen** (600, 21px mobile / 25px desktop, line-height 1.25, -0.015em): the claim text on a mounted sheet.
- **Title** (600, 15px, 24px): section headings (Sheet index, Handover readiness, Receipt). Dialog titles are 17px bold.
- **Body** (400, 14 to 15px, 22 to 24px): claim rows, prose, inputs. Lead paragraphs run 17px/28px. Measure is held at 54 to 72ch.
- **Label** (500, 12.5px, 16px, no tracking, sentence case): field labels above a hairline, metadata, legends.
- **Typed** (Courier Prime, 12 to 13.5px, letter-spacing -0.01em): verbatim quotes, claim and accession numbers (`#42`, `Acc. no. BS-0001`), dates, counts and scores (readiness score set at 22px bold). Numbers use tabular figures (`.tnum`).

### Named Rules
**The Typed Label Rule.** Anything verbatim or catalogued is Courier Prime; anything written by the interface is Hanken Grotesk. A quote is never set in the sans.

**The Sentence-Case Rule.** Labels are quiet sentence-case at 12.5px with no letter-spacing. The only uppercase tracked text in the system is the rotated Received stamp, which is a rubber stamp, not a heading device.

## Layout

The app is a fixed 248px graphite rail on the left from 1024px up, with the main column offset by it. Below 1024px the rail becomes a sticky 56px graphite top bar plus a horizontally scrolling row of numbered steps (active step underlined in lilac). Content sits in a 1280px max column with side padding of 16px / 32px / 48px (mobile / sm / lg) and vertical padding of 28 to 40px. Screens compose on a 12-column grid (Overview hero 6+6 at xl; sheet index 7+5; claim queue 5 list + 7 open specimen). The claim list is sticky at 72px from the top on desktop, and the decision bar (Approve / Correct / Reject with key hints) is sticky to the bottom of the open specimen.

Rhythm comes from the 4px-based spacing scale (4, 8, 16, 24, 32, 48). Overview sections breathe at 96 to 128px apart; working screens are denser at 16 to 20px gaps. Fields are separated by a hairline and 10px of top padding rather than by boxes.

The sheet index is a tile grid of `minmax(14px, 1fr)` columns with 3px gaps; each tile is 3:4 portrait, one per claim.

## Elevation & Depth

Flat by default. Depth comes from the board-on-board relationship (white sheets on the neutral page), hairline borders, and the graphite rail framing the page. Shadows exist only on things that float above the sheet.

### Shadow Vocabulary
- **Slip lift** (`box-shadow: 0 1px 0 rgb(29 32 31 / 0.04), 0 6px 14px -10px rgb(29 32 31 / 0.35)`): determination slips, so they read as paper pinned onto the sheet.
- **Overlay lift** (`box-shadow: 0 24px 60px -20px rgb(29 32 31 / 0.45)`): native dialogs and the command palette. Dialog backdrop is rgb(29 32 31 / 0.4).
- **Toast lift** (`box-shadow: 0 16px 36px -14px rgb(23 41 31 / 0.5)`): the bottom-right status toast.

The specimen stack fakes depth with transform, not shadow: each sheet behind is offset 18px right and 14px up, rotated 2.2deg and scaled down 3.5%, with saturation dropping 25% per step.

### Named Rules
**The Only Floating Paper Rule.** A shadow means the thing is lying on top of the sheet (slip, dialog, palette, toast). Cards, panels and sheets at rest are flat.

## Shapes

Small, paper-like corners that grow with the size of the object: ticks 2px, labels and slips 3px, controls (buttons, inputs, rail links) 6px, panels 8px, dialogs 10px, mounted specimen sheets 12px. Chips, carousel controls and dots are full pills. Borders are 1px hairlines; the collection label uses a stronger 1px rule in on-surface at 70% so it reads as a printed label box. The Receipt header is separated by a dashed graphite rule. Slips and the Received stamp sit slightly rotated (slips settle at 2deg; Received at -3deg), the only rotated forms in the system.

## Components

### Buttons
Firm and quiet: semibold Hanken on a 6px corner, a 1px border in every variant, and a 1px press-down on active.
- **Shape:** gently squared (6px). Heights 32 / 36 / 44px (sm / md / lg), padding 10 / 14 / 20px, text 13 / 14 / 15px.
- **Primary:** graphite with white text; hover to soft graphite. For moving forward (Check the claims).
- **Stamp:** violet on white; hover to deep stamp. Only for decisions (Approve, sign).
- **Outline:** white with a hairline border; hover darkens the border to graphite and tints the ground. The default.
- **Danger:** white with rust text; hover gives a rust border and pale rust ground (Reject).
- **Ghost:** transparent, label grey; hover tints the ground.
- **Ink:** rail graphite with white text; hover to rail raised.
- **Focus / Disabled:** 2px violet focus ring at 2px offset; disabled at 45% opacity.
- **Key hints:** a `kbd` box (Courier Prime 11.5px bold, 1px currentColor border, 2px corner, 75% opacity) sits inside the button.

### Chips
- **Style:** full pill, a 6px status dot then the label; 12.5px medium (11.5px in the small size). Colours per status as in Colors > Tertiary. A tooltip carries the plain-language meaning.
- **Review mark:** decisions are not chips; they are coloured text (violet for approved and corrected, rust for rejected) and ticks.

### Cards / Containers
- **Field (the default container):** no box. A hairline on top, a 12.5px label-grey label, content beneath.
- **Panel:** white, hairline border, 8px corner. Used for the claim list, receipt, and handover summary blocks.
- **Specimen sheet:** white, hairline border, 12px corner, 32px top and 24 to 36px side padding.

### Inputs / Fields
- **Style:** white, hairline border, 6px corner, 40px tall (textarea min 96px), 14px text, graphite placeholder, 13px semibold label above.
- **Focus:** border and 2px outline both turn violet.

### Navigation
- **Rail:** graphite, 248px. Brand mark and name (18px bold), then project name, leaver line and a Courier accession number, then a "Jump to" button with a ⌘K kbd, then numbered steps.
- **Step link:** 40px, 6px corner, 14px medium in rail ash; Courier step number to the left. Active: rail-raised ground, rail-paper text, step number in lilac. Check the claims shows a Courier `done/total` count.
- **Mobile:** 56px graphite bar with mark, project line and icon buttons; steps scroll horizontally under a rail rule, 13px semibold, active underlined 2px in lilac.

### Determination Slip (signature)
One small paper label per human decision, pinned to the claim. White, 1px violet border, 3px corner, slip lift shadow, stamp-ink text. First line in Courier: bold "det." then who and when; second line the decision in 13px semibold; optional note clamped to two lines. Slips stack newest on top, each older one indented 10px more (up to 30px) and at 70% opacity. New slips enter with the stamp-in animation (420ms: from 10px up, -4deg, 108% scale, slight blur, to rest).

### Collection Label (signature)
The typed label in the corner of every mounted claim: Courier 12px, a two-column definition list (Source / Claim `#id · vN` / Type / Found by / Access), labels in label grey, inside a 1px on-surface-at-70% rule with a 3px corner.

### Sheet Index (signature)
The whole collection as a grid of 3:4 tiles, one per claim, coloured by what a person decided: violet approved, violet at 55% corrected, rust rejected, pale board pending. Pending claims that the checks flagged carry a status-coloured notch across their top third. Tiles fill in order once (tick-in, 7ms stagger capped at 700ms) and lift 2px on hover or focus. The tally strip on Check the claims is the same idea in a single 24px row.

### Specimen Stack (signature)
The Overview's focal moment: real claims as a fanned stack of sheets. The front sheet's quote gets a lilac highlighter sweep (900ms after a 250ms delay), a violet slip drops onto it (slip-drop, 520ms with a small overshoot), then the sheet files to the back (700ms transform). It pauses on hover, focus, when offscreen or hidden, and never auto-plays with reduced motion.

### Readiness Reading
One weighted bar, 12px tall with 3px gaps; each segment's width is its checklist weight and its violet fill is how much a person has done (grows over 900ms on first view). The score counts up in Courier 22px bold beside a verdict word.

### Source Excerpt
Courier 12.5px on board tint with a line-number gutter divided by a hairline; the quoted span is marked in lilac (canary) with on-canary text.

## Do's and Don'ts

### Do:
- **Do** mount each claim with its typed collection label and set every quote, number and date in Courier Prime.
- **Do** spend violet only on a human decision: Approve, slips, decided ticks, readiness fill, the Received stamp.
- **Do** use the four status colours (leaf, ochre, rust, graphite) only for what the checks found.
- **Do** keep the world graphite and white, with violet as the one colour.
- **Do** use the `canary*` tokens (now pale lilac) only for the selected row and highlighted quote text.
- **Do** separate content with hairlines and space before reaching for a box; use the panel only for genuinely grouped tools.
- **Do** keep shadows for floating paper (slips, dialogs, palette, toast).
- **Do** move with the settle curve cubic-bezier(0.16, 1, 0.3, 1) and honour reduced motion.

### Don't:
- **Don't** build blue card-grid SaaS dashboards, dark terminal screens, or boxed-form consignment notes.
- **Don't** use violet for decoration, status, navigation or emphasis.
- **Don't** bring back yellow canary or the old herbarium-green frame; the canary token names stay but hold pale lilac.
- **Don't** add a second accent or a brand hue alongside the stamp violet.
- **Don't** set quotes or catalogue numbers in the sans, or interface prose in Courier.
- **Don't** put small uppercase tracked labels above headings; labels are sentence-case 12.5px.
- **Don't** add shadows to panels or sheets at rest.
