import { createClient } from 'npm:@supabase/supabase-js@2.102.0';
import Stripe from 'npm:stripe@23.0.0';
import { createEdgeRuntime } from '../../../server/edge-runtime.js';
export function runtime() {
 try {
  const names=['SUPABASE_URL','SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY','SHIA_SONGS_ORIGIN','SHIA_SONGS_FRONTEND_BASE_URL','SHIA_SONGS_EDGE_READY','SHIA_SONGS_INTAKE_ENABLED','SHIA_SONGS_INTAKE_TOKEN_SECRET','SHIA_SONGS_PAYMENT_TOKEN_SECRET','SHIA_SONGS_CHECKOUT_ENABLED','SHIA_SONGS_STRIPE_API_KEY','SHIA_SONGS_WEBHOOK_SECRET','SHIA_SONGS_PRICE_SONGS','SHIA_SONGS_PRICE_SLIDESHOW','SHIA_SONGS_BRIDGE_READY','SHIA_SONGS_TERMS_APPROVED','SHIA_SONGS_TERMS_URL','SHIA_SONGS_TAX_REVIEWED','SHIA_SONGS_WORKER_SECRET','SHIA_SONGS_NOTIFICATION_PROVIDER','SHIA_SONGS_ALERT_TO','SHIA_SONGS_ALERT_FROM','SHIA_SONGS_RESEND_API_KEY','SHIA_SONGS_ALERT_WEBHOOK_URL','SHIA_SONGS_ALERT_WEBHOOK_SECRET','SHIA_SONGS_ALERT_WEBHOOK_IDEMPOTENT'];
  const env:Record<string,string|undefined>=Object.fromEntries(names.map(name=>[name,Deno.env.get(name)]));
  const keys=JSON.parse(env.SUPABASE_SECRET_KEYS||'{}');
  const secret=keys.default||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret||!env.SUPABASE_URL)throw new Error('Missing runtime configuration');
  const admin=createClient(env.SUPABASE_URL,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,options)=>fetch(input,{...options,signal:AbortSignal.timeout(20000)})}});
  const stripe=env.SHIA_SONGS_CHECKOUT_ENABLED==='true'?new Stripe(env.SHIA_SONGS_STRIPE_API_KEY||'',{apiVersion:'2026-09-30.endive',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:20000}):null;
  const verifyWebhook=stripe?(raw:Uint8Array,signature:string)=>stripe.webhooks.constructEventAsync(new TextDecoder().decode(raw),signature,env.SHIA_SONGS_WEBHOOK_SECRET||'',undefined,Stripe.createSubtleCryptoProvider()):null;
  return createEdgeRuntime({env,admin,stripe,verifyWebhook});
 } catch {
  // Startup configuration failures expose no environment values or provider details.
  return () => Response.json({error:'SHIA service is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
