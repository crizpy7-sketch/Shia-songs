import { frontendBase } from './return-urls.js';
export const PACKAGES=Object.freeze({
  songs:Object.freeze({key:'songs',name:'Dos canciones personalizadas + letras',amount:2000,currency:'usd',priceEnv:'STRIPE_PRICE_SONGS'}),
  slideshow:Object.freeze({key:'slideshow',name:'Dos canciones + letras + un video slideshow',amount:5000,currency:'usd',priceEnv:'STRIPE_PRICE_SLIDESHOW'})
});
export function packageFor(key){return typeof key==='string'&&Object.hasOwn(PACKAGES,key)?PACKAGES[key]:null;}
export function readConfig(env=process.env){
  const origin=env.APP_ORIGIN||'http://localhost:3000';
  let validOrigin=false,validTerms=false;
  try{const u=new URL(origin);validOrigin=u.origin===origin&&(u.protocol==='https:'||(['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:'));}catch{}
  try{validTerms=new URL(env.COMMERCIAL_TERMS_URL).protocol==='https:';}catch{}
  const reasons=[];let frontendBaseUrl;
  try{frontendBaseUrl=frontendBase(origin,env.FRONTEND_BASE_URL);}catch{reasons.push('FRONTEND_BASE_URL must belong to APP_ORIGIN and end in /');}
  const databaseUrl=env.DATABASE_URL&&!env.DATABASE_URL.includes('bjnkgxkcbbnbtazelsjs')?env.DATABASE_URL:null;
  if(env.CHECKOUT_ENABLED!=='true')reasons.push('Checkout is not explicitly enabled');
  if(!/^(rk|sk)_test_/.test(env.STRIPE_API_KEY||''))reasons.push('A sandbox/test restricted API key is required; live keys are refused');
  if(!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))reasons.push('Webhook signing secret is missing');
  if(!databaseUrl)reasons.push('Durable PostgreSQL database is missing');
  if((env.INTAKE_BRIDGE_SECRET||'').length<32)reasons.push('Trusted intake bridge secret is missing');
  if((env.PAYMENT_TOKEN_SECRET||'').length<32)reasons.push('Payment capability secret is missing');
  if(!validOrigin)reasons.push('APP_ORIGIN must be an exact trusted origin');
  if(!validTerms||env.COMMERCIAL_TERMS_APPROVED!=='true')reasons.push('Approved commercial terms are missing');
  if(env.TAX_REVIEWED!=='true')reasons.push('Merchant tax treatment has not been reviewed');
  if(env.INTAKE_BRIDGE_READY!=='true')reasons.push('Existing intake has not been connected to the payment bridge');
  for(const p of Object.values(PACKAGES))if(!/^price_[A-Za-z0-9]+$/.test(env[p.priceEnv]||''))reasons.push(`${p.priceEnv} is missing`);
  return {intakeEnabled:env.INTAKE_ENABLED==='true'&&validOrigin&&!!databaseUrl&&(env.INTAKE_TOKEN_SECRET||'').length>=32,intakeSecret:env.INTAKE_TOKEN_SECRET,enabled:reasons.length===0,reasons,origin,frontendBaseUrl,termsUrl:env.COMMERCIAL_TERMS_URL,apiKey:env.STRIPE_API_KEY,webhookSecret:env.STRIPE_WEBHOOK_SECRET,bridgeSecret:env.INTAKE_BRIDGE_SECRET,tokenSecret:env.PAYMENT_TOKEN_SECRET,databaseUrl,priceIds:Object.fromEntries(Object.values(PACKAGES).map(p=>[p.key,env[p.priceEnv]]))};
}
export function publicConfig(config){return {enabled:config.enabled,packages:Object.values(PACKAGES).map(({key,name,amount,currency})=>({key,name,amount,currency})),termsUrl:config.enabled?config.termsUrl:null};}
