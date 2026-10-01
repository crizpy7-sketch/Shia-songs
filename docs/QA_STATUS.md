# QA status · 2026-10-01

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

- Desktop/mobile screenshot/layout review, actual browser interactivity, keyboard navigation, browser image loading and axe scans
- A real Stripe sandbox session and webhook delivery
- A deployed PostgreSQL role/policy/network/backup configuration
- Existing live intake bridge, idempotent finalize/resume, and actual fulfillment worker
- Production behavior or live payment processing

## Browser environment blocker

The installed Chromium exits because the environment refuses its required process socket. A scoped escalation was attempted and did not change that restriction. The managed cloud browser rejects the local preview URL with `ERR_BLOCKED_BY_CLIENT`. The available Sites profile is portable with no supported local forwarding tool. No unsupported bypass, public deployment, or fabricated screenshots were used.

`tests/browser.mjs` is included for a supported browser environment. It intends to check 1440, 768, 390, and 320-pixel viewports, screenshots, image loading, no horizontal overflow, all 12 templates, mocked submission, admin sign-in surface, browser errors, and axe accessibility. It has not reached execution in the current environment.

## Safe visual preview

`npm run build:preview` creates `artifacts/static-preview/`. This copy initializes no Supabase client and blocks intake, uploads, admin login, and payments. It needs only static hosting for visual QA. No site/account/deployment is created by that command.
