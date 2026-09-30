---
name: Weed Man Sales Quote
description: A live work order that prices a lawn program mid-call on one laptop screen.
colors:
  weed-man-green: "#03663b"
  green-soft: "#e6f0e9"
  due-panel: "#03663b"
  due-muted: "#cfe6d8"
  savings-lime: "#dff58f"
  soft-paper: "#f3f5f2"
  surface: "#ffffff"
  surface-hover: "#eef3ef"
  forest-ink: "#16211b"
  sage-muted: "#56655c"
  rule: "#d3dcd5"
  control-edge: "#86958b"
  stamp-red: "#c42b1c"
  dark-ground: "#0c1510"
  dark-surface: "#131f18"
  dark-ink: "#e4ece6"
  dark-muted: "#9aab9f"
  dark-green: "#1f7a4a"
  dark-green-text: "#6fd19a"
  dark-due-panel: "#145c38"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 4.8vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 80"
  headline:
    fontFamily: "Bricolage Grotesque, Segoe UI, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Bricolage Grotesque, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum'"
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "9px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.weed-man-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 18px"
    height: "44px"
  button-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.weed-man-green}"
    rounded: "{rounded.sm}"
    height: "52px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.sm}"
    padding: "0 38px 0 12px"
    height: "48px"
  program-line-selected:
    backgroundColor: "{colors.weed-man-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  box:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px 14px"
  due-panel:
    backgroundColor: "{colors.due-panel}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

# Design System: Weed Man Sales Quote

## Overview

**Creative North Star: "The Live Work Order"**

The quote is one numbered service form that fits a laptop screen. Every input
lives in a numbered box, the six program prices sit together in one ruled
list, and the price lives in the Amount Due panel, the one saturated surface
on the page. It is built for a rep on a headset: dense, calm, and instantly
readable, with flash reserved for the moment a number changes.

Motion is the personality. Prices roll like an odometer, the selection
highlight glides between program lines, and a business rule that removes an
option stamps itself onto the box it affects. Everything else stays flat and
quiet so the moving number is the thing the eye catches.

Light and dark share one grammar. Dark mode is the same form on a deep forest
ground, not an inverted palette.

**Key Characteristics:**
- Seven numbered boxes, each headed by the same number-and-label strip.
- Weed Man green for selection, focus, and the Amount Due panel.
- One lime, only for money saved.
- A monumental condensed total; nothing else on screen is large.
- The copy action always above the fold on a 1366×650 viewport.

## Colors

Soft neutrals with one committed Weed Man green and a single lime for savings.

### Primary
- **Weed Man Green** (`weed-man-green`): the selected program line, the chosen payment option, focus rings, primary buttons, and the Amount Due panel. In dark mode it lifts to `dark-green` for fills and `dark-green-text` for text.
- **Green Wash** (`green-soft`): the chosen payment option's fill and the box-number chips.

### Secondary
- **Savings Lime** (`savings-lime`): discount and bonus lines inside the Amount Due panel. Nowhere else.

### Neutral
- **Soft Paper** (`soft-paper`): the page behind the boxes.
- **Surface** (`surface`): every box, dropdown, and dialog.
- **Forest Ink** (`forest-ink`): all primary text; also the toast background.
- **Sage** (`sage-muted`): help text, secondary lines, the "sq ft" suffix.
- **Rule** (`rule`): box borders and the lines between programs.
- **Control Edge** (`control-edge`): borders that identify a control (dropdowns, stepper, payment options); kept at 3:1 against the surface.
- **Stamp Red** (`stamp-red`): errors and the "Removed by prepay" stamp.

### Named Rules
**The One Green Rule.** Weed Man green marks what is chosen or what matters now: the selection, the focus, the price. It is never decoration.

**The Lime Means Money Rule.** Lime appears only on savings. A discount line is lime; nothing else is.

## Typography

**Display Font:** Bricolage Grotesque (self-hosted, with Segoe UI fallback)
**Body Font:** the system UI face (Segoe UI Variable on Windows)

**Character:** A condensed, heavy grotesque for every number that matters,
over a plain system face for everything that explains. Numbers use tabular
figures so prices align.

