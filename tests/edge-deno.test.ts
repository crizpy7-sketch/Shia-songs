import { createEdgeHandler } from '../server/edge-http.js';
import { edgeConfig } from '../server/edge-runtime.js';
import Stripe from 'npm:stripe@23.0.0';
function assert(value:unknown){if(!value)throw new Error('Assertion failed');}
Deno.test('Web-standard edge transport executes in Deno with exact-origin checkout and no network',async()=>{
 let calls=0;const config={enabled:true,origin:'https://pages.example.invalid'};
 const handler=createEdgeHandler({config,payments:{requireReady(){},checkout:async()=>{calls++;return {url:'https://checkout.stripe.com/c/pay/fake'};}},rateLimit:async()=>{}});
 const response=await handler(new Request('https://edge.example.invalid/shia-song-payments/checkout',{method:'POST',headers:{origin:config.origin,'content-type':'application/json'},body:'{}'}));
 assert(response.status===200&&calls===1);assert(response.headers.get('Access-Control-Allow-Origin')===config.origin);
});
Deno.test('Deno Web Crypto verifies raw local signed fixtures and rejects modified bytes',async()=>{
 const sdk=new Stripe('sk_test_fake_only'),secret='whsec_fake_only';const payload=JSON.stringify({id:'evt_fake',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_fake'}}});const signature=await sdk.webhooks.generateTestHeaderStringAsync({payload,secret});let count=0;
 const handler=createEdgeHandler({config:{enabled:true,origin:'https://pages.example.invalid'},payments:{requireReady(){},handleEvent:async()=>{count++;return {received:true};}},verifyWebhook:(raw:Uint8Array,sig:string)=>sdk.webhooks.constructEventAsync(new TextDecoder().decode(raw),sig,secret,undefined,Stripe.createSubtleCryptoProvider())});
 const request=(body:string)=>new Request('https://edge.example.invalid/shia-stripe-webhook',{method:'POST',headers:{'stripe-signature':signature},body});assert((await handler(request(payload))).status===200);assert((await handler(request(payload+' '))).status===400);assert(count===1);
});
Deno.test('Edge configuration stays disabled without explicit migration/intake/checkout gates',()=>{
 const config=edgeConfig({SHIA_SONGS_ORIGIN:'https://pages.example.invalid',SHIA_SONGS_FRONTEND_BASE_URL:'https://pages.example.invalid/Shia-songs/'});assert(!config.enabled&&!config.intakeEnabled);assert(config.frontendBaseUrl==='https://pages.example.invalid/Shia-songs/');
});
