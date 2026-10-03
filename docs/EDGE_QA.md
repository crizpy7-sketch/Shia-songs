# Edge adaptation local verification — 2026-10-03

Dedicated branch: `feature/reliable-intake-checkout`, continuing saved commit `2ce1ae0`. Node 24.19.0 and pinned Deno 2.5.2. Source/schema input is the parent's read-only deployed-v1/SHIA catalog audit; no customer rows, secrets, auth records or real inventory data are in the fixture.

## Results

- Build passes; `git diff --check` passes.
- Final `npm test`: **73 passed, 0 failed**. Includes existing customer/design/payment regressions and new Edge transport/RPC/database/admin/security tests.
- All four Deno function entrypoints type-check; **3 Deno tests pass**. They execute the Web-standard HTTP handler and Stripe Web Crypto verification using local signed fixtures, with no network permission/provider calls.
- All **six browser suites pass**: existing responsive/accessibility baseline, motion, vinyl/bilingual questionnaires, hero refinement, standalone intake integration, and the new Pages-path/Edge/RPC integration. External requests are blocked or fulfilled locally. The final Edge integration is also rerun separately after the last backend changes.

New Edge browser evidence: `artifacts/edge-browser-report.json`, `/tmp/shia-edge-en.png`, `/tmp/shia-edge-es.png`. It exercises the repository URL path, configured HTTPS API routing, English $20 and Spanish $50 packages, private-upload role/order/caption handling, deliberately lost submit/finalize responses, fake hosted Stripe redirects, duplicate locally signed paid webhooks, and a secret-authenticated fake notification worker. Three submit requests and three finalize requests produce exactly two existing-schema order rows, two mock sessions, two locally paid ledger rows and four mock accepted alerts (one inquiry and one paid alert each), with zero browser errors and zero real external requests.

Playwright's HTTPS edge URL is intercepted and proxied to the actual local handler; it is not a deployed Supabase gateway. The report records zero browser preflight requests under that interception. Exact-origin preflight handling and foreign/absent-origin rejection are tested explicitly in Node transport tests, not inferred from the intercepted browser run. Hosted gateway/CORS acceptance remains a deployment check.

## Database and security checks

The audited SHIA table shape is created only in disposable PGlite/PostgreSQL fixtures; auth/storage dependencies and `inventory_probe` are synthetic. Local tests apply both named migrations to those fixtures and verify:

- Concurrent submit/finalize and response loss yield one order, capability and inquiry notification; changed payload/manifest conflicts and NULL proofs fail closed.
- Upload-signing outage can resume the same saved request; unsupported HEIF, missing files and foreign paths cannot finalize.
- Outbox failure rolls back order finalization/payment state; paid-outbox failure rolls back the webhook receipt and paid ledger/handoff.
- RPC checkout leases serialize concurrent requests; expired leases fence stale saves/releases. Stripe-success/database-failure retains identical attempt/body/key; an orphan attempt past 23 hours is blocked for reconciliation. A racing paid event prevents another reservation. Canonical stored UUIDs are used for Stripe references even if caller casing changes.
- Provider failure retains a finalized inquiry, stable keys retry, and stale worker acknowledgements cannot finish a newer lease.
- Service-only RPCs deny anon/authenticated callers and direct private-table reads. Existing nonmembers cannot see orders or payment states; members retain their original order update flow and get only verified payment status, never payment hashes or a paid-write route.
- The independent TRUNCATE revocation removes only the confirmed SHIA order privilege. Other SHIA update privileges and synthetic inventory grants/rows remain unchanged. No migration backfills legacy orders, clears their tokens, queues their notifications, changes membership policies or modifies inventory objects.
- V2 does not inherit v1/global sender credentials. Provider/sender configuration remains absent and no email is marked sent merely because configuration is missing.

## Verification limits and actions not performed

These are local/mock tests, not real order saving, inbox delivery, Stripe sandbox/live payment acceptance, production fulfillment or deployed multi-process contention. No Supabase CLI link/push/deploy, database connection to the shared project, live schema/migration execution, historical customer read/replay, mail/SMS, charge, credential creation/configuration, sender/DNS/provider setup, hosting purchase, source push, merge or publication occurred. The parent's denied live frontend fetch was not retried through another route.

Deno development dependencies were downloaded for local type/runtime testing only; no application credentials were used. Package/SDK versions are pinned. The expected production function paths and CORS handling are based on the official [Supabase routing](https://supabase.com/docs/guides/functions/routing), [CORS](https://supabase.com/docs/guides/functions/cors) and [Stripe webhook](https://supabase.com/docs/guides/functions/examples/stripe-webhooks) references.

Sender/Resend account readiness remains unverified. Stripe branding is verified by the parent, but this code deliberately stays test-mode-only. Pending browser attempts still need the same tab; automatic restart recovery is not implemented. See [exact activation sequence and approvals](EDGE_DEPLOYMENT.md).