### Hierarchy
- **Display** (800, clamp(3.25rem, 4.8vw, 4.75rem), 1.05, 80% width): the Amount Due total only.
- **Headline** (700, 2.25rem, 85% width): the lawn-size entry in box 1.
- **Title** (600, 1.125rem): program prices, the program name in the panel.
- **Body** (400, 0.9375rem, 1.45): descriptions, schedule text, notes line.
- **Label** (600, 0.8125rem): box headings and field labels, sentence case.

### Named Rules
**The One Monument Rule.** Only the Amount Due total is set at display size. Adding a second large number breaks the page's focus.

## Layout

A two-column workspace (max 1600px): the order on the left, the Amount Due
panel (360–400px) on the right, sticky below the 56px top bar and capped to
the viewport height so its copy actions are always visible; its middle
section scrolls when the itemization is long. The order is a 4-column box
grid: lawn size, applications, area, promotion across the top; programs and
payment side by side beneath. Saved quotes (box 7) sits under the order.

Spacing rhythm: 12px between boxes, 16px between columns, 12–14px inside boxes.

Breakpoints: below 1180px the boxes pair two per row and the panel narrows to
340px; below 760px everything stacks in one column with the Amount Due panel
after payment and before saved quotes.

## Elevation & Depth

Flat by default: boxes are separated by a 1px rule, not shadows. Three things
lift: the Amount Due panel (`0 12px 32px`), the sliding program highlight
(`0 4px 12px`), and overlays (dialog and toast, `0 20px 50px`). Shadows are
green-tinted in light mode and pure black in dark mode.

**The Flat Form Rule.** Boxes never cast shadows. Only the price panel, the moving highlight, and overlays leave the page.

## Shapes

Gently rounded throughout: controls and program lines 9px, boxes 12px, the
Amount Due panel and dialog 16px, the tier chip fully rounded. Borders are 1px;
the lawn-size field is the one underlined input, with a 2px rule that sweeps
green from the left on focus.

## Components

### Buttons
- **Shape:** gently rounded (9px), 44px minimum height.
- **Primary:** Weed Man green fill, white text.
- **Copy customer quote:** the panel's primary action, a white 52px button with green text and a copy icon.
- **Outline:** 1px edge, surface fill; inside the panel, a translucent white edge on the green.
- **Ghost:** text and icon only (New quote, Delete all).
- **Press:** buttons scale to 0.97 on press.

### Inputs / Fields
- **Dropdowns:** 48px, 16px text (no zoom on iPhone), control-edge border, custom chevron; hover turns the border green.
- **Lawn size:** large display-face digits on a 2px underline that sweeps green on focus; turns red when invalid.
- **Stepper:** a bordered 48px bar with 44px − and + ends.
- **Disabled:** 35% opacity with the reason stated on the box.

### Program List (signature)
Six ruled lines, each with name, what is included, and the season total.
One green highlight slides behind the selected line; its text turns white.
Every price rolls to its new value when the lawn size changes.

### Payment Options
Three stacked rows with a drawn radio: the selected row gets a green edge, a
green wash, and a dot that scales in. Monthly autopay reveals the draft-day
dropdown with a short slide.

### Amount Due Panel (signature)
The green panel: program and area, the tier chip, the rolling total,
per-application price and visit count, then itemized lines, payment
schedule, the notes line, and the three actions pinned at the bottom.

### Rolling Digits
Each digit is a clipped 0–9 strip that rolls to its value in 560ms with an
exponential ease-out, staggered right to left by 30ms. Screen readers get the
plain value through `aria-label`. Reduced motion removes the roll.

### Void Stamp
When prepay removes the promotion, the promotion box dims and a red
"Removed by prepay" stamp lands on it (320ms, scaling from 1.6×, rotated −6°).

## Do's and Don'ts

### Do:
- **Do** keep the whole quote, including Copy customer quote, visible on a 1366×650 laptop viewport.
- **Do** number every input box and head it with the same number-and-label strip.
- **Do** animate numbers when they change, and show a rule's effect where it happens (the void stamp).
- **Do** keep control borders at 3:1 and text at 4.5:1 in both themes.

### Don't:
- **Don't** add a second saturated surface; the Amount Due panel is the only one.
- **Don't** use lime for anything but savings.
- **Don't** hide a disabled option; void it in place and say why.
- **Don't** put small labels above headings or use all-caps labels.
