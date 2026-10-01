-- REVIEW AND APPLY ONLY TO AN APPROVED LOCAL / ISOLATED PAYMENT DATABASE.
-- No dependency on, mutation of, or grant in the existing live Supabase project.
BEGIN;
CREATE SCHEMA IF NOT EXISTS shia_payments;
REVOKE ALL ON SCHEMA shia_payments FROM PUBLIC;
CREATE TABLE IF NOT EXISTS shia_payments.orders (
 order_id uuid PRIMARY KEY,
 package_key text NOT NULL CHECK(package_key IN ('songs','slideshow')),
 token_hash text NOT NULL CHECK(length(token_hash)=64),
 token_expires_at timestamptz NOT NULL,
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','expired')),
 checkout_session_id text,
 checkout_attempt integer NOT NULL DEFAULT 0,
 integration_identifier text,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shia_payments.sessions (
 session_id text PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES shia_payments.orders(order_id),
 package_key text NOT NULL CHECK(package_key IN ('songs','slideshow')),
 price_id text NOT NULL,
 amount integer NOT NULL CHECK(amount IN (2000,5000)),
 currency text NOT NULL CHECK(currency='usd'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shia_payments.events (
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 session_id text NOT NULL REFERENCES shia_payments.sessions(session_id),
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shia_payments.fulfillment_jobs (
 order_id uuid PRIMARY KEY REFERENCES shia_payments.orders(order_id),
 session_id text NOT NULL REFERENCES shia_payments.sessions(session_id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','failed')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_until timestamptz,
 last_error text,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fulfillment_pending ON shia_payments.fulfillment_jobs(available_at) WHERE status IN ('pending','failed');
REVOKE ALL ON ALL TABLES IN SCHEMA shia_payments FROM PUBLIC;
ALTER TABLE shia_payments.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_payments.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_payments.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_payments.fulfillment_jobs ENABLE ROW LEVEL SECURITY;
-- Default deny for non-owner roles. The deployer must review and grant a dedicated
-- backend-only role the narrowly scoped table privileges + matching RLS policies.
-- Never grant this schema to Supabase anon/authenticated roles or expose it to the Data API.
COMMIT;
