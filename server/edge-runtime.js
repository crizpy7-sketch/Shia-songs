import { readConfig } from './catalog.js';
import { EdgeStore } from './edge-store.js';
import { EdgeIntake,edgeStorage } from './edge-intake.js';
import { Payments,PaymentError } from './payments.js';
import { NotificationWorker,notificationProvider } from './notifications.js';
import { createEdgeHandler } from './edge-http.js';
export function edgeConfig(env){
 const mapped={APP_ORIGIN:env.SHIA_SONGS_ORIGIN,FRONTEND_BASE_URL:env.SHIA_SONGS_FRONTEND_BASE_URL,
  CHECKOUT_ENABLED:env.SHIA_SONGS_CHECKOUT_ENABLED,STRIPE_API_KEY:env.SHIA_SONGS_STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET:env.SHIA_SONGS_WEBHOOK_SECRET,STRIPE_PRICE_SONGS:env.SHIA_SONGS_PRICE_SONGS,
  STRIPE_PRICE_SLIDESHOW:env.SHIA_SONGS_PRICE_SLIDESHOW,PAYMENT_TOKEN_SECRET:env.SHIA_SONGS_PAYMENT_TOKEN_SECRET,
  INTAKE_BRIDGE_SECRET:env.SHIA_SONGS_PAYMENT_TOKEN_SECRET,INTAKE_BRIDGE_READY:env.SHIA_SONGS_BRIDGE_READY,
  COMMERCIAL_TERMS_APPROVED:env.SHIA_SONGS_TERMS_APPROVED,COMMERCIAL_TERMS_URL:env.SHIA_SONGS_TERMS_URL,
  TAX_REVIEWED:env.SHIA_SONGS_TAX_REVIEWED,DATABASE_URL:env.SHIA_SONGS_EDGE_READY==='true'?'edge-rpc':undefined};
 const config=readConfig(mapped);
 if(!mapped.APP_ORIGIN||!mapped.FRONTEND_BASE_URL)throw new Error('Explicit SHIA frontend origin/base are required');
 config.intakeSecret=env.SHIA_SONGS_INTAKE_TOKEN_SECRET;
 config.intakeEnabled=env.SHIA_SONGS_EDGE_READY==='true'&&env.SHIA_SONGS_INTAKE_ENABLED==='true'&&(config.intakeSecret||'').length>=32;
 config.workerSecret=env.SHIA_SONGS_WORKER_SECRET;
 if(!config.frontendBaseUrl)throw new Error('Invalid SHIA frontend base');
 return config;
}
export function createEdgeRuntime({env,admin,stripe,verifyWebhook,fetcher=fetch}){
 const config=edgeConfig(env);const store=new EdgeStore(admin);
 const payments=new Payments({config,store,stripe});
 const intake=config.intakeEnabled?new EdgeIntake({config,store,storage:edgeStorage(admin)}):null;
 const provider=notificationProvider({NOTIFICATION_PROVIDER:env.SHIA_SONGS_NOTIFICATION_PROVIDER,NOTIFICATION_TO:env.SHIA_SONGS_ALERT_TO,NOTIFICATION_FROM:env.SHIA_SONGS_ALERT_FROM,RESEND_API_KEY:env.SHIA_SONGS_RESEND_API_KEY,NOTIFICATION_WEBHOOK_URL:env.SHIA_SONGS_ALERT_WEBHOOK_URL,NOTIFICATION_WEBHOOK_SECRET:env.SHIA_SONGS_ALERT_WEBHOOK_SECRET,NOTIFICATION_WEBHOOK_IDEMPOTENT:env.SHIA_SONGS_ALERT_WEBHOOK_IDEMPOTENT},fetcher);
 const worker=env.SHIA_SONGS_EDGE_READY==='true'?new NotificationWorker({store,provider}):null;
 const rateLimit=env.SHIA_SONGS_EDGE_READY==='true'?async request=>{
  // A shared durable budget avoids trusting client-supplied proxy/IP headers.
  const allowed=await store.rpc('rate_limit',{p_scope:new URL(request.url).pathname.endsWith('/checkout')?'checkout':'intake'});
  if(!allowed)throw new PaymentError('Espere un momento antes de volver a intentar.',429);
 }:null;
 return createEdgeHandler({config,payments,intake,worker,verifyWebhook,rateLimit,paths:{api:'/functions/v1/shia-song-payments',intake:'/functions/v1/shia-order-intake-v2',webhook:'/functions/v1/shia-stripe-webhook',worker:'/functions/v1/shia-song-notifications'}});
}
