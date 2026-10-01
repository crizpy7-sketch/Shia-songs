import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createApp } from '../server/app.js';
import { readConfig } from '../server/catalog.js';
import { Payments } from '../server/payments.js';
const config=readConfig({}), server=createServer(createApp({config,payments:new Payments({config})}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('artifacts',{recursive:true});
const results=[], errors=[], requests=[];
async function context(options={}){
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block',...options});
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());if(u.origin===origin)return r.continue();
  requests.push({path:u.pathname,method:r.request().method()});
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'*'};
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  if(u.pathname.endsWith('/shia-order-intake')){
   const b=r.request().postDataJSON();assert(['submit','finalize'].includes(b.action));
   if(b.action==='submit'){
    assert.equal(b.answers['Paquete elegido'],'Canciones + letras · $20 USD');
    assert(['Español','Inglés','Bilingüe'].includes(b.answers.Idioma));
    results.push({mockSubmitLocale:await c.pages()[0].locator('html').getAttribute('lang'),canonicalSongLanguage:b.answers.Idioma});
    return r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({order_id:'559a7da0-6206-4eb0-8e53-a78d48994209',order_number:'QA-ONLY',submission_token:'mock',uploads:[]})});
   }
   return r.fulfill({status:200,headers,contentType:'application/json',body:'{"order_number":"QA-ONLY"}'});
  }
  if(u.pathname.endsWith('/auth/v1/user'))return r.fulfill({status:401,headers,contentType:'application/json',body:'{"message":"No mock session"}'});
  return r.abort();
 });
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;
}
const answers=p=>p.locator('#f').evaluate(f=>Array.from(new FormData(f)).filter(([,v])=>typeof v==='string'));
async function language(p,locale){const host=await p.locator("#done[open]").count()?p.locator("#done[open]"):p;await host.locator(`[data-language="${locale}"]`).first().click();assert.equal(await p.locator('html').getAttribute('lang'),locale);}
async function fill(p){
 const active=p.locator('.step.active');
 for(const e of await active.locator('input[required]:not([type=radio]):not([type=checkbox]),textarea[required]').all()){
  const type=await e.getAttribute('type');await e.fill(({number:'5',date:'2027-01-01',email:'qa@example.invalid',tel:'5550100000'})[type]||'English / Español: My unchanged answer 123');
 }
 const names=await active.locator('input[type=radio][required]').evaluateAll(es=>[...new Set(es.map(e=>e.name))]);
 for(const name of names){const group=active.locator('input[type=radio]').and(active.locator(`[name="${name}"]`));if(!await group.evaluateAll(es=>es.some(e=>e.checked)))await group.first().locator('..').locator('span').first().click();}
 for(const e of await active.locator('input[type=checkbox][required]').all())await e.check();
}
async function noOverflow(p){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflows viewport');}
try{
 const c=await context(),p=await c.newPage();await p.goto(origin,{waitUntil:'networkidle'});assert.equal(await p.locator('html').getAttribute('lang'),'en');
 const ids=await p.locator('.tcard').evaluateAll(es=>es.map(e=>e.dataset.t));assert.equal(ids.length,12);
 for(const locale of ['en','es']){
  await language(p,locale);await p.screenshot({path:`artifacts/vinyl-${locale}-desktop-hero.png`});
  await p.locator('#tgrid').scrollIntoViewIfNeeded();await p.screenshot({path:`artifacts/vinyl-${locale}-desktop-carousel.png`});
  for(const id of ids){
   console.log(`Checking ${locale} questionnaire ${id}`);
   await p.locator(`[data-t="${id}"]`).click();assert(await p.locator('#formArea').isVisible(),`Opening ${id} must show form`);let steps=0;await p.locator('#next').click();assert(await p.locator('#err').isVisible());
   while(await p.locator('#next').isVisible()){
    await fill(p);const before=await answers(p),heading=await p.locator('.step.active h2').innerText();
    await language(p,locale==='en'?'es':'en');assert.deepEqual(await answers(p),before,`${id}: toggle erased answer`);
    await language(p,locale);assert.deepEqual(await answers(p),before);assert.equal(await p.locator('.step.active h2').innerText(),heading);
    if(steps===0){await p.locator('input[name="Idioma"][value="Inglés"]').locator('..').locator('span').first().click();await language(p,'es');assert(await p.locator('input[name="Idioma"][value="Inglés"]').isChecked());await language(p,locale);await p.locator('#save').click();const raw=await p.evaluate(id=>localStorage.getItem(`shia-form-v2:${id}`),id);await language(p,locale==='en'?'es':'en');assert.equal(await p.evaluate(id=>localStorage.getItem(`shia-form-v2:${id}`),id),raw);await language(p,locale);}
    if(id===ids[0]&&steps===0)await p.screenshot({path:`artifacts/vinyl-${locale}-desktop-form.png`,fullPage:true});
    await p.locator('#next').click();assert.equal(await p.locator('.step.active h2').evaluate(e=>e===document.activeElement),true);assert(++steps<20);
   }
   await fill(p);const before=await answers(p);await language(p,locale==='en'?'es':'en');assert.deepEqual(await answers(p),before);await language(p,locale);
   assert(await p.locator('#review').isVisible());await noOverflow(p);
   if(id===ids[0]){const axe=await new AxeBuilder({page:p}).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);await p.locator('#submit').click();await p.locator('#done[open]').waitFor();assert(await p.locator('#checkoutButton').isDisabled());await language(p,locale==='en'?'es':'en');assert.match(await p.locator('#doneMessage').innerText(),/QA-ONLY/);assert(await p.locator('#checkoutButton').isDisabled());await language(p,locale);await p.locator('#close').click();}
   await p.locator('#changeTemplate').click();
   // Saved draft must restore canonical keys/values without interface locale coercion.
   if(id!==ids[0]){await p.locator(`[data-t="${id}"]`).click();assert.deepEqual(await answers(p),before);await language(p,locale==='en'?'es':'en');assert.deepEqual(await answers(p),before);await language(p,locale);await p.locator('#clearDraft').click();await p.locator('#changeTemplate').click();}
   results.push({locale,template:id,steps:steps+1,validation:true,midFormPreservation:true,draftRestoration:id!==ids[0],focusedSteps:true});
  }
 }
 for(const locale of ['en','es']){await language(p,locale);await p.goto(`${origin}/payment-status.html`,{waitUntil:'networkidle'});assert.equal(await p.locator('html').getAttribute('lang'),locale);assert.match(await p.locator('h1').innerText(),locale==='en'?/Thank you for sharing/:/Gracias por compartir/);await p.screenshot({path:`artifacts/vinyl-${locale}-payment-status.png`,fullPage:true});await p.reload({waitUntil:'networkidle'});assert.equal(await p.locator('html').getAttribute('lang'),locale);}results.push({paymentStatusBothLocales:true,localePersistsReload:true});
 await c.close();
 const mobile=await context({viewport:{width:320,height:740},isMobile:true,hasTouch:true}),m=await mobile.newPage();await m.goto(origin,{waitUntil:'networkidle'});
 for(const locale of ['en','es']){await language(m,locale);await noOverflow(m);await m.screenshot({path:`artifacts/vinyl-${locale}-mobile-hero.png`});await m.locator('#tgrid').scrollIntoViewIfNeeded();await m.screenshot({path:`artifacts/vinyl-${locale}-mobile-carousel.png`});await m.locator('[data-t="aniversario"]').click();await m.screenshot({path:`artifacts/vinyl-${locale}-mobile-form.png`,fullPage:true});await noOverflow(m);await m.locator('#changeTemplate').click();}
 await m.locator('#tgrid').scrollIntoViewIfNeeded();await m.locator('#tgrid').evaluate(e=>e.scrollLeft=0);await m.waitForTimeout(300);
 const box=await m.locator('#tgrid').boundingBox(),session=await mobile.newCDPSession(m),before=await m.locator('#tgrid').evaluate(e=>e.scrollLeft);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.85,y:box.y+box.height*.5}]});
 for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*(.85-i*.08),y:box.y+box.height*.5}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForFunction(previous=>document.querySelector('#tgrid').scrollLeft>previous+20,before);
 results.push({nativeTouchSwipe:true,width:320,noPageOverflow:true});
 for(const selector of ['[data-carousel-prev]','[data-carousel-next]']){const b=m.locator(selector);assert.equal(await b.locator('svg[aria-hidden="true"]').count(),1);assert(await b.getAttribute('aria-label'));}
 await m.locator('[data-carousel-next]').click();assert.equal(await m.locator('[data-carousel-next]').evaluate(e=>e===document.activeElement),true);
 await m.locator('.tcard').first().focus();await m.keyboard.press('End');await m.waitForFunction(()=>document.querySelector('.tcard:last-child').dataset.active==='true');assert(await m.locator('[data-carousel-next]').isDisabled());assert.equal(await m.locator('.tcard').last().evaluate(e=>e===document.activeElement),true);await m.keyboard.press('Home');await m.waitForFunction(()=>document.querySelector('.tcard').dataset.active==='true');assert(await m.locator('[data-carousel-prev]').isDisabled());assert.equal(await m.locator('.tcard').first().evaluate(e=>e===document.activeElement),true);await m.keyboard.press('ArrowRight');assert.equal(await m.locator('.tcard').nth(1).evaluate(e=>e===document.activeElement),true);await noOverflow(m);
 await m.locator('[data-t="aniversario"]').click();while(!await m.locator('#photoInput').isVisible()){await fill(m);await m.locator('#next').click();}
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRFAAAAAASUVORK5CYII=', 'base64');
 await m.locator('#photoInput').setInputFiles([{name:'unchanged-one.png',mimeType:'image/png',buffer},{name:'unchanged-two.png',mimeType:'image/png',buffer}]);await m.locator('[data-cap="0"]').fill('Caption original español / English');
 const refs=await m.locator('.thumb img').evaluateAll(es=>es.map(e=>e.src));await language(m,'es');assert.deepEqual(await m.locator('.thumb img').evaluateAll(es=>es.map(e=>e.src)),refs);assert.equal(await m.locator('[data-cap="0"]').inputValue(),'Caption original español / English');await language(m,'en');assert.deepEqual(await m.locator('.thumb img').evaluateAll(es=>es.map(e=>e.src)),refs);
 await m.locator('[data-down="0"]').click();assert.equal(await m.locator('[data-cap="1"]').inputValue(),'Caption original español / English');await language(m,'es');assert.equal(await m.locator('[data-cap="1"]').inputValue(),'Caption original español / English');await m.locator('[data-rm="0"]').click();assert.equal(await m.locator('.thumb').count(),1);assert.equal(await m.locator('[data-cap="0"]').inputValue(),'Caption original español / English');
 results.push({svgControls:true,keyboardEndHomeArrow:true,controlFocusRetained:true,photoReferencesAndCaptionsPreserved:true,reorderRemove:true});await mobile.close();
 // Snap geometry must select every immediate neighbor at both motion preferences,
 // including after returning from a form. Transformed decorative faces must not
 // alter the native scroll item's snap position.
 for(const reducedMotion of ['no-preference','reduce'])for(const [viewport,width,height] of [['desktop',1440,1000],['mobile',320,740]]){
  const navContext=await context({viewport:{width,height},isMobile:viewport==='mobile',hasTouch:viewport==='mobile',reducedMotion}),nav=await navContext.newPage();await nav.goto(origin,{waitUntil:'networkidle'});await nav.locator('#tgrid').scrollIntoViewIfNeeded();await nav.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
  async function selected(index){
   await nav.waitForFunction(index=>document.querySelectorAll('.tcard')[index].dataset.active==='true',index);
   // A temporary intermediate match is insufficient: wait until native smooth
   // scrolling and snapping have settled before checking the exact neighbor.
   await nav.locator('#tgrid').evaluate(track=>new Promise(resolve=>{let previous=track.scrollLeft,stable=0;const started=performance.now();function check(){const now=track.scrollLeft;stable=Math.abs(now-previous)<.25?stable+1:0;previous=now;if(stable>=12&&performance.now()-started>350)resolve();else requestAnimationFrame(check);}requestAnimationFrame(check);}));
   assert.equal(await nav.locator('.tcard[data-active="true"]').getAttribute('data-t'),ids[index],`${viewport} ${reducedMotion}: expected exact adjacent sleeve ${ids[index]}`);await noOverflow(nav);
  }
  await nav.locator('.tcard').first().focus();await nav.keyboard.press('Home');await selected(0);assert(await nav.locator('[data-carousel-prev]').isDisabled());
  for(let i=1;i<12;i++){const previousScroll=await nav.locator('#tgrid').evaluate(e=>e.scrollLeft);await nav.locator('[data-carousel-next]').click();await selected(i);assert((await nav.locator('#tgrid').evaluate(e=>e.scrollLeft))>previousScroll,'Next must move native track');assert.equal(await nav.locator(i===11?'[data-carousel-prev]':'[data-carousel-next]').evaluate(e=>e===document.activeElement),true,'Focus remains on an enabled carousel control');}
  assert(await nav.locator('[data-carousel-next]').isDisabled());
  const label=await nav.locator('.tcard').last().locator('b').innerText();await nav.locator('.tcard').last().click();assert(await nav.locator('#formArea').isVisible());assert.equal(await nav.locator('#formBadge').innerText(),label);await nav.locator('#changeTemplate').click();await nav.locator('#tgrid').scrollIntoViewIfNeeded();await selected(11);
  for(let i=10;i>=0;i--){const previousScroll=await nav.locator('#tgrid').evaluate(e=>e.scrollLeft);await nav.locator('[data-carousel-prev]').click();await selected(i);assert((await nav.locator('#tgrid').evaluate(e=>e.scrollLeft))<previousScroll,'Previous must move native track');assert.equal(await nav.locator(i===0?'[data-carousel-next]':'[data-carousel-prev]').evaluate(e=>e===document.activeElement),true,'Focus remains on an enabled carousel control');}
  assert(await nav.locator('[data-carousel-prev]').isDisabled());
  const firstLabel=await nav.locator('.tcard').first().locator('b').innerText();await nav.locator('.tcard').first().click();assert(await nav.locator('#formArea').isVisible());assert.equal(await nav.locator('#formBadge').innerText(),firstLabel);await nav.locator('#changeTemplate').click();await nav.locator('#tgrid').scrollIntoViewIfNeeded();await selected(0);await nav.locator('[data-carousel-next]').click();await selected(1);
  results.push({viewport,reducedMotion,allAdjacentNext:11,allAdjacentPrevious:11,formReturnBothEndpoints:true,exactSelectionAfterSnap:true,controlFocusRetained:true});await navContext.close();
 }
 const motionContext=await context({reducedMotion:'no-preference'}),motion=await motionContext.newPage();await motion.goto(origin,{waitUntil:'networkidle'});
 const capture=await motionContext.newCDPSession(motion),frames=[];await mkdir('artifacts/vinyl-motion-frames',{recursive:true});
 capture.on('Page.screencastFrame',e=>{const n=frames.length;frames.push(writeFile(`artifacts/vinyl-motion-frames/frame-${String(n).padStart(4,'0')}.jpg`,Buffer.from(e.data,'base64')));capture.send('Page.screencastFrameAck',{sessionId:e.sessionId});});
 await capture.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1440,maxHeight:1000,everyNthFrame:1});await motion.locator('#ocasiones').scrollIntoViewIfNeeded();await motion.waitForFunction(()=>document.querySelector('#ocasiones').dataset.trainArrived==='true');await motion.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));await motion.waitForTimeout(250);await capture.send('Page.stopScreencast');await Promise.all(frames);
 assert(frames.length>3,'Recording must contain actual animation frames');execFileSync('/usr/bin/ffmpeg',['-y','-framerate','30','-i','artifacts/vinyl-motion-frames/frame-%04d.jpg','-c:v','libx264','-pix_fmt','yuv420p','artifacts/vinyl-train-arrival.mp4'],{stdio:'ignore'});
 const selected=motion.locator('.tcard[data-active="true"]');assert.equal(await selected.count(),1);const unselected=motion.locator('.tcard:not([data-active="true"])').first();assert.match(await unselected.locator('.sleeve-face').evaluate(e=>getComputedStyle(e).transform),/matrix3d/);assert(await selected.locator('b').isVisible());
 results.push({trainArrival:true,motionRecordingFrames:frames.length,angled3dSleeves:true,selectedReadable:true});await motionContext.close();
 assert.deepEqual(errors,[]);const report={results,browserErrors:errors,mockedExternalRequests:requests,realOrdersSubmitted:0};await writeFile('artifacts/vinyl-bilingual-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
