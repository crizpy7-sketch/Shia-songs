-- Read-only, private owner/authorized operator checks after approved activation.
-- Not a migration; never run under public browser/anon roles.
SELECT kind,status,count(*) AS jobs,min(created_at) AS oldest
FROM shia_edge.notifications GROUP BY kind,status ORDER BY kind,status;
SELECT id,order_id,kind,status,attempts,available_at,locked_until,last_error
FROM shia_edge.notifications
WHERE status IN ('failed','blocked') OR (status='processing' AND locked_until<now()) OR (status='pending' AND created_at<now()-interval '5 minutes')
ORDER BY created_at;
SELECT order_id,reserved_attempt,reserved_at,locked_until
FROM shia_edge.payments
WHERE reserved_attempt IS NOT NULL AND reserved_at<now()-interval '22 hours';
SELECT p.order_id FROM shia_edge.payments p LEFT JOIN shia_edge.fulfillment f USING(order_id)
WHERE p.payment_status='paid' AND f.order_id IS NULL;
SELECT r.order_id FROM shia_edge.requests r LEFT JOIN shia_edge.notifications n ON n.order_id=r.order_id AND n.kind='inquiry'
WHERE r.finalized_at IS NOT NULL AND n.id IS NULL;
-- Cron extensions/vault availability and job history must be separately verified;
-- no inventory, customer payload, token/hash, credential or recipient is selected.
