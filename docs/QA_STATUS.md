# QA status · 2026-10-01

Latest local candidate: `feat/hero-motion-occasion-refresh`, based on main
`d3b1b69d2c5d629c6d5a156431483dd3cd246e6f`. Build and 28 offline checks pass;
final four-suite mocked Chromium regression: all four suites pass (complete command exit 0). See
[HERO_REFINEMENT_QA.md](HERO_REFINEMENT_QA.md) for current executed evidence and
limitations, [HERO_REFINEMENT.md](HERO_REFINEMENT.md) for behavior, and
[OCCASION_PHOTO_CREDITS.json](OCCASION_PHOTO_CREDITS.json) for the twelve verified
new photo mappings. Prior vinyl and motion reports below are retained as history.

## Passed

- Pinned dependency installation and local Supabase browser bundle build
- Syntax checks for the frontend and Node payment server
- 21 automated tests, including:
  - All 12 Spanish wizard flows, required-field validation, progress, opt-in drafts and erase
  - Mocked intake/finalize with ordered photo/caption metadata and disabled checkout
  - Confirmed package selection and removal of obsolete public first-admin setup
  - Default-closed payment config; live-key refusal; no secrets in public config
  - Order-bound capability, package binding, expiry and forged token rejection
  - Server-authoritative Price IDs and refusal of wrong amount/currency/live/recurring/inactive prices
  - Open-session reuse, expired-session new attempt, completed-unpaid retry prevention
  - Stripe-success/database-failure exact idempotency replay
  - Completed-unpaid versus asynchronous-paid webhook gating
  - Forged raw-byte webhook signatures, price-line tampering and live-event rejection
  - Duplicate events and monotonic paid state
  - Real PostgreSQL DDL through PGlite, transaction rollback on outbox failure, unique fulfillment, RLS enablement, and persistence after restart
  - Backend/private-bucket-compatible upload formats, 20-file total, 50 MB/file and empty-file rejection
- Production npm dependency audit: zero reported vulnerabilities at the time checked

## Not yet verified

- Physical-device acceptance and browser engines other than the tested Chromium
- A real Stripe sandbox session and webhook delivery
- A deployed PostgreSQL role/policy/network/backup configuration
- Existing live intake bridge, idempotent finalize/resume, and actual fulfillment worker
- Production behavior or live payment processing

## Local browser verification update

Chromium now runs in the existing cloud environment without a permissions change. The local feature branch fixes the lazy-image test and contained radio-label hit targets, and adds original native motion. See [LOCAL_MOTION_QA.md](LOCAL_MOTION_QA.md) for current browser results and screenshot evidence. The earlier process-socket blocker does not apply to this instance.

`npm run test:browser` runs `tests/browser.mjs` and `tests/motion-browser.mjs` against temporary local servers. All external requests are mocked or blocked. It checks 1440, 768, 390, and 320-pixel layouts, visible lazy-image loading, all 12 forms, mocked submission/finalization, photo controls, keyboard access, axe accessibility, once-only motion, initial/dynamic reduced motion, and unavailable-API/module and JavaScript-disabled fallbacks. Production gates remain unchanged.

## Safe visual preview

`npm run build:preview` creates `artifacts/static-preview/`. This copy initializes no Supabase client and blocks intake, uploads, admin login, and payments. It needs only static hosting for visual QA. No site/account/deployment is created by that command.
