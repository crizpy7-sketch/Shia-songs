-- Read-only operational checks against the approved isolated SHIA database.
-- Counts and opaque IDs only: no customer stories, contacts, photos or capabilities.
SELECT kind,status,count(*) AS jobs,min(created_at) AS oldest
 FROM shia_intake.notifications GROUP BY kind,status ORDER BY kind,status;
SELECT id,order_id,kind,status,attempts,available_at,locked_until,last_error
 FROM shia_intake.notifications
 WHERE status IN ('failed','blocked') OR
       (status='processing' AND locked_until<now()) OR
       (status='pending' AND created_at<now()-interval '5 minutes')
 ORDER BY created_at;
SELECT i.order_id FROM shia_intake.inquiries i
 LEFT JOIN shia_intake.notifications n ON n.order_id=i.order_id AND n.kind='inquiry'
 WHERE i.state='finalized' AND n.id IS NULL;
SELECT o.order_id FROM shia_payments.orders o
 LEFT JOIN shia_payments.fulfillment_jobs f USING(order_id)
 WHERE o.payment_status='paid' AND f.order_id IS NULL;
SELECT status,count(*) AS jobs,min(created_at) AS oldest
 FROM shia_payments.fulfillment_jobs GROUP BY status;
