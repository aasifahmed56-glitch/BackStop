---
name: Backstop
description: Consignment-note world: a blue-green ink frame on cool paper, boxed forms, and canary reserved for what is under inspection.
colors:
  background: "#eef1f1"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f5f7f7"
  surface-container: "#e7ecec"
  surface-container-high: "#dde4e4"
  surface-container-highest: "#d3dcdc"
  outline-variant: "#c3cecf"
  outline: "#66787b"
  on-surface: "#0f1f22"
  on-surface-variant: "#465659"
  ink: "#0e2f36"
  ink-2: "#164049"
  ink-line: "#2a5560"
  on-ink: "#eef4f3"
  on-ink-muted: "#a9c2c2"
  primary: "#0b5560"
  primary-container: "#0e6b78"
  on-primary: "#ffffff"
  secondary-fixed: "#dbe6e6"
  on-secondary-fixed: "#0e2f36"
  on-secondary: "#ffffff"
  canary: "#f4cf3f"
  canary-container: "#fdf2c2"
  on-canary: "#4a3800"
  tertiary: "#1d6a3a"
  tertiary-fixed: "#d4ecda"
  on-tertiary-fixed: "#0c3a1d"
  goldenrod: "#9a6410"
  goldenrod-container: "#f6e5c3"
  on-goldenrod: "#4f3204"
  error: "#b0244a"
  error-container: "#f8dde4"
  on-error-container: "#6c0f2a"
typography:
  display:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0em"
  title:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "0em"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0em"
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.07em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0em"
rounded:
  sm: "2px"
  md: "3px"
  lg: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.error}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  chip-matched:
    backgroundColor: "{colors.tertiary-fixed}"
    textColor: "{colors.on-tertiary-fixed}"
    rounded: "{rounded.sm}"
  chip-inferred:
    backgroundColor: "{colors.goldenrod-container}"
    textColor: "{colors.on-goldenrod}"
    rounded: "{rounded.sm}"
  chip-conflicting:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.sm}"
  chip-missing:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
  boxed-field:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.md}"
    padding: "8px 12px 12px"
  manifest-row-selected:
    backgroundColor: "{colors.canary-container}"
    textColor: "{colors.on-surface}"
  role-card-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  step-number-active:
    backgroundColor: "{colors.canary}"
    textColor: "{colors.on-canary}"
    rounded: "{rounded.sm}"
    width: "20px"
    height: "20px"
---

# Design System: Backstop

## Overview

**Creative North Star: "The Consignment Note"**

Backstop reads like a consignment note on a bill of lading: a form that travels with a load and must be signed for. The departing engineer's knowledge leaves with a declared manifest, and every line is inspected against its proof before it is released. The world is a shipping form made for review. An ink frame (deep blue-green header and footer) holds a cool paper ground. Content sits in white boxed panels with 1px hairlines and 2 to 4px corners, and every field carries its small caps label tucked into its top-left corner.

Density is working density. A lead scans a long manifest with a proof excerpt beside it; a newcomer reads a short role-limited plan and signs. Almost nothing is decorative. The one flourish is the rotated receipt stamp, which appears only after a person signs for receipt. Depth comes from hairlines and tone, not shadow; shadows exist only under overlays such as dialogs and the action toast. Missing evidence is shown as a question, never filled in.

Confirmed rejections: the blue card-grid SaaS dashboard, and its dark-terminal opposite.

**Key Characteristics:**
- Ink frame (blue-green header and footer) around a cool paper ground.
- Boxed fields with the label in the box's top-left corner.
- Status carried in four colours, each paired with its own word.
- Verbatim quotes, line numbers, IDs and form numbers in a monospace face.
- A tally strip, one tick per claim, is the signature; the stamped receipt closes it.

## Colors

A cool, quiet palette: blue-green ink carries structure, paper and white carry content, and a small set of state colours carries meaning. Canary is the attention colour and is never a status.

