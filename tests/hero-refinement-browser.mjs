import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createApp } from '../server/app.js';
import { readConfig } from '../server/catalog.js';
import { Payments } from '../server/payments.js';
import { OCCASION_PHOTOS } from '../assets/js/occasion-photos.js';
const config=readConfig({}),server=createServer(createApp({config,payments:new Payments({config})}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('artifacts',{recursive:true});
const results=[],errors=[],blocked=[];
async function page(options={},missing=[]){
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',...options});
 await context.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==origin){blocked.push(url.pathname);return r.abort();}if(missing.includes('module')&&url.pathname.endsWith('/motion.js'))return r.abort();return r.continue();});
 await context.addInitScript(missing=>{if(missing.includes('waapi'))Element.prototype.animate=undefined;if(missing.includes('observer'))window.IntersectionObserver=undefined;},missing);
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin,{waitUntil:'networkidle'});return p;
}
const selected=p=>p.locator('.tcard').evaluateAll(es=>es.findIndex(e=>e.dataset.active==='true'));
async function expected(p,index){await p.waitForFunction(index=>Array.from(document.querySelectorAll('.tcard')).findIndex(e=>e.dataset.active==='true')===index,index);}
async function home(p){await p.mouse.move(0,0);await p.locator('.tcard').first().focus();await p.keyboard.press('Home');await expected(p,0);await p.waitForTimeout(500);}
async function overflow(p){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
try{
 for(const [name,width,height,mobile] of [['desktop',1440,1000,false],['tablet',768,1024,true],['mobile',390,844,true],['small-mobile',320,740,true]]){
  const p=await page({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
  await p.waitForFunction(()=>document.querySelector('.hero').dataset.heroMotion==='running');
  const initial=await p.locator('.record').evaluate(e=>getComputedStyle(e).rotate);await p.waitForTimeout(600);assert.notEqual(await p.locator('.record').evaluate(e=>getComputedStyle(e).rotate),initial);
  const pause=p.locator('#heroMotionToggle');await pause.focus();await p.keyboard.press('Space');assert.equal(await pause.getAttribute('aria-pressed'),'true');
  await p.locator('.record').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.ready)));const clock=await p.locator('.record').evaluate(e=>e.getAnimations()[0].currentTime);await p.waitForTimeout(350);assert.equal(await p.locator('.record').evaluate(e=>e.getAnimations()[0].currentTime),clock,'Paused motion must hold position');
  for(const locale of ['en','es']){
   await p.locator(`[data-language="${locale}"]`).first().click();assert.equal(await p.locator('html').getAttribute('lang'),locale);assert.equal(await pause.innerText(),locale==='en'?'Resume motion':'Reanudar movimiento');
   await overflow(p);await p.screenshot({path:`artifacts/refinement-${locale}-${name}-hero.png`});
  }
  await pause.click();assert.equal(await pause.getAttribute('aria-pressed'),'false');await p.waitForFunction(()=>document.querySelector('.hero').dataset.heroMotion==='running');
  const placement=await p.evaluate(()=>{const top=s=>document.querySelector(s).getBoundingClientRect().top+scrollY;return{hero:top('.hero'),intro:top('#proceso'),occasions:top('#ocasiones'),story:top('.story-band'),pricing:top('#paquetes'),faq:top('.faq-section'),introGap:top('#ocasiones')-(document.querySelector('#proceso').getBoundingClientRect().bottom+scrollY)};});
  assert(placement.hero<placement.intro&&placement.intro<placement.occasions&&placement.occasions<placement.story&&placement.story<placement.pricing&&placement.pricing<placement.faq);assert(placement.introGap<=30,'Selector must follow introduction without a long spacer');
  await p.locator('#tgrid').scrollIntoViewIfNeeded();await p.waitForTimeout(950);assert.equal(await p.locator('.hero').getAttribute('data-hero-motion'),'paused');await overflow(p);
  for(const locale of ['en','es']){
   await p.locator(`[data-language="${locale}"]`).first().click();await home(p);
   await p.screenshot({path:`artifacts/refinement-${locale}-${name}-occasions.png`});
   for(const [index,id] of Object.keys(OCCASION_PHOTOS).entries()){
    if(index){await p.locator('[data-carousel-next]').click();await expected(p,index);await p.waitForTimeout(500);}
    const image=p.locator(`[data-t="${id}"] .sleeve-photo`),photo=OCCASION_PHOTOS[id];assert.equal(await image.getAttribute('alt'),locale==='en'?photo.alt_en:photo.alt_es);assert.equal(await image.getAttribute('src'),photo.src);
    const loaded=await image.evaluate(async e=>{await e.decode();return{width:e.naturalWidth,height:e.naturalHeight};});assert.deepEqual(loaded,{width:photo.width,height:photo.height});await overflow(p);
    if(locale==='en'&&['desktop','small-mobile'].includes(name))await p.locator(`[data-t="${id}"] .sleeve-face`).screenshot({path:`artifacts/refinement-${name}-${id}-sleeve.png`});
   }
  }
  results.push({viewport:name,allTwelvePhotoLoads:true,englishSpanishAlts:true,uniquePhotoMappings:true});
  for(const b of await p.locator('.carousel-controls button').all()){const box=await b.boundingBox();assert(box.width>=64&&box.height>=64);assert.equal(await b.locator('svg').count(),1);assert(await b.getAttribute('aria-label'));}
  const axe=await new AxeBuilder({page:p}).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
  results.push({viewport:name,width,layeredMotion:true,pauseKeyboard:true,pauseLocalized:true,sectionOrder:placement,largeSvgArrows:true,noOverflow:true,axeViolations:0});await p.context().close();
 }
 for(const reducedMotion of ['no-preference','reduce']){
  const p=await page({reducedMotion});await p.locator('#tgrid').scrollIntoViewIfNeeded();await p.waitForTimeout(900);await home(p);
  const next=p.locator('[data-carousel-next]');await next.hover();await p.waitForTimeout(300);assert.equal(await selected(p),0,'Hover initial delay');await expected(p,1);await expected(p,2);await p.mouse.move(0,0);const stopped=await selected(p);await p.waitForTimeout(1100);assert.equal(await selected(p),stopped,'Leave cancels repeat immediately');
  await home(p);await next.focus();await p.waitForTimeout(1100);assert.equal(await selected(p),0,'Focus alone does not navigate');await p.keyboard.press('Enter');await expected(p,1);await p.waitForTimeout(950);assert.equal(await selected(p),1,'Keyboard activation moves once');
  await next.click();await expected(p,2);await p.waitForTimeout(1000);assert.equal(await selected(p),2,'Click moves once, not hover plus click');
  await next.hover();await p.mouse.move(0,0);await next.hover();await expected(p,3);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurStopped=await selected(p);await p.waitForTimeout(1100);assert.equal(await selected(p),blurStopped);await p.mouse.move(0,0);await next.hover();await expected(p,blurStopped+1);await next.dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});const pointerCancelled=await selected(p);await p.waitForTimeout(1100);assert.equal(await selected(p),pointerCancelled,'Pointer cancellation stops mouse repeat');
  await p.mouse.move(0,0);await p.locator('.tcard').nth(10).focus();await p.keyboard.press('End');await expected(p,11);assert(await next.isDisabled());await next.hover({force:true});await p.waitForTimeout(1100);assert.equal(await selected(p),11,'Edge never repeats');
  await p.mouse.move(0,0);const prev=p.locator('[data-carousel-prev]');await prev.hover();await expected(p,10);await p.locator('#showAdmin').click();const inactive=await selected(p);await p.waitForTimeout(1100);assert.equal(await selected(p),inactive,'Leaving customer context cancels repeat');
  results.push({reducedMotion,hoverDelay:true,hoverRepeat:true,leaveStops:true,focusDoesNotMove:true,keyboardOnce:true,clickOnce:true,blurStops:true,endStops:true,contextStops:true,mouseCancelStops:true});await p.context().close();
 }
 for(const width of [320,390])for(const reducedMotion of ['no-preference','reduce']){
  const p=await page({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion});await p.locator('#tgrid').scrollIntoViewIfNeeded();await p.waitForTimeout(900);await home(p);
  const session=await p.context().newCDPSession(p),box=await p.locator('[data-carousel-next]').boundingBox();const point={x:box.x+box.width/2,y:box.y+box.height/2};
  const start=()=>session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});const end=()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await start();await p.waitForTimeout(75);await end();await expected(p,1);await p.waitForTimeout(600);assert.equal(await selected(p),1,'Tap exactly once');
  await start();await expected(p,2);await expected(p,3);await end();const released=await selected(p);await p.waitForTimeout(1100);assert.equal(await selected(p),released,'Hold release has no extra synthetic click');
  await start();await expected(p,4);await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});const cancelled=await selected(p);await p.waitForTimeout(1100);assert.equal(await selected(p),cancelled,'Touch cancel stops');
  await start();await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-30,y:point.y}]});await end();await p.waitForTimeout(700);assert.equal(await selected(p),cancelled,'Leaving press slop cancels hold and click');await start();await p.waitForTimeout(75);await end();await expected(p,cancelled+1);
  await home(p);const track=await p.locator('#tgrid').boundingBox();await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:track.x+track.width*.85,y:track.y+track.height*.5}]});for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:track.x+track.width*(.85-i*.08),y:track.y+track.height*.5}]});await end();await p.waitForFunction(()=>document.querySelector('#tgrid').scrollLeft>20);await overflow(p);
  results.push({width,reducedMotion,tapOnce:true,touchHoldRepeat:true,releaseStopsWithoutDoubleClick:true,cancelStops:true,moveCancels:true,nativeSwipe:true,noOverflow:true});await p.context().close();
 }
 const reduced=await page({reducedMotion:'reduce'});assert.equal(await reduced.locator('.hero').getAttribute('data-hero-motion'),'reduced');assert(await reduced.locator('#heroMotionToggle').isHidden());assert.equal(await reduced.evaluate(()=>document.getAnimations().length),0);await reduced.context().close();
 const live=await page();await live.emulateMedia({reducedMotion:'reduce'});await live.waitForFunction(()=>document.querySelector('.hero').dataset.heroMotion==='reduced');assert.equal(await live.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);await live.context().close();
 const finite=await page();await finite.waitForFunction(()=>document.querySelector('.hero').dataset.heroMotion==='finished');assert(await finite.locator('#heroMotionToggle').isHidden());await finite.context().close();
 for(const missing of [['waapi'],['observer'],['module']]){const p=await page({},missing);assert(await p.locator('#heroTitle').isVisible());assert.equal(await p.locator('.tcard').count(),12);await overflow(p);await p.context().close();}
 const nojs=await page({javaScriptEnabled:false});for(const [id,photo] of Object.entries(OCCASION_PHOTOS)){const image=nojs.locator(`[data-t="${id}"] img`);assert.equal(await image.getAttribute('src'),photo.src);await image.scrollIntoViewIfNeeded();assert.equal(await image.evaluate(async e=>{await e.decode();return e.naturalWidth;}),photo.width);}assert(await nojs.locator('#heroMotionToggle').isHidden());assert.equal(await nojs.locator('.tcard').count(),12);assert(await nojs.locator('[data-carousel-next]').isDisabled());await nojs.locator('#tgrid').scrollIntoViewIfNeeded();await overflow(nojs);await nojs.screenshot({path:'artifacts/refinement-no-js.png'});await nojs.context().close();
 results.push({reducedMotion:true,liveReducedMotion:true,finiteEightSecondMotion:true,progressiveFallbacks:true,noJsVisible:true});
 const recording=await page(),cdp=await recording.context().newCDPSession(recording),frames=[],frameTimes=[];await rm('artifacts/refinement-motion-frames',{recursive:true,force:true});await mkdir('artifacts/refinement-motion-frames',{recursive:true});
 cdp.on('Page.screencastFrame',e=>{frameTimes.push(e.metadata.timestamp);const index=frames.length;frames.push(writeFile(`artifacts/refinement-motion-frames/frame-${String(index).padStart(4,'0')}.jpg`,Buffer.from(e.data,'base64')));void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId});});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1440,maxHeight:1000,everyNthFrame:1});await recording.waitForTimeout(3200);await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(frames);assert(frames.length>5);const fps=(frames.length-1)/(frameTimes.at(-1)-frameTimes[0]);assert(fps>0&&fps<=120);execFileSync('/usr/bin/ffmpeg',['-y','-framerate',String(fps),'-i','artifacts/refinement-motion-frames/frame-%04d.jpg','-frames:v',String(frames.length),'-fps_mode','passthrough','-c:v','libx264','-pix_fmt','yuv420p','artifacts/refinement-hero-motion.mp4'],{stdio:'ignore'});const encoded=JSON.parse(execFileSync('/usr/bin/ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','json','artifacts/refinement-hero-motion.mp4'],{encoding:'utf8'}));assert.equal(Number(encoded.streams[0].nb_frames),frames.length,'Recording must encode every current capture frame');await recording.context().close();
 assert.deepEqual(errors,[]);const report={results,browserErrors:errors,blockedExternalRequests:blocked,realOrdersSubmitted:0,photography:'TWELVE_VERIFIED_DISTINCT_SELF_HOSTED_ASSETS',recordingFrames:frames.length,recordingSeconds:frames.length/fps};await writeFile('artifacts/hero-refinement-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
