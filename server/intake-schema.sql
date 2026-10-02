-- Apply only to a dedicated, approved SHIA database; never SRL INVENTORY.
BEGIN;
CREATE SCHEMA IF NOT EXISTS shia_intake;
REVOKE ALL ON SCHEMA shia_intake FROM PUBLIC;
CREATE TABLE IF NOT EXISTS shia_intake.inquiries (
 order_id uuid PRIMARY KEY,
 request_hash text UNIQUE NOT NULL,
 payload_hash text NOT NULL,
 payload jsonb NOT NULL,
 package_key text NOT NULL CHECK(package_key IN ('songs','slideshow')),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','finalized')),
 manifest jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 finalized_at timestamptz
);
CREATE TABLE IF NOT EXISTS shia_intake.notifications (
 id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES shia_intake.inquiries(order_id),
 kind text NOT NULL CHECK(kind IN ('inquiry','paid')),
 UNIQUE(order_id,kind),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','blocked')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,
 locked_until timestamptz,
 last_error text,
 provider_id text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_due ON shia_intake.notifications(available_at) WHERE status NOT IN ('sent','blocked');
ALTER TABLE shia_intake.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_intake.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA shia_intake FROM PUBLIC;
COMMIT;
