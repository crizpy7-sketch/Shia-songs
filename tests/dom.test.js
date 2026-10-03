import { OCCASION_PHOTOS } from '../assets/js/occasion-photos.js';
import test from 'node:test';import assert from 'node:assert/strict';import { readFile } from 'node:fs/promises';import { JSDOM } from 'jsdom';import { validateUpload } from '../assets/js/upload-policy.js';import { buildSync } from 'esbuild';
const html=await readFile('index.html','utf8');const script=(await readFile('assets/js/app.js','utf8')).replace(/^import .*;$/gm,'');
function setup({localIntake=false,adminUser=false}={}){
 const dom=new JSDOM(localIntake?html.replace('name="shia-intake-endpoint" content=""','name="shia-intake-endpoint" content="/api/intake"'):html,{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;const calls=[];
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.CSS={escape:s=>String(s).replace(/[\\"]/g,'\\$&')};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 w.createClient=()=>({auth:{getUser:async()=>({data:{user:adminUser?{id:'fake-admin'}:null}})},
 from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'owner'}})}),order:async()=>({data:table==='shia_song_orders'?[{id:'559a7da0-6206-4eb0-8e53-a78d48994209',order_number:1,title:'Fake local order',customer_name:'Fake customer',customer_email:'fake@example.invalid',customer_phone:'5550100000',created_at:'2026-10-03T00:00:00Z',status:'new',answers:{},file_manifest:[]}]:[]})})}),
 rpc:async()=>({data:[{order_id:'559a7da0-6206-4eb0-8e53-a78d48994209',payment_status:'paid',paid_at:'2026-10-03T00:00:00Z'}]}),storage:{from:()=>({uploadToSignedUrl:async()=>({error:null})})}});w.validateUpload=validateUpload;w.OCCASION_PHOTOS=OCCASION_PHOTOS;w.eval(buildSync({entryPoints:['assets/js/i18n.js'],bundle:true,write:false,format:'iife',globalName:'TestI18n'}).outputFiles[0].text);w.eval('var {t,getLanguage,setLanguage,applyTranslations,TRANSLATIONS}=TestI18n;');w.eval(buildSync({entryPoints:['assets/js/payments.js'],bundle:true,write:false,format:'iife',globalName:'TestPayments'}).outputFiles[0].text);w.createPaymentUI=opts=>w.TestPayments.createPaymentUI({...opts,fetcher:async()=>({ok:false})});
 w.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);return {ok:true,json:async()=>body.action==='submit'?{order_id:'559a7da0-6206-4eb0-8e53-a78d48994209',order_number:'QA-ONLY',submission_token:'mock',uploads:body.files.map((_,i)=>({path:'test/'+i,token:'mock'}))}:{order_number:'QA-ONLY'}};};
 w.eval(script);return {dom,w,d:w.document,calls};
}
function fill(d){const active=d.querySelector('.step.active');for(const n of active.querySelectorAll('input[required],textarea[required]')){if(n.type==='radio'){if(!active.querySelector(`input[name="${n.name}"]:checked`))n.checked=true;}else if(n.type==='checkbox')n.checked=true;else n.value=n.type==='number'?'5':n.type==='date'?'2027-01-01':n.type==='email'?'qa@example.invalid':n.type==='tel'?'5550100000':'Historia local de prueba';}}
test('All 12 bilingual wizard templates progress, validate, save only on request, and retain package selection',async()=>{
 const {dom,w,d}=setup();try{assert.equal(d.querySelectorAll('.tcard').length,12);assert.equal(d.querySelectorAll('main').length,1);assert(!/[\u{1F000}-\u{1FAFF}]/u.test(d.body.textContent));
  const ids=[...d.querySelectorAll('[data-t]')].map(b=>b.dataset.t);
  for(const [i,id] of ids.entries()){
   d.querySelector(`[data-t="${id}"]`).click();assert.equal(d.querySelectorAll('.step.active').length,1);d.querySelector('#next').click();assert(d.querySelector('#err').classList.contains('show'));fill(d);const values=()=>[...new w.FormData(d.querySelector('#f'))].filter(([,v])=>typeof v==='string');const before=values();w.setLanguage('es');assert.deepEqual(values(),before);assert.equal(d.documentElement.lang,'es');w.setLanguage('en');assert.deepEqual(values(),before);assert.equal(d.documentElement.lang,'en');
   if(i===0){d.querySelector('input[required]').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(Object.keys(w.localStorage).filter(k=>k.startsWith('shia-form-v2:')).length,0);d.querySelector('#save').click();assert.equal(Object.keys(w.localStorage).filter(k=>k.startsWith('shia-form-v2:')).length,1);d.querySelector('#clearDraft').click();assert.equal(Object.keys(w.localStorage).filter(k=>k.startsWith('shia-form-v2:')).length,0);}
   let count=0;while(!d.querySelector('#next').classList.contains('hidden')){fill(d);d.querySelector('#next').click();assert(++count<20);}
   fill(d);assert(d.querySelector('.step.active #review'));assert.equal(d.querySelector('input[name="Paquete"]:checked').value,'songs');assert.equal(d.querySelector('.track').getAttribute('aria-valuenow'),'100');d.querySelector('#changeTemplate').click();assert(d.querySelector('#formArea').classList.contains('hidden'));
  }
 }finally{dom.window.close();}
});
test('Local mock intake/finalize succeeds, files preserve order and captions, and checkout stays disabled',async()=>{
 const {dom,w,d,calls}=setup();try{d.querySelector('[data-t="aniversario"]').click();let count=0;while(!d.querySelector('#next').classList.contains('hidden')){fill(d);if(d.querySelector('.step.active #photoInput')){const file=new w.File(['mock-bytes'],'qa-photo.jpg',{type:'image/jpeg'});Object.defineProperty(d.querySelector('#photoInput'),'files',{value:[file]});d.querySelector('#photoInput').dispatchEvent(new w.Event('change'));const cap=d.querySelector('[data-cap]');cap.value='Solo una prueba local';cap.dispatchEvent(new w.Event('input'));assert.match(d.querySelector('#photoCount').textContent,/1 photo/);}d.querySelector('#next').click();assert(++count<20);}fill(d);await d.querySelector('#f').onsubmit({preventDefault(){}});assert.equal(calls.length,2);assert.equal(calls[0].answers['Paquete elegido'],'Canciones + letras · $20 USD');assert.equal(calls[1].file_manifest[0].role,'slideshow');assert.equal(calls[1].file_manifest[0].caption,'Solo una prueba local');assert(d.querySelector('#done').hasAttribute('open'));assert(d.querySelector('#checkoutButton').disabled);assert.equal(Object.keys(w.localStorage).filter(k=>k.startsWith('shia-form-v2:')).length,0);}finally{dom.window.close();}
});
test('Pricing selection and obsolete admin setup are handled correctly',async()=>{const {dom,d}=setup();try{d.querySelector('[data-plan="slideshow"]').click();d.querySelector('[data-t="aniversario"]').click();assert.equal(d.querySelector('input[name="Paquete"]:checked').value,'slideshow');assert.equal(d.querySelector('#signupBtn'),null);d.querySelector('#footerAdmin').click();await new Promise(r=>setTimeout(r,0));assert(!d.querySelector('#adminApp').classList.contains('hidden'));assert(d.querySelector('#adminPanel').classList.contains('hidden'));}finally{dom.window.close();}});
test('Draft package and song-language answers stay canonical across interface switches',()=>{
 const {dom,w,d}=setup();try{
 d.querySelector('[data-plan="slideshow"]').click();d.querySelector('[data-t="aniversario"]').click();
 const song=[...d.querySelectorAll('[name="Idioma"]')].find(n=>n.value==='Inglés');song.checked=true;
 const text=d.querySelector('#f input[required]:not([type="radio"])');text.value='Inglés';text.dispatchEvent(new w.Event('input',{bubbles:true}));
 d.querySelector('#save').click();const before=[...new w.FormData(d.querySelector('#f'))].filter(([,v])=>typeof v==='string');
 w.setLanguage('es');assert.deepEqual([...new w.FormData(d.querySelector('#f'))].filter(([,v])=>typeof v==='string'),before);assert(song.checked);
 d.querySelector('#changeTemplate').click();d.querySelector('[data-t="aniversario"]').click();assert.equal(d.querySelector('[name="Paquete"]:checked').value,'slideshow');assert.equal(d.querySelector('[name="Idioma"]:checked').value,'Inglés');
 w.setLanguage('en');assert.equal(d.querySelector('#f input[required]:not([type="radio"])').value,'Inglés');
 let count=0;while(!d.querySelector('#next').classList.contains('hidden')){fill(d);d.querySelector('#f input[required]:not([type="radio"])').value='Inglés';d.querySelector('#next').click();assert(++count<20);}assert([...d.querySelectorAll('#review .row')].some(row=>row.querySelector(':scope > span')?.textContent==='Inglés'));
 }finally{dom.window.close();}
});
test('Storage-denied locale switches still preserve answers',()=>{const {dom,w,d}=setup();try{d.querySelector('[data-t="aniversario"]').click();fill(d);const before=[...new w.FormData(d.querySelector('#f'))];w.Storage.prototype.setItem=()=>{throw new Error('Mock denied storage')};w.setLanguage('es');assert.equal(d.documentElement.lang,'es');assert.deepEqual([...new w.FormData(d.querySelector('#f'))],before);w.setLanguage('en');assert.equal(d.documentElement.lang,'en');assert.deepEqual([...new w.FormData(d.querySelector('#f'))],before);}finally{dom.window.close();}});
test('Unknown backend errors use localized safe customer text',async()=>{const {dom,w,d}=setup();try{d.querySelector('[data-t="aniversario"]').click();let count=0;while(!d.querySelector('#next').classList.contains('hidden')){fill(d);d.querySelector('#next').click();assert(++count<20);}fill(d);w.fetch=async()=>({ok:false,json:async()=>({error:'Error secreto del proveedor desconocido'})});await d.querySelector('#f').onsubmit({preventDefault(){}});const english=d.querySelector('#err').textContent;assert(!english.includes('Error secreto'));assert.match(english,/could not|unable|try|failed|error occurred/i);w.setLanguage('es');assert(!d.querySelector('#err').textContent.includes('Error secreto'));assert.notEqual(d.querySelector('#err').textContent,english);}finally{dom.window.close();}});
test('Double clicks and lost submit/finalize responses retain one frozen bilingual submission',async()=>{
 const {dom,w,d}=setup();try{
  d.querySelector('[data-t="aniversario"]').click();while(!d.querySelector('#next').classList.contains('hidden')){fill(d);d.querySelector('#next').click();}fill(d);
  const requests=[];let release;let lostSubmit=true,lostFinalize=true;
  w.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);requests.push(body);
   if(body.action==='submit'){if(lostSubmit){lostSubmit=false;await new Promise(r=>release=r);throw new Error('fake lost response');}return {ok:true,json:async()=>({order_id:'559a7da0-6206-4eb0-8e53-a78d48994209',order_number:'FAKE',submission_token:'fake',uploads:[]})};}
   if(lostFinalize){lostFinalize=false;throw new Error('fake lost finalize response');}return {ok:true,json:async()=>({order_number:'FAKE'})};
  };
  const send=()=>d.querySelector('#f').onsubmit({preventDefault(){}});const first=send();await send();assert.equal(requests.length,1);release();await first;
  w.setLanguage('es');assert.equal(d.documentElement.lang,'es');await send();assert.equal(requests.filter(r=>r.action==='submit').length,2);assert.deepEqual(requests[0],requests[1]);assert.match(requests[0].idempotency_key,/^[0-9a-f-]{36}$/);assert.equal(requests[0].package_key,'songs');
  w.setLanguage('en');await send();assert(d.querySelector('#done').hasAttribute('open'));assert.equal(requests.filter(r=>r.action==='submit').length,2);const finals=requests.filter(r=>r.action==='finalize');assert.deepEqual(finals[0],finals[1]);
 }finally{dom.window.close();}
});

