# CPATS System — UI/UX Polish Status

## Current project direction

The CPATS procurement pipeline is **functional and is the source of truth**. Current and future work in this project is limited to improving the user experience and visual quality of the existing system.

For additive features requested by Ma'am Grace or other project proponents, also read [`FEATURE_IMPLEMENTATION.md`](./FEATURE_IMPLEMENTATION.md). It defines the safe feature-development boundary around the fixed pipeline.

## Implemented additive features

- Purchasing Office monthly transaction reports with CSV export
- Purchasing Office order tracking from PO preparation through receiving
- Responsive behavior checked at phone, tablet, and desktop widths
- Seeded institutional role accounts with independently hashed passwords
- In-app workflow notifications for Business, Admin, Purchasing, Receiving, and Audit roles
- Recoverable notification trash with 1-week, 2-week, or 2-month retention and explicit permanent deletion
- Optional verified external email delivery, backed by a durable email outbox
- Returned requisition correction and resubmission with saved inputs, evaluator feedback, ownership checks, and preserved audit history
- Returned-request correction mode can be discarded from the form or the New Request navigation tab to restore a clean request template
- Declined requests can seed a new requisition with their saved inputs and decision note; refreshing a populated request form restores the blank New Request page

## Notification email deployment

Local development uses `EMAIL_DELIVERY_MODE=log`, which displays verification and workflow messages in the server log without sending mail externally. For a deployed installation, configure:

- `EMAIL_DELIVERY_MODE=smtp`
- `EMAIL_VERIFICATION_SECRET` with a long random value
- `APP_BASE_URL` with the public HTTPS address of CPATS
- `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE`
- `SMTP_USER` and `SMTP_PASSWORD` (for Gmail, use a dedicated sender account with an app password rather than a personal Gmail password)
- `SMTP_FROM` with the institutional sender name and address

Each staff member links only the address where they want alerts delivered. CPATS never asks for or stores that person's Gmail password.

## Non-negotiable: preserve the procurement pipeline

Do **not** modify the procurement workflow, its order, or its business rules unless the user explicitly requests a pipeline change in the current task.

This includes preserving the existing progression between offices, including (but not limited to):

- Requesting Office
- Business Office
- Administrator / approval stages
- Purchase Order preparation and release
- Finance, purchasing, receiving, tracking, and audit stages

Do not change status names, allowed transitions, eligibility checks, routing, role permissions, approval requirements, or the server-side authority that enforces them.

## Safe scope for current work

Prioritize improvements such as:

- Responsive layouts for desktop and mobile
- Clearer error, success, empty, loading, and stale-record feedback
- Accessible dialogs, previews, tooltips, and confirmation surfaces
- Attachment and image-preview experiences
- Consistent spacing, typography, colors, buttons, cards, and navigation
- Replacing raw emojis or generic icons with accessible local inline SVG icons
- Rendering and scrolling performance improvements that do not alter business behavior

## Guardrails for implementation

When polishing a page:

1. Keep API endpoints, request payloads, schemas, Prisma models, role checks, status values, and transition logic unchanged.
2. Treat server responses as authoritative. UI feedback may explain a rejected action, but must not bypass or recreate server-side workflow decisions.
3. Prefer local, isolated presentation-state changes (for example, modal visibility, preview state, and visual components).
4. Preserve existing functional behavior unless a user explicitly asks to change it.
5. Validate UI changes with TypeScript and a production build when practical.

## Icon standard

For cosmetic icon updates, use local or imported SVG functional components rather than raw emoji or generic demonstration icons:

- `viewBox=\"0 0 24 24\"`
- `fill=\"none\"`
- `stroke=\"currentColor\"`
- `strokeWidth=\"1.8\"` or `\"2\"`
- `className=\"size-4 shrink-0\"` (or `size-3.5` where appropriate)
- `aria-hidden=\"true\"`
- Wrap an icon and its visible text with `inline-flex items-center gap-1.5`.

## Instructions for future agents

Before editing, read this file and [`FEATURE_IMPLEMENTATION.md`](./FEATURE_IMPLEMENTATION.md). If a requested change could affect the procurement pipeline, stop and ask the user for explicit approval before changing business logic.
