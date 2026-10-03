-- REVIEW ONLY: additive SHIA v2 state/RPCs. No inventory objects, backfill or replay.
-- Apply only after explicit shared-project migration approval.
BEGIN;
CREATE SCHEMA shia_edge;
REVOKE ALL ON SCHEMA shia_edge FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE shia_edge.requests (
 order_id uuid PRIMARY KEY REFERENCES public.shia_song_orders(id),
 request_hash text UNIQUE NOT NULL CHECK(length(request_hash)=64),
 payload_hash text NOT NULL CHECK(length(payload_hash)=64),
 token_hash text NOT NULL CHECK(length(token_hash)=64),
 package_key text NOT NULL CHECK(package_key IN ('songs','slideshow')),
 files jsonb NOT NULL CHECK(jsonb_typeof(files)='array' AND jsonb_array_length(files)<=20),
 finalized_at timestamptz,
 manifest jsonb,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days'
);
CREATE TABLE shia_edge.payments (
 order_id uuid PRIMARY KEY REFERENCES shia_edge.requests(order_id),
 package_key text NOT NULL CHECK(package_key IN ('songs','slideshow')),
 token_hash text NOT NULL CHECK(length(token_hash)=64),
 token_expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','expired')),
 paid_at timestamptz,
 checkout_session_id text,
 checkout_attempt integer NOT NULL DEFAULT 0,
 lease_id uuid,
 locked_until timestamptz,
 reserved_attempt integer,
 reserved_at timestamptz,
 reserved_hash text
);
CREATE TABLE shia_edge.sessions (
 session_id text PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES shia_edge.payments(order_id),
 package_key text NOT NULL CHECK(package_key IN ('songs','slideshow')),
 price_id text NOT NULL,
 amount integer NOT NULL,
 currency text NOT NULL CHECK(currency='usd'),
 CHECK((package_key='songs' AND amount=2000) OR (package_key='slideshow' AND amount=5000))
);
CREATE TABLE shia_edge.events (
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 session_id text NOT NULL REFERENCES shia_edge.sessions(session_id),
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shia_edge.fulfillment (
 order_id uuid PRIMARY KEY REFERENCES shia_edge.payments(order_id),
 session_id text NOT NULL REFERENCES shia_edge.sessions(session_id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shia_edge.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES shia_edge.requests(order_id),
 kind text NOT NULL CHECK(kind IN ('inquiry','paid')),
 UNIQUE(order_id,kind),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','blocked')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_until timestamptz,
 lease_id uuid,
 last_error text,
 provider_id text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shia_edge_notification_due ON shia_edge.notifications(available_at) WHERE status NOT IN ('sent','blocked');
CREATE TABLE shia_edge.rate_limits (
 scope text PRIMARY KEY CHECK(scope IN ('intake','checkout')),
 window_start timestamptz NOT NULL,
 requests integer NOT NULL
);
ALTER TABLE shia_edge.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_edge.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_edge.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_edge.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_edge.fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_edge.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shia_edge.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA shia_edge FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.shia_edge_submit(p_request_hash text,p_payload_hash text,p_order_id uuid,p_token_hash text,p_order jsonb,p_files jsonb,p_package_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.requests; n bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_hash,0));
 SELECT * INTO r FROM shia_edge.requests WHERE request_hash=p_request_hash FOR UPDATE;
 IF FOUND THEN
  IF r.payload_hash IS DISTINCT FROM p_payload_hash THEN RAISE EXCEPTION 'shia_conflict'; END IF;
  SELECT order_number INTO n FROM public.shia_song_orders WHERE id=r.order_id;
  RETURN jsonb_build_object('order_id',r.order_id,'order_number',n,'files',r.files,'package_key',r.package_key);
 END IF;
 INSERT INTO public.shia_song_orders(id,order_type,title,source,customer_name,customer_email,customer_phone,event_date,couple_names,anniversary_date,years_married,language,music_style,emotion,answers,file_manifest,submission_token_hash)
 VALUES(p_order_id,p_order->>'order_type',p_order->>'title','website',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',nullif(p_order->>'event_date','')::date,nullif(p_order->>'couple_names',''),nullif(p_order->>'anniversary_date','')::date,nullif(p_order->>'years_married','')::integer,nullif(p_order->>'language',''),nullif(p_order->>'music_style',''),nullif(p_order->>'emotion',''),p_order->'answers','[]',NULL)
 RETURNING order_number INTO n;
 INSERT INTO shia_edge.requests(order_id,request_hash,payload_hash,token_hash,package_key,files)
 VALUES(p_order_id,p_request_hash,p_payload_hash,p_token_hash,p_package_key,p_files);
 RETURN jsonb_build_object('order_id',p_order_id,'order_number',n,'files',p_files,'package_key',p_package_key);
END $$;

CREATE FUNCTION public.shia_edge_request(p_order_id uuid,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.requests;
BEGIN
 SELECT * INTO r FROM shia_edge.requests WHERE order_id=p_order_id AND token_hash=p_token_hash AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'shia_forbidden'; END IF;
 RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.shia_edge_finalize(p_order_id uuid,p_token_hash text,p_manifest jsonb,p_payment_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.requests; n bigint; i integer; m jsonb; f jsonb;
BEGIN
 SELECT * INTO r FROM shia_edge.requests WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR r.token_hash IS DISTINCT FROM p_token_hash OR r.expires_at<=now() THEN RAISE EXCEPTION 'shia_forbidden'; END IF;
 IF jsonb_typeof(p_manifest)<>'array' OR jsonb_array_length(p_manifest)<>jsonb_array_length(r.files) THEN RAISE EXCEPTION 'shia_invalid'; END IF;
 FOR i IN 0..jsonb_array_length(r.files)-1 LOOP
  m:=p_manifest->i; f:=r.files->i;
  IF m->>'path' IS DISTINCT FROM f->>'path' OR m->>'name' IS DISTINCT FROM f->>'name' OR m->>'type' IS DISTINCT FROM f->>'type' OR m->'size' IS DISTINCT FROM f->'size'
   OR coalesce(m->>'role','') NOT IN ('slideshow','referencia') OR jsonb_typeof(m->'caption') IS DISTINCT FROM 'string' OR length(m->>'caption')>2000
   OR (m->>'role'='slideshow' AND (f->>'type' NOT LIKE 'image/%' OR m->'order' IS DISTINCT FROM to_jsonb(i+1)))
   OR (m->>'role'='referencia' AND m->'order' IS DISTINCT FROM 'null'::jsonb) THEN RAISE EXCEPTION 'shia_invalid'; END IF;
 END LOOP;
 IF r.finalized_at IS NOT NULL AND r.manifest IS DISTINCT FROM p_manifest THEN RAISE EXCEPTION 'shia_conflict'; END IF;
 IF r.finalized_at IS NULL THEN
  UPDATE public.shia_song_orders SET file_manifest=p_manifest WHERE id=p_order_id;
  UPDATE shia_edge.requests SET finalized_at=now(),manifest=p_manifest WHERE order_id=p_order_id;
  INSERT INTO shia_edge.notifications(order_id,kind) VALUES(p_order_id,'inquiry') ON CONFLICT(order_id,kind) DO NOTHING;
 END IF;
 IF p_payment_hash IS NOT NULL THEN
  INSERT INTO shia_edge.payments(order_id,package_key,token_hash) VALUES(p_order_id,r.package_key,p_payment_hash)
  ON CONFLICT(order_id) DO UPDATE SET order_id=EXCLUDED.order_id
  WHERE shia_edge.payments.token_hash=EXCLUDED.token_hash AND shia_edge.payments.package_key=EXCLUDED.package_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'shia_conflict'; END IF;
 END IF;
 SELECT order_number INTO n FROM public.shia_song_orders WHERE id=p_order_id;
 RETURN jsonb_build_object('order_id',p_order_id,'order_number',n,'package_key',r.package_key,'notification_status','queued');
END $$;

CREATE FUNCTION public.shia_edge_payment_claim(p_order_id uuid,p_token_hash text,p_package_key text,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.payments;
BEGIN
 SELECT * INTO r FROM shia_edge.payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR r.token_hash IS DISTINCT FROM p_token_hash OR r.package_key IS DISTINCT FROM p_package_key OR r.token_expires_at<=now() THEN RAISE EXCEPTION 'shia_forbidden'; END IF;
 IF r.payment_status='paid' THEN RAISE EXCEPTION 'shia_paid'; END IF;
 IF r.locked_until>now() THEN RAISE EXCEPTION 'shia_busy'; END IF;
 UPDATE shia_edge.payments SET lease_id=p_lease_id,locked_until=now()+interval '2 minutes' WHERE order_id=p_order_id;
 RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.shia_edge_payment_reserve(p_order_id uuid,p_lease_id uuid,p_attempt integer,p_request_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.payments;
BEGIN
 SELECT * INTO r FROM shia_edge.payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR r.lease_id IS DISTINCT FROM p_lease_id OR r.locked_until<=now() THEN RAISE EXCEPTION 'shia_busy'; END IF;
 IF r.payment_status='paid' THEN RAISE EXCEPTION 'shia_paid'; END IF;
 IF p_attempt IS DISTINCT FROM r.checkout_attempt+1 THEN RAISE EXCEPTION 'shia_conflict'; END IF;
 IF r.reserved_attempt IS NOT NULL THEN
  IF r.reserved_attempt IS DISTINCT FROM p_attempt OR r.reserved_hash IS DISTINCT FROM p_request_hash THEN RAISE EXCEPTION 'shia_conflict'; END IF;
  IF r.reserved_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'shia_reconcile'; END IF;
 ELSE
  UPDATE shia_edge.payments SET reserved_attempt=p_attempt,reserved_at=now(),reserved_hash=p_request_hash WHERE order_id=p_order_id;
 END IF;
END $$;

CREATE FUNCTION public.shia_edge_payment_save(p_order_id uuid,p_lease_id uuid,p_session_id text,p_attempt integer,p_price_id text,p_amount integer,p_currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.payments;
BEGIN
 SELECT * INTO r FROM shia_edge.payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR r.lease_id IS DISTINCT FROM p_lease_id OR r.locked_until<=now() THEN RAISE EXCEPTION 'shia_busy'; END IF;
 IF r.payment_status='paid' THEN RAISE EXCEPTION 'shia_paid'; END IF;
 IF r.reserved_attempt IS DISTINCT FROM p_attempt THEN RAISE EXCEPTION 'shia_conflict'; END IF;
 INSERT INTO shia_edge.sessions(session_id,order_id,package_key,price_id,amount,currency) VALUES(p_session_id,p_order_id,r.package_key,p_price_id,p_amount,p_currency);
 UPDATE shia_edge.payments SET checkout_session_id=p_session_id,checkout_attempt=p_attempt,reserved_attempt=NULL,reserved_at=NULL,reserved_hash=NULL WHERE order_id=p_order_id;
END $$;

CREATE FUNCTION public.shia_edge_payment_release(p_order_id uuid,p_lease_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE shia_edge.payments SET lease_id=NULL,locked_until=NULL WHERE order_id=p_order_id AND lease_id=p_lease_id;
$$;
CREATE FUNCTION public.shia_edge_session(p_session_id text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT to_jsonb(s) FROM shia_edge.sessions s WHERE session_id=p_session_id; $$;

CREATE FUNCTION public.shia_edge_event(p_event_id text,p_event_type text,p_session_id text,p_order_id uuid,p_paid boolean,p_failed boolean,p_expired boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM shia_edge.sessions WHERE session_id=p_session_id AND order_id=p_order_id) THEN RAISE EXCEPTION 'shia_invalid'; END IF;
 INSERT INTO shia_edge.events(event_id,event_type,session_id) VALUES(p_event_id,p_event_type,p_session_id) ON CONFLICT(event_id) DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_paid THEN
  UPDATE shia_edge.payments SET payment_status='paid',paid_at=coalesce(paid_at,now()) WHERE order_id=p_order_id;
  INSERT INTO shia_edge.fulfillment(order_id,session_id) VALUES(p_order_id,p_session_id) ON CONFLICT(order_id) DO NOTHING;
  INSERT INTO shia_edge.notifications(order_id,kind) VALUES(p_order_id,'paid') ON CONFLICT(order_id,kind) DO NOTHING;
 ELSIF p_failed OR p_expired THEN
  UPDATE shia_edge.payments SET payment_status=CASE WHEN p_failed THEN 'failed' ELSE 'expired' END WHERE order_id=p_order_id AND checkout_session_id=p_session_id AND payment_status<>'paid';
 END IF;
END $$;
CREATE FUNCTION public.shia_edge_notification_claim(p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shia_edge.notifications;
BEGIN
 WITH due AS (SELECT id FROM shia_edge.notifications WHERE (status IN ('pending','failed') AND available_at<=now()) OR (status='processing' AND locked_until<=now()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE shia_edge.notifications n SET status='processing',attempts=attempts+1,lease_id=p_lease_id,locked_until=now()+interval '2 minutes' FROM due WHERE n.id=due.id RETURNING n.* INTO r;
 IF NOT FOUND THEN RETURN NULL; END IF; RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.shia_edge_notification_finish(p_id uuid,p_lease_id uuid,p_status text,p_provider_id text,p_error text,p_delay integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_status NOT IN ('sent','failed','blocked') OR p_delay<0 OR p_delay>3600 THEN RAISE EXCEPTION 'shia_invalid'; END IF;
 UPDATE shia_edge.notifications SET status=p_status,provider_id=p_provider_id,last_error=p_error,sent_at=CASE WHEN p_status='sent' THEN now() ELSE NULL END,available_at=now()+p_delay*interval '1 second',lease_id=NULL,locked_until=NULL WHERE id=p_id AND lease_id=p_lease_id AND status='processing';
END $$;
CREATE FUNCTION public.shia_edge_rate_limit(p_scope text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 INSERT INTO shia_edge.rate_limits(scope,window_start,requests) VALUES(p_scope,now(),1)
 ON CONFLICT(scope) DO UPDATE SET requests=CASE WHEN shia_edge.rate_limits.window_start<now()-interval '1 minute' THEN 1 ELSE shia_edge.rate_limits.requests+1 END,window_start=CASE WHEN shia_edge.rate_limits.window_start<now()-interval '1 minute' THEN now() ELSE shia_edge.rate_limits.window_start END RETURNING requests INTO n;
 RETURN n<=CASE WHEN p_scope='intake' THEN 60 ELSE 120 END;
END $$;

-- Existing authenticated SHIA admins can see verified payment state, never capabilities.
CREATE FUNCTION public.shia_edge_admin_payment_status(p_order_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.shia_is_admin() THEN RAISE EXCEPTION 'shia_forbidden'; END IF;
 IF cardinality(p_order_ids)>200 THEN RAISE EXCEPTION 'shia_invalid'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('order_id',order_id,'payment_status',payment_status,'paid_at',paid_at)) FROM shia_edge.payments WHERE order_id=ANY(p_order_ids)),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.shia_edge_admin_payment_status(uuid[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.shia_edge_admin_payment_status(uuid[]) TO authenticated;

-- Named service-only RPCs; no generic SQL executor, no anonymous/admin-user invocation.
REVOKE ALL ON FUNCTION public.shia_edge_submit(text,text,uuid,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_request(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_finalize(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_payment_claim(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_payment_reserve(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_payment_save(uuid,uuid,text,integer,text,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_payment_release(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_session(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_event(text,text,text,uuid,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_notification_claim(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_notification_finish(uuid,uuid,text,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.shia_edge_rate_limit(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shia_edge_submit(text,text,uuid,text,jsonb,jsonb,text),public.shia_edge_request(uuid,text),public.shia_edge_finalize(uuid,text,jsonb,text),public.shia_edge_payment_claim(uuid,text,text,uuid),public.shia_edge_payment_reserve(uuid,uuid,integer,text),public.shia_edge_payment_save(uuid,uuid,text,integer,text,integer,text),public.shia_edge_payment_release(uuid,uuid),public.shia_edge_session(text),public.shia_edge_event(text,text,text,uuid,boolean,boolean,boolean),public.shia_edge_notification_claim(uuid),public.shia_edge_notification_finish(uuid,uuid,text,text,text,integer),public.shia_edge_rate_limit(text) TO service_role;
COMMIT;
