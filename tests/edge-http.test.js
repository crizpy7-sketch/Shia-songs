import test from 'node:test';import assert from 'node:assert/strict';import Stripe from 'stripe';
import { createEdgeHandler,edgeBody } from '../server/edge-http.js';import { readConfig } from '../server/catalog.js';import { frontendBase,checkoutReturnUrls } from '../server/return-urls.js';
const origin='https://pages.example.invalid';const api='https://edge.example.invalid/functions/v1/shia-song-payments';
const config={enabled:true,origin,frontendBaseUrl:`${origin}/Shia-songs/`,workerSecret:'fake-local-worker-secret-at-least32-chars'};
function fixture(){const calls=[];const payments={requireReady(){if(!config.enabled)throw new Error('not ready');},checkout:async body=>{calls.push({kind:'checkout',body});return {url:'https://checkout.stripe.com/c/pay/fake'};},handleEvent:async event=>{calls.push({kind:'webhook',event});return {received:true};}};return {calls,handler:createEdgeHandler({config,payments,rateLimit:async()=>{}})};}
const post=(url,body,headers={})=>new Request(url,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('Edge exact-origin preflight and checkout work without accepting foreign or absent origins',async()=>{
 const {handler,calls}=fixture();let r=await handler(new Request(api+'/checkout',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.equal(r.headers.get('access-control-allow-credentials'),null);
 assert.equal((await handler(new Request('https://edge.example.invalid/shia-song-payments/payment-config',{headers:{origin}}))).status,200);
 r=await handler(post(api+'/checkout',{orderId:'fake',paymentToken:'fake-capability',packageKey:'songs'}));assert.equal(r.status,200);assert.equal(calls.length,1);
 for(const bad of ['https://evil.example.invalid',origin+'/Shia-songs/','null']){r=await handler(post(api+'/checkout',{}, {origin:bad}));assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);}
 r=await handler(new Request(api+'/checkout',{method:'POST',body:'{}',headers:{'content-type':'application/json'}}));assert.equal(r.status,403);assert.equal(calls.length,1);
});
test('Edge customer routes enforce bounds, JSON shape, MIME, supplied rate limiter and method',async()=>{
 const {handler,calls}=fixture();for(const body of ['null','[]','42']){const r=await handler(new Request(api+'/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body}));assert.equal(r.status,400);}
 assert.equal((await handler(new Request(api+'/checkout',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'{}'}))).status,415);
 assert.equal((await handler(post(api+'/checkout',{text:'x'.repeat(20000)}))).status,413);assert.equal(calls.length,0);
 const disabled=createEdgeHandler({config,payments:{},rateLimit:null});let r=await disabled(new Request(api+'/payment-config',{headers:{origin}}));assert.equal((await r.json()).enabled,false);assert.equal((await disabled(post(api+'/checkout',{}))).status,503);
 assert.equal((await handler(new Request(api+'/checkout',{method:'GET',headers:{origin}}))).status,405);
});
test('Edge raw-byte async Stripe signature verification accepts genuine local fixtures and rejects changed bytes',async()=>{
 const sdk=new Stripe('sk_test_fake_only'),secret='whsec_fake_only',calls=[];
 const handler=createEdgeHandler({config,payments:{requireReady(){},handleEvent:async event=>{calls.push(event);return {received:true};}},verifyWebhook:(raw,signature)=>sdk.webhooks.constructEventAsync(raw,signature,secret,undefined,Stripe.createSubtleCryptoProvider())});
 const url='https://edge.example.invalid/functions/v1/shia-stripe-webhook',raw=JSON.stringify({id:'evt_fake',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_fake'}}});const signature=sdk.webhooks.generateTestHeaderString({payload:raw,secret});
 const req=body=>new Request(url,{method:'POST',headers:{'stripe-signature':signature},body});assert.equal((await handler(req(raw))).status,200);assert.equal((await handler(req(raw+' '))).status,400);assert.equal((await handler(new Request(url,{method:'POST',body:raw}))).status,400);assert.equal(calls.length,1);
});
test('Edge intake uses the injected audited handler; worker requires independent secret and refuses browser calls',async()=>{
 const calls=[];let attempts=0;const handler=createEdgeHandler({config,intake:{handle:async body=>{calls.push(body);return {order_number:'fake',notification_status:'queued'};}},rateLimit:async()=>{},worker:{runOne:async()=>{attempts++;return true;}}});
 const intake='https://edge.example.invalid/functions/v1/shia-order-intake';assert.equal((await handler(post(intake,{action:'finalize',order_id:'fake'}))).status,200);assert.equal(calls.length,1);
 const worker='https://edge.example.invalid/functions/v1/shia-song-notifications';assert.equal((await handler(new Request(worker,{method:'POST'}))).status,401);
 const headers={authorization:`Bearer ${config.workerSecret}`};assert.equal((await handler(new Request(worker,{method:'POST',headers:{...headers,origin}}))).status,401);
 const r=await handler(new Request(worker,{method:'POST',headers}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{processed:true});assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(attempts,1);
});
test('Pages return URLs retain the repository path; invalid origin/path configuration is refused',()=>{
 assert.deepEqual(checkoutReturnUrls(config),{success_url:`${origin}/Shia-songs/payment-status.html`,cancel_url:`${origin}/Shia-songs/?checkout=cancelled#paquetes`});
 for(const value of ['https://evil.example.invalid/','https://user:password@pages.example.invalid/','https://pages.example.invalid/Shia-songs','https://pages.example.invalid/?token=fake'])assert.throws(()=>frontendBase(origin,value));
 assert(readConfig({APP_ORIGIN:origin,FRONTEND_BASE_URL:'https://evil.example.invalid/'}).reasons.some(r=>r.includes('FRONTEND_BASE_URL')));
});
test('Edge streaming body limit works even without Content-Length',async()=>{
 const request=new Request(api+'/checkout',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(10));c.enqueue(new Uint8Array(10));c.close();}}),duplex:'half'});await assert.rejects(()=>edgeBody(request,15),{status:413});
});

test('V2 worker does not inherit v1/global sender credentials or dispatch without its own configured provider',async()=>{
 const {createEdgeRuntime}=await import('../server/edge-runtime.js');let calls=0,sends=0;const env={SHIA_SONGS_ORIGIN:origin,SHIA_SONGS_FRONTEND_BASE_URL:origin+'/Shia-songs/',SHIA_SONGS_EDGE_READY:'true',SHIA_SONGS_WORKER_SECRET:'fake-worker-secret-at-least-32-characters',RESEND_API_KEY:'fake-legacy-key',SHIA_ADMIN_EMAIL:'legacy@example.invalid',SHIA_FROM_EMAIL:'legacy@example.invalid'};
 const handler=createEdgeRuntime({env,admin:{rpc:async()=>{calls++;return {data:null};}},stripe:null,verifyWebhook:null,fetcher:async()=>{sends++;}});const response=await handler(new Request('https://edge.example.invalid/shia-song-notifications',{method:'POST',headers:{authorization:`Bearer ${env.SHIA_SONGS_WORKER_SECRET}`}}));assert.equal(response.status,500);assert.equal(calls,0);assert.equal(sends,0);
});
