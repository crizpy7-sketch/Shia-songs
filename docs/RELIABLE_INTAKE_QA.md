# Reliable intake local verification

Verified 2026-10-02 in the dedicated environment, Node 24.19.0. Base commit: `94ffb9cbca780cf1453af04cfe93501ad2459948`.

- `npm run build`: passed; pinned browser bundle preserved.
- `npm test`: **42 passed, 0 failed**.
- `node tests/intake-browser.mjs`: passed against actual local Node API and embedded PostgreSQL with fake upload/Stripe/notification providers, in English and Spanish. Intentionally lost submit and finalize responses recovered; 3 submit requests and 3 finalize requests produced exactly 2 finalized inquiries, 2 fake sessions and 2 fake alerts. No browser errors or real external requests. Generated evidence: `artifacts/intake-browser-report.json`, `/tmp/shia-intake-en.png`, `/tmp/shia-intake-es.png`.
- PostgreSQL tests cover transaction rollback when inquiry/paid notification enqueue or payment provisioning fails, restart durability, duplicate/concurrent submit/finalize, stable capability return, exact file manifests, notification retry and ambiguous acknowledgement, finite lease recovery/fencing, and provider idempotency-window expiry.
- `server/roles.sql` was applied only inside the embedded test database. API role can submit/finalize; notification role can claim/ack its queue and is denied customer inquiry/payment ledger access.
- All four existing browser suites passed: responsive/accessibility baseline, motion, vinyl/bilingual questionnaires and hero refinement. They block/mock external requests. Reports are generated under `artifacts/`: `browser-report.json`, `motion-browser-report.json`, `vinyl-bilingual-report.json`, and `hero-refinement-report.json`.
- `git diff --check` and syntax checks passed.

No live inquiries, shared Supabase project, credentials, accounts, email, SMS, charges, tax settings, refunds, Stripe products, infrastructure, pushes/PRs or deployments were touched. Container build, real provider delivery, multi-process deployed PostgreSQL contention and hosted operational monitoring are not verified here.

See [implementation, recovery limits and activation gates](RELIABLE_INTAKE.md). In particular, same-page retries are supported; automatic pending-attempt recovery after a browser restart and a private operator viewer for the isolated ledger are not implemented.

Recipient handoff updated after the user selected `crizpy7@gmail.com` on 2026-10-02 at 15:59 UTC. Only the configuration example and documentation changed; provider, sender and credentials remain unset. No delivery test or external activation was performed.
