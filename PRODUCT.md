# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inside sales representatives at Weed Man, a lawn treatment company. They quote
customers live, on the phone, at a desk, mostly on laptops. The rep listens,
types a measured lawn size, picks options while the customer talks, reads a
price aloud, and copies the result into their records before the call ends.
Their sales manager maintains the tool and updates pricing once a year.

## Product Purpose

Turn a lawn's square footage into an exact season price for any program,
payment arrangement, and promotion, fast enough to answer mid-call, and
produce copy-ready text for the customer and for internal notes. Success is a
rep giving a correct price without putting the customer on hold, and never
quoting a wrong number.

## Positioning

It replaces a pricing spreadsheet and mental math with one screen that knows
this year's rate table, the large-lawn formula, the stacking rules for
promotions and prepay, and the exact monthly payment schedule.

## Operating Context

- Used during live calls; attention is split between the customer and the
  screen, so the current total must be readable at a glance.
- Laptop screens are the primary target; phones must still work.
- Installable web app that works offline (service worker); a refresh prompt
  appears when a new release is published.
- Output leaves the tool by clipboard: "Copy customer quote" (a short text
  message) and "Copy notes" (a one-line internal note).
- Saved quotes live only in the rep's own browser, found by customer ID (CID).

## Capabilities and Constraints

- Inputs: square footage (formula pricing above 99,999 sq ft), applications
  remaining (1–7), program (Essentials, Enhanced, Elite, AG, Program B,
  Program C), payment (autopay per visit, monthly autopay with a draft day
  1–28, prepay), treatment area (entire lot, front and sides, backyard; notes
  only, not price), promotion (none, Military / First Responder 5%, DH50,
  WEB50).
- Rules the UI must express: promotions cannot combine; prepay removes other
  promotions; prepay before January 31 earns 5% off, otherwise a Free Lime
  Prepay Bonus.
- Seeing all six program totals side by side is how reps compare and upsell;
  keep them visible together.
- Plain static HTML, CSS, and JavaScript with no dependencies or build step.
  Pricing math lives in `quote-engine.js` and `pricing.js` and is covered by
  `npm test`; the UI must not change it.
- Dark and light mode (follow the device, with a remembered toggle).
  Dropdowns for treatment area, promotion, and draft day.
- Known issues to resolve (audit, September 2026): the copy action falls below
  the fold on a 1366×650 laptop viewport; toasts are unreadable in dark mode;
  form controls under 16px make iPhones zoom on focus; the theme toggle,
  reset, and "view exact payments" controls are under 44px.

## Brand Commitments

The owner explicitly does not require a branded design: Weed Man colors are
optional and the palette is open. Keep the "Weed Man" name and the existing
app icon files.

## Evidence on Hand

- Real 2026 rate table and program definitions in `pricing.js`.
- Sample schedule exports in the local, git-ignored `Test CSVs/` folder.
- No customer data, testimonials, or usage metrics exist; do not invent any.

## Product Principles

1. The price is the answer: the current total is the most prominent thing on
   screen, and it is always correct.
2. Nothing between hearing and quoting: the whole quote fits one laptop
   screen, with no scrolling to reach the copy action.
3. Rules are visible, not memorized: when a choice changes another (prepay
   removing a promotion), the screen says so where it happens.
4. Familiar controls over clever ones: reps use this dozens of times a day.

## Accessibility & Inclusion

WCAG 2.1 AA in both themes: 4.5:1 text contrast, visible keyboard focus,
44px touch targets on touch devices, labels on every control.
