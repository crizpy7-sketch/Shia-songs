import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createApp } from '../server/app.js';
import { readConfig } from '../server/catalog.js';
import { Payments } from '../server/payments.js';

const config = readConfig({});
const server = createServer(createApp({ config, payments: new Payments({ config }) }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const reports = [];
const errors = [];
const blockedExternal = [];
const sections = '.process-section, .story-band, .occasions-section, .pricing-section, .faq-section, .closing-section';
await mkdir('artifacts', { recursive: true });

async function makePage(options = {}, unavailable = []) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', serviceWorkers: 'block', ...options });
  // This route is installed before navigation. No external service can be contacted.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      blockedExternal.push(url.pathname);
      return route.abort();
    }
    if (unavailable.includes('motion-module') && url.pathname.endsWith('/motion.js')) return route.abort();
    return route.continue();
  });
  await context.addInitScript(missing => {
    window.__motionCalls = [];
    if (missing.includes('observer')) window.IntersectionObserver = undefined;
    if (missing.includes('waapi')) Element.prototype.animate = undefined;
    else {
      const nativeAnimate = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        window.__motionCalls.push({ section: this.matches('.process-section, .story-band, .occasions-section, .pricing-section, .faq-section, .closing-section'), target: this.className, duration: options.duration });
        return nativeAnimate.call(this, frames, options);
      };
    }
  }, unavailable);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}

async function visibleContent(page) {
  assert.equal(await page.locator('html').getAttribute('lang'), 'es');
  assert(await page.locator('#heroTitle').isVisible());
  assert.match(await page.locator('.price-card').nth(0).innerText(), /\$20/);
  assert.match(await page.locator('.price-card').nth(1).innerText(), /\$50/);
  for (const section of await page.locator(sections).all()) {
    assert(await section.isVisible(), 'Motion must never hide unenhanced content');
    assert.equal(await section.evaluate(el => getComputedStyle(el).opacity), '1');
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await makePage({ viewport: { width, height } });
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert(await page.evaluate(() => window.__motionCalls.some(call => call.duration === 680)), 'Short hero entrance executes in a real browser');
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
    await page.waitForFunction(() => scrollY === 0, null, { timeout: 10000 });
    await page.screenshot({ path: `artifacts/motion-${name}-hero.png` });
    for (const section of await page.locator(sections).all()) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForFunction(el => el.dataset.motionRevealed === 'true', await section.elementHandle());
    }
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
    assert.equal(await page.locator('[data-motion-revealed="true"]').count(), 6);
    const firstCount = await page.evaluate(() => window.__motionCalls.filter(call => call.section).length);
    assert.equal(firstCount, 6);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    for (const section of await page.locator(sections).all()) await section.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => window.__motionCalls.filter(call => call.section).length), firstCount, 'Sections animate once even after revisit');
    await visibleContent(page);
    await page.locator('[data-t="aniversario"]').click();
    assert.equal(await page.locator('.step.active h2').evaluate(el => el === document.activeElement), true, 'Opening form focuses its first heading');
    assert(await page.evaluate(() => window.__motionCalls.some(call => call.duration === 280)), 'Form entrance executes');
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
    await page.waitForFunction(() => scrollY === 0, null, { timeout: 10000 });
    const settledLayout = await page.evaluate(() => ({
      navBottom: document.querySelector('.topnav').getBoundingClientRect().bottom,
      brandTop: document.querySelector('#formArea .brand').getBoundingClientRect().top,
      headingTop: document.querySelector('.step.active h2').getBoundingClientRect().top,
      skipBottom: document.querySelector('.skip-link').getBoundingClientRect().bottom,
    }));
    assert(settledLayout.brandTop >= settledLayout.navBottom, `${name}: settled form brand overlaps navigation`);
    assert(settledLayout.headingTop >= settledLayout.navBottom, `${name}: settled step heading overlaps navigation`);
    assert(settledLayout.skipBottom <= 0, `${name}: unfocused skip link is partially visible`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} form overflow`);
    await page.screenshot({ path: `artifacts/motion-${name}-form.png`, fullPage: true });
    reports.push({ viewport: name, heroEntrance: true, sectionReveals: 6, revealOnce: true, stepMotion: true, stepFocus: true, noOverflow: true });
    await page.context().close();
  }

  const reduced = await makePage({ reducedMotion: 'reduce' });
  await reduced.goto(origin, { waitUntil: 'networkidle' });
  await visibleContent(reduced);
  await reduced.locator('[data-t="aniversario"]').click();
  assert.equal(await reduced.evaluate(() => window.__motionCalls.length), 0, 'Initial reduced preference prevents JavaScript entrances');
  assert.equal(await reduced.locator('#next').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  assert.equal(await reduced.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
  reports.push({ initialReducedMotion: true, noJavaScriptAnimations: true, noCSSTransitions: true, noSmoothScroll: true });
  await reduced.context().close();

  const dynamic = await makePage();
  await dynamic.goto(origin, { waitUntil: 'domcontentloaded' });
  await dynamic.waitForFunction(() => window.__motionCalls.length > 0);
  assert(await dynamic.evaluate(() => document.getAnimations().some(a => a.playState === 'running')));
  await dynamic.emulateMedia({ reducedMotion: 'reduce' });
  await dynamic.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  assert.equal(await dynamic.locator('[data-motion-revealed="true"]').count(), 6);
  const countAtReduction = await dynamic.evaluate(() => window.__motionCalls.length);
  await dynamic.locator('[data-t="aniversario"]').click();
  assert.equal(await dynamic.evaluate(() => window.__motionCalls.length), countAtReduction, 'Live reduced preference blocks form animation');
  reports.push({ dynamicReducedMotion: true, cancelledRunningAnimations: true, allContentVisible: true });
  await dynamic.context().close();

  for (const unavailable of [['observer'], ['waapi'], ['observer', 'waapi'], ['motion-module']]) {
    const page = await makePage({}, unavailable);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
    await visibleContent(page);
    assert.equal(await page.locator('.tcard').count(), 12);
    await page.locator('[data-t="aniversario"]').click();
    assert(await page.locator('.step.active').isVisible());
    assert.equal(await page.locator('.step.active h2').evaluate(el => el === document.activeElement), true);
    await page.locator('#next').click();
    assert(await page.locator('#err').isVisible(), 'Native form validation still runs without motion');
    reports.push({ unavailable, contentVisible: true, formWorks: true });
    await page.context().close();
  }

  const noJS = await makePage({ javaScriptEnabled: false });
  await noJS.goto(origin, { waitUntil: 'networkidle' });
  await visibleContent(noJS);
  assert.match(await noJS.locator('noscript').innerText(), /Active JavaScript/);
  await noJS.getByRole('link', { name: 'Ver paquetes' }).click();
  assert.equal(new URL(noJS.url()).hash, '#paquetes');
  await noJS.locator('.faq-list summary').first().click();
  assert.equal(await noJS.locator('.faq-list details').first().getAttribute('open'), '');
  await noJS.screenshot({ path: 'artifacts/no-js-landing.png', fullPage: true });
  reports.push({ javaScriptDisabled: true, contentVisible: true, honestFormGuidance: true, anchorNavigation: true, nativeFAQ: true });
  await noJS.context().close();

  assert.deepEqual(errors, []);
  const report = { results: reports, browserErrors: errors, blockedExternalRequests: blockedExternal, realOrdersSubmitted: 0 };
  await writeFile('artifacts/motion-browser-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
