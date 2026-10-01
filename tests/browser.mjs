import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { readConfig } from '../server/catalog.js';
import { Payments } from '../server/payments.js';
const config=readConfig({});const server=createServer(createApp({config,payments:new Payments({config})}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],externals=[],results=[];const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
let submitted=0,finalized=0;
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin===origin)return route.continue();
 externals.push(url.pathname);
 if(url.pathname.endsWith('/functions/v1/shia-order-intake')){const body=route.request().postDataJSON();if(body.action==='submit'){submitted++;assert.equal(body.answers['Paquete elegido'],'Canciones + letras · $20 USD');return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({order_id:'559a7da0-6206-4eb0-8e53-a78d48994209',order_number:'TEST-ONLY',submission_token:'mock-token',uploads:[]})});}if(body.action==='finalize'){finalized++;return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({order_number:'TEST-ONLY'})});}}
 if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:401,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"message":"No test session"}'});
 return route.abort();
});
try{
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['small-mobile',320,740]]){
  await page.setViewportSize({width,height});await page.goto(origin,{waitUntil:'networkidle'});await page.locator('.tcard').first().waitFor();assert.equal(await page.locator('.tcard').count(),12);assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} horizontal overflow`);
  await page.screenshot({path:`artifacts/${name}.png`,fullPage:true});results.push({viewport:name,loads:true,images:true,noOverflow:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin,{waitUntil:'networkidle'});await page.screenshot({path:'artifacts/desktop-hero.png'});const landingAxe=await new AxeBuilder({page}).analyze();results.push({axeLanding:landingAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 const templates=await page.locator('.tcard').evaluateAll(items=>items.map(x=>x.dataset.t));
 async function fillRequired(){const scope=page.locator('.step.active');for(const input of await scope.locator('input[required]:not([type=radio]):not([type=checkbox]),textarea[required]').all()){const type=await input.getAttribute('type');await input.fill(type==='number'?'5':type==='date'?'2027-01-01':type==='email'?'qa@example.invalid':type==='tel'?'5550100000':'Historia de prueba local');}const radioNames=await scope.locator('input[type=radio][required]').evaluateAll(items=>[...new Set(items.map(i=>i.name))]);for(const name of radioNames)await scope.locator(`input[type=radio][name="${name.replaceAll('"','\\"')}"]`).first().check();for(const checkbox of await scope.locator('input[type=checkbox][required]').all())await checkbox.check();}
 for(const id of templates){
  await page.locator(`[data-t="${id}"]`).click();assert.equal(await page.locator('.step.active').count(),1);assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0);
  if(id===templates[0]){await page.locator('#next').click();assert(await page.locator('#err').isVisible());await fillRequired();await page.locator('#save').click();assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),1);await page.locator('#clearDraft').click();assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0);await page.screenshot({path:'artifacts/form-desktop.png'});}
  let steps=1;
  while(await page.locator('#next').isVisible()){await fillRequired();await page.locator('#next').click();steps++;assert(steps<20);}
  await fillRequired();assert(await page.locator('#review').isVisible());
  if(id===templates[0]){const formAxe=await new AxeBuilder({page}).analyze();results.push({axeForm:formAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});await page.locator('#submit').click();await page.locator('#done[open]').waitFor();assert.match(await page.locator('#doneMessage').innerText(),/TEST-ONLY/);assert.equal(await page.locator('#checkoutButton').isDisabled(),true);await page.screenshot({path:'artifacts/received-dialog.png'});await page.locator('#close').click();}
  await page.locator('#changeTemplate').click();results.push({template:id,steps,requiredValidation:true});
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-t="aniversario"]').click();await page.screenshot({path:'artifacts/form-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#brandHome').click();await page.locator('#footerAdmin').click();await page.locator('#adminAuth').waitFor();const adminAxe=await new AxeBuilder({page}).analyze();results.push({axeAdmin:adminAxe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});await page.screenshot({path:'artifacts/admin-mobile.png',fullPage:true});assert.equal(await page.locator('#signupBtn').count(),0);
 assert.equal(submitted,1);assert.equal(finalized,1);assert.deepEqual(errors,[]);assert.equal(externals.filter(x=>!x.includes('shia-order-intake')&&!x.includes('/auth/v1/user')).length,0);
 const report={results,browserErrors:errors,externalRequests:externals,mockedSubmissions:submitted,mockedFinalizations:finalized,realOrdersSubmitted:0};await writeFile('artifacts/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 const violations=results.flatMap(r=>r.axeLanding||r.axeForm||r.axeAdmin||[]);assert.equal(violations.length,0,'Accessibility violations need fixing');
}finally{await browser.close();await new Promise(r=>server.close(r));}