test('Isolated submit validation rejection unlocks correction; uncertain failures retain frozen attempt',async()=>{
 const {dom,w,d}=setup({localIntake:true});try{
  d.querySelector('[data-t="personalizada"]').click();while(!d.querySelector('#next').classList.contains('hidden')){fill(d);d.querySelector('#next').click();}fill(d);
  const requests=[];let status=400;w.fetch=async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:false,status,json:async()=>({error:'No se pudo enviar la solicitud.'})};};const send=()=>d.querySelector('#f').onsubmit({preventDefault(){}});
  await send();assert.equal(d.querySelector('#back').disabled,false);assert.equal(d.querySelector('#f input[required]').disabled,false);
  status=503;await send();assert.notEqual(requests[0].idempotency_key,requests[1].idempotency_key);assert.equal(d.querySelector('#back').disabled,true);
  const warning=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(warning);assert.equal(warning.defaultPrevented,true);
  w.setLanguage('es');await send();assert.deepEqual(requests[1],requests[2]);assert.equal(d.querySelector('#back').disabled,true);
 }finally{dom.window.close();}
});

test('Existing authorized admin can find an opaque alert UUID and see server-verified v2 paid state',async()=>{
 const {dom,w,d}=setup({localIntake:true,adminUser:true});try{d.querySelector('#footerAdmin').click();await new Promise(r=>setTimeout(r,0));assert.match(d.querySelector('#ordersList').textContent,/Pago: Confirmado/);const search=d.querySelector('#searchOrders');search.value='559a7da0-6206-4eb0-8e53-a78d48994209';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#ordersList .order-card').length,1);assert.match(d.querySelector('#ordersList').textContent,/Fake local order/);}finally{dom.window.close();}
});
