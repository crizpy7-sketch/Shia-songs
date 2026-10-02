# SHIA SONGS

English-default custom-song intake with a Spanish toggle and private administration.

The current local update adds finite layered hero motion with pause/resume,
a higher occasion selector, larger hover/hold SVG controls, and twelve distinct
licensed Pexels photos. The original vinyl carousel and English/Spanish flow
preserve answers, photos and drafts. See [implementation](docs/HERO_REFINEMENT.md),
[verification](docs/HERO_REFINEMENT_QA.md) and [photo credits](docs/OCCASION_PHOTO_CREDITS.json).

## What changed

- An editorial, music-focused landing page with genuine licensed people photography served locally
- All 12 original occasion-specific questionnaires, private upload integration, and member-only administration retained
- Confirmed pricing: **$20 USD** for two personalized songs and their lyrics; **$50 USD** for both songs and lyrics plus one customer-photo slideshow using one of the songs
- No invented testimonials, customer counts, turnaround times, revision rights, refunds, or sample audio
- No emoji artwork, external font dependency, or client-side Stripe secret
- Upload UI now matches the existing backend and private bucket: 20 total files, 50 MB each, JPG/PNG/WebP/HEIC and MP4/MOV only
- Local draft persistence is opt-in, with a clear erase control
- Public first-admin signup/claim onboarding removed because the existing project already has an owner
- A sandbox-only Stripe Checkout backend scaffold with server-owned prices, order-bound payment access, signature-verified webhooks, durable event receipts, and a fulfillment outbox

## Local preview

Requires Node 24 or newer.

```sh
npm ci
npm run build
npm run dev
```

Visit the URL printed by the server. **Checkout stays disabled** with the supplied blank `.env.example`. The standard frontend still points to the existing intake service, so never submit QA data there.

For a safe visual-only preview:

```sh
npm run build:preview
```

Serve `artifacts/static-preview/` from any ordinary static server. This copy initializes no Supabase client and refuses order submission, uploads, admin login, and payments. It is intended for layout/browser review, not production. No Site is created or deployed by this command.

## Tests

```sh
npm test
npm run test:browser
```

`npm test` covers checkout, reliable intake and notification retries. It uses mocked Stripe/intake clients, isolated JSDOM, and an embedded PostgreSQL engine for schema and transaction verification, plus translation and state-preservation regression coverage. It makes no live Stripe calls and creates no real Supabase orders.

`test:browser` uses the installed Chromium executable (`/usr/bin/chromium`) and blocks/mocks all external requests. Its four suites check responsive layout, all 12 forms in both customer languages, mocked intake, answer/draft/photo preservation, native touch carousel scrolling, keyboard/SVG controls, accessibility scans, reduced motion, and progressive fallbacks. See [current verification](docs/HERO_REFINEMENT_QA.md) for current results, genuine screenshots and a short motion recording; these checks do not exercise live intake or payments.

## Deployment shape

The existing GitHub Pages setup can serve `index.html`, `assets/`, `credits.html`, and `payment-status.html`. It cannot execute the payment backend. To activate Stripe, serve the frontend and Node API from the same trusted HTTPS origin, or deliberately implement a reviewed reverse proxy; no open CORS workaround is provided.

Read [the Stripe activation plan](docs/STRIPE_ACTIVATION.md) before enabling any payment route. Live keys are deliberately refused by this scaffold. Production activation is a separate approved change.

## Verification boundaries

- Build, offline unit/database tests and browser checks are documented with their current results in [reliable-intake notes](docs/RELIABLE_INTAKE.md)
- Actual PostgreSQL DDL, atomic payment/outbox rollback, event deduplication, and restart durability pass in PGlite
- No production database migrations, schema changes, account setup, key creation, Stripe products/prices, payments, emails, push, merge, or deployment were performed
- Real Stripe sandbox checkout/webhook delivery, a deployed PostgreSQL role/policy setup, the live intake bridge, production fulfillment, and real-device acceptance remain activation gates
- The existing live intake remains unchanged. The new opt-in isolated Node intake implements idempotent submit/finalize and transactional inquiry/paid notification queues. It requires separately approved hosting, database/storage, recipient/sender, private operator access and activation; see [implementation and operations](docs/RELIABLE_INTAKE.md). Pending browser attempts survive same-page retries; automatic tab-restart recovery is not implemented.

Photo sources and licenses are recorded in [PHOTO_CREDITS.md](docs/PHOTO_CREDITS.md) and on the visible credits page.
