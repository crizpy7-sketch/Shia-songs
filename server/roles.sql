-- OPTIONAL deployment artifact; apply only after approving a dedicated database.
-- Migration owner must create the NOLOGIN group roles below and assign separate
-- API/worker LOGIN identities through the hosting secret manager. No password here.
BEGIN;
CREATE ROLE shia_api NOLOGIN;
CREATE ROLE shia_notifications NOLOGIN;
GRANT USAGE ON SCHEMA shia_intake TO shia_api,shia_notifications;
GRANT USAGE ON SCHEMA shia_payments TO shia_api;
GRANT SELECT,INSERT,UPDATE ON shia_intake.inquiries,shia_intake.notifications TO shia_api;
GRANT SELECT,UPDATE ON shia_intake.notifications TO shia_notifications;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA shia_payments TO shia_api;
CREATE POLICY api_inquiries ON shia_intake.inquiries TO shia_api USING(true) WITH CHECK(true);
CREATE POLICY api_notifications ON shia_intake.notifications TO shia_api USING(true) WITH CHECK(true);
CREATE POLICY worker_notifications ON shia_intake.notifications TO shia_notifications USING(true) WITH CHECK(true);
CREATE POLICY api_orders ON shia_payments.orders TO shia_api USING(true) WITH CHECK(true);
CREATE POLICY api_sessions ON shia_payments.sessions TO shia_api USING(true) WITH CHECK(true);
CREATE POLICY api_events ON shia_payments.events TO shia_api USING(true) WITH CHECK(true);
CREATE POLICY api_fulfillment ON shia_payments.fulfillment_jobs TO shia_api USING(true) WITH CHECK(true);
COMMIT;
-- Do not grant these roles to anon/authenticated or expose either schema to Data API.
