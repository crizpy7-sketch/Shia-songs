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


## Resumed verification — 2026-10-03

- Dedicated executor available; saved commits `6412eac`/`76f5c8a` preserved. Read-only remote comparison: `origin/main` remains `94ffb9cbca780cf1453af04cfe93501ad2459948`; no newer main changes to overwrite.
- `npm run build`: passed. `npm test`: **51 passed, 0 failed**. All five browser suites passed again; the full local intake integration also passed separately after the endpoint update. `git diff --check` and relevant JavaScript syntax checks passed.
- New tests cover malformed credentials/UUIDs/packages/JSON, correcting definitive isolated pre-save validation rejection while retaining uncertain attempts, native pending-navigation protection, blank provider acknowledgements, read-only reviewer RLS/column privileges, configurable HTTPS edge routing without token-bearing URLs, duplicate payment clicks, and stale config-response fencing.
- The Node fallback now has a private terminal reviewer (`npm run inquiries:review -- <UUID> [--files]`). Fake-data tests verify finalized-only access, short-lived file URLs, no mutations and no token-hash access. This does not configure a live operator identity or add a public inquiry endpoint.
- Latest local integration evidence remains 3 submit and 3 finalize requests, exactly 2 saved/finalized local inquiries, 2 mock Stripe sessions and 2 mock accepted alerts in English/Spanish, zero browser errors and zero real external requests. This proves local/mock behavior, not live inquiry persistence, inbox delivery, payment success or fulfillment.
- The parent supplied live connector audit facts; they were reconciled in [the activation route](ACTIVATION_ROUTE.md). The parent's denied live frontend fetch was not retried here. Stripe reconnection is confirmed by the parent; secrets, provider/account readiness, source publication and activation remain separate approvals.
- The Pages/Supabase route requires the audited v1 source and exact SHIA DDL, an edge adaptation and explicit SHIA-only shared-project migration approval. The standalone migrations remain guarded against that shared project. No blind shared migration or edge rewrite was produced.

No live submissions, emails, charges, historical inquiry reads/replay, secret configuration, hosting purchases, provider configuration, pushes, merges or deployments occurred. Automatic tab-restart recovery and a browser-based viewer for the isolated ledger remain unimplemented; the native warning and private CLI reduce the corresponding operational gaps.


The deployed-schema-compatible v2 Edge preparation is now documented in [Edge QA](EDGE_QA.md) and [its activation handoff](EDGE_DEPLOYMENT.md). The earlier source-input blocker has been resolved. This adds local tests and unapplied migrations; it does not activate services.
