import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { createHash } from 'node:crypto';
import { publicConfig } from './catalog.js';
import { PaymentError,sameSecret } from './payments.js';
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://bjnkgxkcbbnbtazelsjs.supabase.co; connect-src 'self' https://bjnkgxkcbbnbtazelsjs.supabase.co wss://bjnkgxkcbbnbtazelsjs.supabase.co; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
export async function readBody(req,max=16384){
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>max)throw new PaymentError('La solicitud es demasiado grande.',413);parts.push(part);}
  return Buffer.concat(parts);
}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
export function createApp({config,payments,stripe,root=resolve('.'),now=()=>Date.now()}){
  const limits=new Map();
  function rateLimit(req){
    const key=req.socket.remoteAddress||'unknown';const time=now();let value=limits.get(key);
    if(!value||time-value.start>60000)value={start:time,count:0};value.count++;limits.set(key,value);
    if(limits.size>10000)for(const [k,v] of limits)if(time-v.start>60000)limits.delete(k);
    if(value.count>12)throw new PaymentError('Espere un momento antes de volver a intentar.',429);
  }
  return async(req,res)=>{
    res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Frame-Options','DENY');
    if(config.origin.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    try{
      const url=new URL(req.url,config.origin);
      if(url.pathname==='/api/payment-config'&&req.method==='GET')return json(res,200,publicConfig(config));
      if(url.pathname==='/api/checkout'&&req.method==='POST'){
        if(req.headers.origin!==config.origin)throw new PaymentError('Origen no permitido.',403);
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new PaymentError('Tipo de solicitud no válido.',415);
        rateLimit(req);payments.requireReady();const body=JSON.parse((await readBody(req)).toString('utf8'));return json(res,200,await payments.checkout(body));
      }
      if(url.pathname==='/internal/payment-orders'&&req.method==='POST'){
        payments.requireReady();if(!sameSecret(req.headers['x-shia-intake-secret'],config.bridgeSecret))throw new PaymentError('Unauthorized intake bridge.',401);
        const body=JSON.parse((await readBody(req)).toString('utf8'));return json(res,200,await payments.provision(body));
      }
      if(url.pathname==='/api/stripe-webhook'&&req.method==='POST'){
        payments.requireReady();const raw=await readBody(req,1024*1024);const signature=req.headers['stripe-signature'];let event;
        try{event=stripe.webhooks.constructEvent(raw,signature,config.webhookSecret);}catch{throw new PaymentError('Invalid webhook signature.',400);}
        return json(res,200,await payments.handleEvent(event));
      }
      if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/internal/'))return json(res,404,{error:'Endpoint no disponible.'});
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Método no permitido.'});
      const path=decodeURIComponent(url.pathname);const relative=path==='/'?'index.html':path.slice(1);
      if(!['index.html','payment-status.html','credits.html'].includes(relative)&&!relative.startsWith('assets/'))return json(res,404,{error:'Página no encontrada.'});
      const file=resolve(root,relative);if(!file.startsWith(root+sep))return json(res,404,{error:'Página no encontrada.'});
      let data;try{data=await readFile(file);}catch{return json(res,404,{error:'Página no encontrada.'});}
      const type=TYPES[extname(file)];if(!type)return json(res,404,{error:'Página no encontrada.'});
      const etag='"'+createHash('sha256').update(data).digest('hex').slice(0,20)+'"';res.setHeader('ETag',etag);res.setHeader('Cache-Control','no-cache');
      if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
      res.writeHead(200,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:data);
    }catch(error){
      if(error instanceof PaymentError)return json(res,error.status,{error:error.message});
      if(error instanceof SyntaxError)return json(res,400,{error:'JSON no válido.'});
      // Do not log request bodies, tokens, Stripe error payloads, PII, or environment values.
      console.error('Payment request failed:',error?.name||'UnknownError');return json(res,500,{error:'No se pudo completar la solicitud. Intente de nuevo más tarde.'});
    }
  };
}
