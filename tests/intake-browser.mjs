import { chromium } from 'playwright';import assert from 'node:assert/strict';import { createServer } from 'node:http';import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';import { PostgresStore } from '../server/store.js';import { Intake } from '../server/intake.js';import { Payments } from '../server/payments.js';import { NotificationWorker } from '../server/notifications.js';import { createApp } from '../server/app.js';
const db=new PGlite();await db.exec(await readFile('server/schema.sql','utf8'));await db.exec(await readFile('server/intake-schema.sql','utf8'));
const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};let lock=Promise.resolve();const pool={query,connect:async()=>{const prior=lock;let release;lock=new Promise(r=>release=r);await prior;return {query,release};}};
const store=new PostgresStore(null,{pool});const config={enabled:true,origin:'http://localhost',intakeSecret:'fake-local-intake-secret-32-chars',tokenSecret:'fake-local-payment-secret-32-chars',priceIds:{songs:'price_fakeSongs',slideshow:'price_fakeSlideshow'}};
const uploaded=new Set();const storage={sign:async(path)=>`${config.origin}/fake-upload/${path}`,verify:async(file)=>uploaded.has(file.path)};const intake=new Intake({store,config,storage});let sessionsCreated=0;
const stripe={prices:{retrieve:async id=>({active:true,livemode:false,type:'one_time',unit_amount:id==='price_fakeSongs'?2000:5000,currency:'usd'})},checkout:{sessions:{create:async()=>{sessionsCreated++;return {id:`cs_fake_${sessionsCreated}`,livemode:false,url:'https://checkout.stripe.com/c/pay/fake-only'};}}}};
const payments=new Payments({store,config,stripe});const server=createServer(createApp({config,payments,stripe,intake}));await new Promise(r=>server.listen(0,'127.0.0.1',r));config.origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let lostSubmit=true,lostFinalize=true;let submitRequests=0,finalizeRequests=0;
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==config.origin){if(url.hostname==='checkout.stripe.com')return route.fulfill({body:'Fake Stripe hosted checkout. No transaction.'});return route.abort();}
 if(url.pathname.startsWith('/fake-upload/')){uploaded.add(url.pathname.slice('/fake-upload/'.length));return route.fulfill({status:200,body:'{}'});}
 if(url.pathname==='/api/intake'){
  const action=route.request().postDataJSON().action;if(action==='submit')submitRequests++;else finalizeRequests++;
  if(action==='submit'&&lostSubmit){lostSubmit=false;await route.fetch();return route.abort();}
  if(action==='finalize'&&lostFinalize){lostFinalize=false;await route.fetch();return route.abort();}
 }
 return route.continue();
});
async function fill(){const active=page.locator('.step.active');for(const input of await active.locator('input[required]:not([type=radio]):not([type=checkbox]),textarea[required]').all()){const type=await input.getAttribute('type');await input.fill(({email:'fake@example.invalid',tel:'5550100000',date:'2027-01-01',number:'5'})[type]||'Fake local story');}const names=await active.locator('input[type=radio][required]').evaluateAll(items=>[...new Set(items.map(i=>i.name))]);for(const name of names){await active.locator('input[type=radio]').evaluateAll((items,n)=>{items.find(i=>i.name===n).checked=true;},name);}for(const checkbox of await active.locator('input[type=checkbox][required]').all())await checkbox.check();}
const report=[];
try{
 for(const lang of ['en','es']){
  await page.goto(config.origin);await page.locator(`[data-language=${lang}]`).first().click();await page.locator('[data-t=personalizada]').click();
  while(await page.locator('#next').isVisible()){
   await fill();if(await page.locator('#photoInput').isVisible()){
    const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRFAAAAAASUVORK5CYII=','base64');
    await page.locator('#photoInput').setInputFiles({name:'fake.png',mimeType:'image/png',buffer});await page.locator('[data-cap="0"]').fill('Fake photo caption');
   }
   await page.locator('#next').click();
  }
  await fill();await page.locator('input[name=Paquete][value=slideshow]').locator('..').locator('span').first().click();await page.locator('#submit').click();
  if(lang==='en'){
   await page.locator('#err.show').waitFor();await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('#err').textContent.includes('FAKE')||!document.querySelector('#f').classList.contains('submitting'));assert.equal((await query('SELECT count(*)::int n FROM shia_intake.inquiries')).rows[0].n,1);
   await page.locator('#submit').click();
  }
  await page.locator('#done[open]').waitFor();assert.equal(await page.locator('#checkoutButton').isEnabled(),true);await page.screenshot({path:`/tmp/shia-intake-${lang}.png`});
  await page.locator('#checkoutButton').click();await page.waitForURL('https://checkout.stripe.com/**');report.push({language:lang,inquirySaved:true,checkoutOpened:true});
 }
 const inquiries=(await query('SELECT * FROM shia_intake.inquiries')).rows;assert.equal(inquiries.length,2);assert(inquiries.every(i=>i.state==='finalized'&&i.package_key==='slideshow'&&i.manifest[0].caption==='Fake photo caption'));assert.equal((await query('SELECT * FROM shia_intake.notifications')).rows.length,2);assert.equal(sessionsCreated,2);let alerts=0;const worker=new NotificationWorker({store,provider:{send:async()=>{alerts++;return 'fake-provider';}}});while(await worker.runOne()){}assert.equal(alerts,2);assert.deepEqual(errors,[]);
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/intake-browser-report.json',JSON.stringify({report,submitRequests,finalizeRequests,inquiries:inquiries.length,sessionsCreated,fakeAlerts:alerts,realExternalRequests:0,errors},null,2));console.log('Local intake/DB/checkout/worker browser checks passed in English and Spanish; lost responses recovered.');
}finally{await browser.close();await new Promise(r=>server.close(r));await db.close();}
