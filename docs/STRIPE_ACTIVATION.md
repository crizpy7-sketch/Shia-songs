# Stripe activation and trusted fulfillment contract

See [the local reliable-intake implementation and deployment gates](RELIABLE_INTAKE.md). The standalone intake, notification retry worker, paid alert outbox, migrations and container artifact are now implemented locally. The live shared intake remains unchanged.

## Current status

This is a **sandbox-only scaffold**, disabled by default. It cannot create live sessions, accept live webhook events, or transact with live keys. No credentials, accounts, grants, products, prices, endpoints, or migrations were created remotely.

SDK: Stripe Node `23.0.0`, pinned in the lockfile. API version: `2026-09-30.endive`, verified from that SDK's shipped API version. Webhooks must use the same version and a real signing secret for the intended sandbox.

## Server-owned catalog

| Key | One-time price | Inclusions |
| --- | --- | --- |
| songs | 2,000 cents USD | Two personalized songs and their lyrics |
| slideshow | 5,000 cents USD | Both songs and lyrics plus one customer-photo slideshow using one song |

Only these keys are accepted. The browser cannot choose a Price ID, amount, currency, quantity, or payment mode. Configured Stripe Price IDs must be active, test/sandbox, `one_time`, and match the package's amount/currency. No automatic tax, promotion codes, paid upgrades, subscription, card-saving, or explicit payment-method allowlist is enabled.

The creator has not specified turnaround, revisions, refunds, copyright/commercial-use scope, delivery method, which party chooses the slideshow song, or timing for that choice. Agree these terms before launch instead of inventing promises. Review tax treatment and configure the approved commercial-terms URL in both the application and Stripe Dashboard. Checkout requires Stripe's terms-of-service consent. Verify the Dashboard link equals the approved URL.

## Required activation gates

1. Approve the missing commercial/service terms and tax treatment
2. Approve and provision a separate Stripe sandbox, minimal restricted API key, the two package Price IDs, and webhook endpoint through a secure setup flow. This implementation does not create persistent access
3. Choose an approved durable PostgreSQL database. Prefer isolation from the shared existing Supabase inventory project. Review `server/schema.sql`, `server/intake-schema.sql`, and `server/roles.sql` and provision a backend-only least-privilege role with matching RLS policies. The private schema is never exposed to public clients or Supabase's Data API
4. Deploy and validate the isolated idempotent intake/checkout handoff (or separately adapt the trusted bridge below); resolve private operator access to its ledger
5. Deploy the implemented notification worker and operational checks; implement the production fulfillment worker and reconciliation below; do not confuse an enqueued job with a delivered song
6. Complete real sandbox tests, duplicate/concurrent webhook delivery, delayed-payment success/failure, expired/cancelled sessions, persistence/backup/restart, and browser/accessibility checks
7. Only then set explicit gate variables in the runtime secret manager. Live activation needs a separate reviewed change, since this code intentionally rejects live keys/events

Use a platform secrets vault where available. Use sensitive runtime environment values only where the platform lacks a vault. Never commit an `.env`, put credentials in the browser, log them, or paste them into chat.

## Trusted intake bridge

The existing public intake returns a submission token that is consumed at finalize. It is **not** a valid checkout credential and must not be reused or replaced by an unverified public order ID.

After a successful durable finalize, the trusted intake server can call:

```
POST /internal/payment-orders
X-Shia-Intake-Secret: <server-only bridge secret>
Content-Type: application/json

{"orderId":"<finalized order UUID>","packageKey":"songs or slideshow"}
```

This endpoint must be private/network-restricted as well as secret-authenticated. The intake, not the browser, establishes that the order exists and is finalized. The package must be persisted with the order and validated against the approved two-key allowlist. The bridge transmits only the opaque order UUID and package key, not photos, stories, emails, family details, or credentials from the user.

