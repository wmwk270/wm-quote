---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Quote tool (index.html)

Scope: the whole app, one screen. Visitor mode: Operate.
Audience: inside sales reps quoting live on laptop calls.
Task: lawn size in, correct season price out, copied before the call ends.
Constraints: static HTML/CSS/JS, pricing logic untouched, offline, both
themes, dropdowns for area/promotion/draft day, WCAG AA. Owner pinned the
look: sleek, modern, flashy, animated; branding optional.
Memorable moment: the Amount Due total rolling to each new price.

## Direction contract

THESIS: The quote is one numbered work order that fits a laptop screen, with the
price living in its Amount Due panel. It refuses the category default of
stacked input cards and a summary card.

OWN-WORLD: Crisp numbered boxes on a smooth cool surface, hairline rules,
every box headed by the same number-and-label strip. One electric blue for
focus and selection, one teal for money saved. Light and dark share the
grammar. No gradients or decorative tints.

STORY: The rep types the lawn size, watches all six program prices re-roll,
picks one, sets payment and extras, reads the total aloud, copies it.

FIRST VIEWPORT: At 1366x650: slim header; boxes 1 lawn size (largest), 2
applications, 3 area, 4 promotion across the top; 5 programs (six ruled
lines) beside 6 payment; Amount Due panel at right spanning the height with
the monumental rolling total, itemized lines, schedule, and the three copy
actions above the fold.

FORM: Service work order, position 3 of 7; seed 2cfb6d75. Signature
interaction: odometer-rolling digits on every price change, and the prepay
rule stamping over the promotion box. Motion grammar: short vertical rolls
and slides under 400ms, disabled under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
