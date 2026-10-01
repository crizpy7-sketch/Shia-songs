# SHIA SONGS · Project status

**Stage:** draft implementation for review. **Stripe:** disabled. **Production:** unchanged.

## Ready to review

- [x] Spanish homepage, music-first art direction and genuine licensed people photography
- [x] Original 12 occasion questionnaires and private intake/admin integration retained
- [x] $20 USD: two personalized songs and their lyrics
- [x] $50 USD: both songs and lyrics plus one customer-photo slideshow using one song
- [x] Correct file formats, 20-file total and 50 MB/file limits
- [x] Optional saved drafts and erase control
- [x] Sandbox-only Checkout endpoint and order-bound access
- [x] Signature-verified webhook, durable event receipts and unique fulfillment outbox
- [x] 21 offline tests pass; production dependency audit reports zero vulnerabilities

## Before a visual approval

- [ ] Open the safe static preview in a supported browser environment
- [ ] Check desktop, tablet, 390 px and 320 px layouts and image crops
- [ ] Run the included browser interaction, keyboard and axe accessibility checks

Browser QA is currently blocked by the cloud execution environment. The safe preview initializes no live Supabase client and blocks submissions, uploads, admin login and payments. See [QA status](docs/QA_STATUS.md).

## Before accepting payments

- [ ] Agree delivery timing/method, revisions, refunds and song-use/commercial terms
- [ ] Review applicable tax treatment
- [ ] Configure approved sandbox restricted key, Price IDs and webhook signing secret securely
- [ ] Set up a reviewed, isolated durable database and backend-only access
- [ ] Add trusted idempotent intake/finalize bridge and checkout capability return
- [ ] Implement and test the idempotent fulfillment worker and reconciliation
- [ ] Complete real Stripe sandbox and browser QA
- [ ] Separately approve any live activation and production deployment

The current code rejects live Stripe keys, sessions and events. See [Stripe activation checklist](docs/STRIPE_ACTIVATION.md) for the precise setup contract.

## Where to work

Use this draft pull request as the review hub. The feature branch keeps this work separate from the production main branch. [README](README.md) explains local setup, safe preview and tests. [Photo credits](docs/PHOTO_CREDITS.md) records image provenance and reuse limits.