The bridge returns `paymentToken`, a deterministic opaque capability. Store/return it idempotently with the finalized order, as `payment_token` in the intake finalize response. Never place it in URLs, analytics, logs, emails, or public order records. The payment DB stores only its SHA-256 hash and a 30-day expiry. An attacker with only an order UUID cannot start checkout.

The frontend already consumes `final.payment_token`. Without it, the payment button stays disabled even if the payment server is otherwise configured.

The integration must make the original `submit` and `finalize` resumable/idempotent. Preserve upload role/order/caption metadata and make failed notification sending independent of the durable finalize result. Ensure retries return the same payment capability. Do not deploy this contract spec blindly to the shared Supabase project.

## Checkout lifecycle

`POST /api/checkout` requires the trusted exact Origin, a bounded JSON body, rate limit, matching order-bound capability, and package equality. Tokens are never sent to Stripe. The DB row is locked while finding/reusing an existing open session or creating a new attempt.

Stripe receives the server Price ID, quantity one, opaque order UUID, package metadata, one-time mode, fixed-origin return URLs, required TOS consent, and a stable integration identifier. A stable idempotency key covers the exact order/package/attempt. The random-letter label is deterministically derived from the server secret so Stripe-success/DB-failure retries retain identical parameters. A completed session cannot be replaced while its payment awaits confirmation. An expired session may get a new durable attempt. A paid order cannot start another session.

The in-process rate limiter is a local scaffold. Production also needs a trusted proxy/edge distributed rate limit, request-body limits, TLS, same-origin routing, webhook monitoring, and appropriate Stripe IP allowlisting where supported.

## Required webhook path

`POST /api/stripe-webhook` consumes **raw bytes** and verifies `Stripe-Signature` with the signing secret before processing. It handles:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

It retrieves current session state from Stripe and compares the opaque order reference, metadata, currency, total, line-item Price ID, quantity, and saved session contract. Unknown sessions are ignored. Live sessions/events are refused. Only a complete session with `payment_status === "paid"` from a completed/success event marks an order paid.

Within one DB transaction, it records the unique event ID, updates the payment state, and inserts a fulfillment job unique to the order. Duplicate events and repeated success events therefore cannot duplicate fulfillment. A stale failed/expired event cannot overwrite paid state. Failed/expired events for an old session cannot overwrite a newer active checkout state. DB errors return 500 so Stripe retries; the paid state and event receipt do not commit without the outbox job.

## Durable fulfillment worker contract

The scaffold queues jobs; it **does not deliver songs, start production, send email, or mutate the live intake order**. A reviewed worker must:

1. Claim a due pending/failed job in a transaction using `FOR UPDATE SKIP LOCKED`; increment attempts, set `processing`, and assign a finite lease
2. Resolve the existing finalized intake order through authorized server-only access; confirm the paid order/package and intended workflow
3. Perform the approved fulfillment handoff with `order_id` as a persistent idempotency key. Do not use only an in-memory flag, and do not mark the song delivered merely because payment succeeded
4. Commit `done`/`completed_at` only after the downstream action succeeds; failures get a sanitized `last_error` and bounded retry delay
5. Recover expired processing leases, alert on repeated failures, and reconcile paid Stripe sessions against the durable ledger/outbox

A worker restart or duplicate delivery must never create a second paid production task or resend a consequential notification. This worker and its permissions are required before enabling checkout.

## Return page

`payment-status.html` is informational. It never marks an order paid or calls fulfillment. Visiting it directly cannot change payment state. It avoids including a session ID or bearer capability in its URL.

## Primary references

- [Checkout fulfillment and delayed payments](https://docs.stripe.com/checkout/fulfillment)
- [Webhook signature verification](https://docs.stripe.com/webhooks)
- [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create)
- [Restricted API keys and safe storage](https://docs.stripe.com/keys-best-practices)
- [Separate Stripe sandboxes](https://docs.stripe.com/sandboxes)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private Storage](https://supabase.com/docs/guides/storage/security/access-control)
