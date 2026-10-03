-- DISPOSABLE TEST FIXTURE ONLY. SHIA table definitions match audited v1 catalogs.
-- auth/storage and inventory_probe are synthetic; no customer/auth/inventory rows copied.
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
CREATE TABLE public.shia_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,display_name text,role text NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','admin','staff')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.shia_song_orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL,
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','lyrics_in_progress','waiting_on_customer','song_in_progress','completed','delivered','cancelled')),
 customer_name text NOT NULL,customer_email text NOT NULL,customer_phone text NOT NULL,event_date date,couple_names text,anniversary_date date,years_married integer,language text,music_style text,emotion text,answers jsonb NOT NULL DEFAULT '{}',file_manifest jsonb NOT NULL DEFAULT '[]',internal_notes text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),order_type text NOT NULL DEFAULT 'personalized_song',title text,source text NOT NULL DEFAULT 'website',submission_token_hash text
);
ALTER TABLE public.shia_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shia_song_orders ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION private.shia_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.shia_admins WHERE user_id=(SELECT auth.uid())); $$;
CREATE FUNCTION public.shia_set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
CREATE TRIGGER shia_song_orders_updated_at BEFORE UPDATE ON public.shia_song_orders FOR EACH ROW EXECUTE FUNCTION public.shia_set_updated_at();
CREATE POLICY "shia admins can view orders" ON public.shia_song_orders FOR SELECT TO authenticated USING((SELECT private.shia_is_admin()));
CREATE POLICY "shia admins can update orders" ON public.shia_song_orders FOR UPDATE TO authenticated USING((SELECT private.shia_is_admin())) WITH CHECK((SELECT private.shia_is_admin()));
CREATE POLICY "shia admins can delete orders" ON public.shia_song_orders FOR DELETE TO authenticated USING((SELECT private.shia_is_admin()));
CREATE POLICY "admins can view own admin membership" ON public.shia_admins FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
GRANT USAGE ON SCHEMA private,auth TO authenticated;
GRANT SELECT ON public.shia_admins TO authenticated;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.shia_song_orders TO authenticated,service_role;
CREATE TABLE public.inventory_probe(id integer PRIMARY KEY,value text);
GRANT SELECT,UPDATE,TRUNCATE ON public.inventory_probe TO authenticated;