### Primary
- **Form Teal** (#0b5560, `primary`): the one primary action per view and the inline link colour. Approve, Check the claims and Sign for receipt use it. Hover deepens to Harbour Teal (#0e6b78, `primary-container`).

### Secondary
- **Ink Blue-Green** (#0e2f36, `ink`): the frame. Header and footer fill, the selected role card, the ink button, and the active filter chip. The token `secondary` carries the same value. Ink 2 (#164049, `ink-2`) is the hover and tint on ink; Ink Line (#2a5560, `ink-line`) draws rules on ink; On Ink (#eef4f3) and On Ink Muted (#a9c2c2) are the text on ink.

### Tertiary
- **Canary** (#f4cf3f, `canary`; container #fdf2c2; text #4a3800): attention only. It marks the selected manifest line, the highlighted quote, the active step number and the ink-bar underline.
- **Form Green** (#1d6a3a, `tertiary`; container #d4ecda): approved and quote matched. Used for the Approved review state, matched chips, and the received stamp.
- **Goldenrod** (#9a6410, `goldenrod`; container #f6e5c3): inferred, part-supported claims, and the confidential access chip.
- **Carbon Pink** (#b0244a, `error`; container #f8dde4): conflicting and rejected claims, and restricted access.
- **Missing grey**: the missing-evidence chip uses Pale Tray High (#dde4e4) with Ink Text. It carries no hue.

### Neutral
- **Cool Paper** (#eef1f1, `background`): the page ground.
- **Form White** (#ffffff, `surface-container-lowest`): panels, inputs and boxed fields.
- **Pale Tray** (#f5f7f7 low, #e7ecec `surface-container`, #dde4e4 high, #d3dcdc highest): table headers, filter wells, and the not-checked tick.
- **Hairline** (#c3cecf, `outline-variant`): every 1px rule and panel border.
- **Pencil Grey** (#66787b, `outline`): line numbers, the dashed rule above the receipt, placeholder text and icons.
- **Ink Text** (#0f1f22, `on-surface`) and **Slate Text** (#465659, `on-surface-variant`): primary text, and secondary text with field labels.

### Named Rules
**The Canary Marks Attention Rule.** Canary is the one thing under inspection: the selected line, the highlighted quote, the active step. It is never a status colour.

## Typography

**Display Font:** Public Sans (with ui-sans-serif, system-ui, sans-serif). Loaded at weights 400 to 800.
**Body Font:** Public Sans, the same family for all UI and prose.
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace), at weights 400 to 700, for text that must be exact.

**Character:** A plain form sans with tabular figures, paired with a mono face that reads as typed evidence. The mono is reserved for what must be verbatim.

### Hierarchy
- **Display** (700, 44px on desktop and 34px on mobile, line-height 1.1, letter-spacing -0.025em): the Overview headline only.
- **Headline** (700, 22px, line-height 28px): section heads such as "How the consignment works". Page titles run 26 to 28px; Check the claims sets its title at weight 800, and the canonical page-title weight is 700.
- **Title** (700, 17px, line-height 24px): dialog titles, panel headings and the handover's section heads.
- **Body** (400, 14px, line-height 22px; intro paragraphs 15 to 16px at 24 to 26px): default text. Intro copy is capped near 56 to 64ch.
- **Label** (600, 10.5px, line-height 14px, letter-spacing 0.07em, uppercase): the boxed-field label, always in the box's top-left corner. Chips and access tags are 11 to 12px semibold in sentence case.
- **Mono** (400, 12.5px, line-height 20px): verbatim quotes, line numbers, claim IDs ("#17", "Line #17") and consignment numbers ("BS-0001"). Tabular figures are on for counts and tallies.

### Named Rules
**The Caps Are Boxed Rule.** Uppercase tracked caps belong to the boxed-field label and to the receipt stamp. Section titles and navigation are sentence case.

## Layout

- **Page:** a single centred column, 1360px at most. Side gutter 16px below 640px and 24px from 640px. Top padding 24px, rising to 32px from 640px.
- **Header:** a sticky ink bar, 56px tall, holding the brand, the consignment line and four numbered steps. Below 768px the steps move to a full-width bar under the header, with 11.5px labels; "Check the claims" shortens to "Check".
- **Overview:** from 1024px, a 12-column grid. The headline spans 7 columns and the specimen consignment note 5 columns, with a 32px gap that grows to 48px. The three-step journey is three columns from 768px, separated by hairlines, and stacks below.
- **Check the claims:** the tally strip runs full width, then the filter row. From 1024px the manifest takes 5 of 12 columns and is sticky; the inspection form takes 7. The two are separated by a 20px gap. Below 1024px they stack, and selecting a line scrolls the form into view. The decision bar is sticky at the foot of the form.
- **Handover:** the summary is 2 columns below 1024px and 6 from 1024px, separated by 1px hairlines. The ramp-up plan is three columns from 1024px. Focus cards are 2 columns from 768px and 3 from 1024px.
- **Rhythm:** a 4px base step. The values in use are 4, 8, 12, 16, 20 and 24px. Panel padding is 12px sides and 8px top. Sections within a page sit 20px apart; Overview sections sit 56 to 64px apart. The `--spacing-space-*` tokens in `index.css` (0.25 to 3rem) are not used by the in-scope screens.
- **Breakpoints:** Tailwind defaults: sm 640px, md 768px, lg 1024px, xl 1280px.

## Elevation & Depth

Flat by default. Resting surfaces (panels, cards, tables, the sticky header) carry no shadow. Depth comes from a 1px Hairline border on Form White over Cool Paper, and from tonal steps through the Pale Tray. Shadows appear only on overlays that float above the page.

### Shadow Vocabulary
- **Dialog lift** (`box-shadow: 0 18px 48px -12px rgb(14 47 54 / 0.45)`): modal dialogs. The colour is the ink value written as a literal.
- **Notice lift** (`box-shadow: 0 12px 32px -12px rgb(14 47 54 / 0.5)`): the fixed action toast.
- **Overlay backdrop** (`background: rgb(14 47 54 / 0.45)`): behind a dialog. It is a scrim, not a shadow.

### Named Rules
**The Flat Until Overlaid Rule.** Surfaces are flat at rest. A shadow appears only when something floats above the page, and it is tinted with ink.

## Shapes

Square and precise. Corners are 2px on chips, keys and inline marks; 3px on panels, buttons, inputs and boxed fields; 4px on dialogs and the toast. Nothing rounds beyond 4px. Status dots are the only round marks.

The form language is drawn with rules rather than fills. A boxed field is a 1px box with its label tucked into the top-left corner. Grids are drawn with a 1px gap over a Hairline background, so the gap reads as a divider. A dashed 1px Pencil Grey rule sits above the receipt footer. The receipt stamp is a 2px Form Green border with 3px corners.

## Components

Components look like paperwork: boxed, bordered, labelled, and sparing with colour.

### Buttons
- **Shape:** 3px corners. 36px tall by default, 32px small, 44px large. 14px horizontal padding, semibold 14px label.
- **Primary:** Form Teal fill with white text. One per view: Approve, Check the claims, Sign for receipt.
- **Ink:** Ink fill with white text. Used on the active filter chip rather than as a call to action.
- **Outline:** Form White fill, Hairline border, Ink Text. The default for every secondary action, including Print.
- **Danger:** Form White fill with Carbon Pink text and border on hover. Used for Reject.
- **Ghost:** no border or fill, Slate Text. Used for Clear filters and Link.
- **Hover / Focus:** colour transitions over 150ms. Primary darkens to Harbour Teal; outline moves its border to Pencil Grey. Focus-visible draws a 2px Form Teal outline with a 2px offset.

### Status Chips
- **Shape:** 2px corners. Text 11px at the small size and 12px at the default, semibold. A 6px dot leads the label.
- **Style:** Matched in Form Green on Matched Tint; Inferred in Goldenrod on its container; Conflict in Carbon Pink on its container; Missing in Ink Text on Pale Tray High.
- **Rule:** every chip carries its word. The dot repeats the colour and is hidden from assistive technology.

### Boxed Fields
- **Style:** Form White fill, 1px Hairline border, 3px corners, 8px top and 12px bottom padding around the content.
- **Label:** Label type in the top-left corner; content at 14px beneath it.
- **Use:** the specimen note on Overview, and Evidence, Checks and History in the inspection form.

### Manifest Tally (signature)
- One tick per claim, 24px tall, with 1px gaps across the full width. Colour follows the review state: Form Green approved, Form Teal corrected, Carbon Pink rejected, Pale Tray highest for not checked. An unchecked tick carries a notch at its top edge when the checks found a conflict, a gap or an inference. Hover stretches the tick vertically to 110%. The selected tick takes Canary.

### Manifest Rows
- A mono line number at the left, then a status chip and review mark on one row, then claim text at 14px clamped to two lines, then type and source. Selected rows take Canary Container with Canary-on text for the line number.

### The Proof Beside the Claim Rule
**The Proof Beside the Claim Rule.** Every claim shows its quote or its calculation in the same view as its text. A claim with no stored proof reads "Treat it as unproven" and is not dressed up as verified.

### Role Cards
- Three radio cards in a row, stacked on mobile. Selected: Ink fill, On Ink text, and the access label in Canary. Unselected: Form White with a Hairline border.

### Navigation Steps
- Numbered 20px squares. Inactive: a 1px Ink Line border on the ink bar. Active: Canary fill with On Canary number and a 3px Canary underline across the tab.

### Receipt Stamp
- **Shape:** 2px Form Green border, 3px corners, 18px extrabold caps at 0.14em tracking, rotated -3deg.
- **Motion:** stamps in over 420ms with a scale-and-blur settle. Notices rise in over 220ms. Reduced-motion users get no animation or transition.

### The Stamp Is Earned Rule
**The Stamp Is Earned Rule.** The rotated stamp appears only on the signed receipt, after a person has signed for it. It is never used as decoration elsewhere.

### Notices and Toasts
- Inline notices: 3px corners, tinted container fill with a matching border at 40% opacity.
- Toast: fixed bottom right, 4px corners. Ink fill for information, Error Container for errors, Goldenrod Container for warnings.

## Do's and Don'ts

### Do:
- **Do** put the quote or calculation beside every claim, in mono, with a Canary mark on the matched text.
- **Do** show missing evidence as a question in the Missing chip, never as filled-in text.
- **Do** carry status in a chip with its word, not colour alone.
- **Do** keep depth as a 1px Hairline, a tonal step, and the corner radius.
- **Do** use one Form Teal primary action per view.

### Don't:
- **Don't** use Canary as a status colour; it marks what is under inspection.
- **Don't** add a shadow to a resting panel, card or table; shadows belong only to the dialog and the toast.
- **Don't** round any container beyond 4px; status dots are the only round marks.
- **Don't** use Carbon Pink for anything except conflicting, rejected and restricted claims.
- **Don't** set verbatim text, line numbers or IDs in the sans face.
- **Don't** rotate the receipt stamp anywhere but on the signed receipt.
