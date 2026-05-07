# Phase 02 — Deferred polish items

Running list of fixes encountered during execution that exceeded the 5-min wall-clock budget (CONTEXT.md D-01a) or fell outside a plan's strict scope. Reviewed at phase close per CONTEXT.md `<deferred>` — folded into Phase 8 by default.

---

## Items

- **`src/quiz/QuizModal.tsx:394-400` (SuccessStep green checkmark uses WhatsApp brand colors instead of canonical success indicator)** — Found during plan 02-04. The success-step affirmation circle uses `linear-gradient(135deg, #25D366, #1da350)` plus `boxShadow: '0 20px 60px -10px rgba(37,211,102,0.5)'`. Per UI-SPEC §Color, `#25D366` is reserved for "WhatsApp brand color (dock button only)" while `#36D399` (rgba `54,211,153,X`) is the canonical "Live/success indicator (status only)". Co-editing the gradient (which has a second hand-tuned darker stop `#1da350` with no token equivalent) plus the matching shadow is a visual semantic change beyond a pure token swap and exceeds the 5-min budget. Recommended fix: replace the two-stop WhatsApp-brand gradient with a single canonical `#36D399` background (or pair with a derived darker `--success-deep` token introduced in Phase 8) and swap the shadow rgba accordingly.
