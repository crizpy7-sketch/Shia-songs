import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { buildSync } from 'esbuild';

const html = await readFile('index.html','utf8');
const bundle = buildSync({entryPoints:['assets/js/brand-film.js'],bundle:true,write:false,format:'iife'}).outputFiles[0].text;
const settle = () => new Promise(resolve=>setTimeout(resolve,0));

async function setup({reduce=false}={}) {
  const dom = new JSDOM(html,{url:'https://example.invalid/Shia-songs/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,states=new WeakMap(),calls=[],listeners=new Set(),frames=new Map();
  let reduced=reduce,hidden=false,observer,frameId=0;
  const state = video => {if(!states.has(video))states.set(video,{paused:true});return states.get(video);};
  Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return state(this).paused;}});
  Object.defineProperty(w.HTMLMediaElement.prototype,'ended',{get(){return this.currentTime>=15;}});
  w.HTMLMediaElement.prototype.play=async function(){state(this).paused=false;calls.push({id:this.id,source:this.querySelector('source')?.getAttribute('src'),muted:this.muted});this.dispatchEvent(new w.Event('play'));};
  w.HTMLMediaElement.prototype.pause=function(){if(state(this).paused)return;state(this).paused=true;this.dispatchEvent(new w.Event('pause'));};
  w.HTMLMediaElement.prototype.load=function(){state(this).paused=true;this.currentTime=0;this.dispatchEvent(new w.Event('loadedmetadata'));};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};
  w.cancelAnimationFrame=id=>frames.delete(id);
  w.matchMedia=()=>({get matches(){return reduced;},addEventListener:(type,fn)=>listeners.add(fn)});
  Object.defineProperty(d,'hidden',{get:()=>hidden});
  w.IntersectionObserver=class{constructor(fn){observer=fn;}observe(){}disconnect(){}};
  const hero=d.getElementById('heroFilm'),story=d.getElementById('storyFilm');hero.muted=true;
  w.eval(bundle);await settle();
  return {dom,w,d,hero,story,calls,frames,
    hide(value){hidden=value;d.dispatchEvent(new w.Event('visibilitychange'));},
    visible(value){observer([{isIntersecting:value}]);},
    reduce(value){reduced=value;for(const fn of listeners)fn({matches:value});}
  };
}

test('Reduced motion prevents autoplay; explicit playback and end-of-film replay remain available',async()=>{
  const a=await setup({reduce:true});
  try {
    assert.equal(a.calls.length,0);assert(a.hero.paused);
    assert.equal(a.d.getElementById('filmPause').getAttribute('aria-label'),'Resume film');
    a.d.getElementById('filmPause').click();await settle();assert(!a.hero.paused);
    a.hero.currentTime=15;a.hero.pause();a.hero.dispatchEvent(new a.w.Event('ended'));
    assert.equal(a.d.getElementById('filmPause').getAttribute('aria-label'),'Replay film');
    assert(!a.d.getElementById('filmReplayIcon').hasAttribute('hidden'));
    a.d.getElementById('filmPause').click();await settle();assert.equal(a.hero.currentTime,0);assert(!a.hero.paused);
  } finally {a.dom.window.close();}
});

test('Film source, caption labels and playback position follow the language switch in both players',async()=>{
  const a=await setup();
  try {
    assert(!a.hero.paused);assert(a.hero.muted,'Autoplay must be silent');
    a.hero.currentTime=7.6;a.hero.dispatchEvent(new a.w.Event('timeupdate'));
    a.w.ShiaI18n.setLanguage('es');await settle();
    assert.equal(a.hero.querySelector('source').getAttribute('src'),'assets/media/shia-story-es.mp4');
    assert.equal(a.hero.currentTime,7.6);assert(!a.hero.paused);
    assert.equal(a.d.getElementById('filmPhase').textContent,'Una emoción');
    assert.equal(a.d.getElementById('filmPause').getAttribute('aria-label'),'Pausar película');
    a.d.getElementById('filmOpen').click();await settle();assert(a.d.getElementById('brandFilmDialog').open);assert(a.hero.paused);assert(!a.story.paused);assert(!a.story.muted);
    a.story.currentTime=8.2;a.w.ShiaI18n.setLanguage('en');await settle();
    assert.equal(a.story.querySelector('source').getAttribute('src'),'assets/media/shia-story-en.mp4');assert.equal(a.story.currentTime,8.2);assert(!a.story.paused);
    a.d.getElementById('filmClose').click();await settle();assert(a.story.paused);assert(a.story.muted);assert.equal(a.d.activeElement.id,'filmOpen');assert(!a.hero.paused);
  } finally {a.dom.window.close();}
});

test('Background, viewport and customer-context exits suspend motion and audio without overriding a manual pause',async()=>{
  const a=await setup();
  try {
    a.hide(true);assert(a.hero.paused);assert.equal(a.frames.size,0);
    a.hide(false);await settle();assert(!a.hero.paused);
    a.visible(false);assert(a.hero.paused);a.visible(true);await settle();assert(!a.hero.paused);
    a.d.getElementById('filmPause').click();assert(a.hero.paused);
    a.visible(false);a.visible(true);await settle();assert(a.hero.paused,'User pause persists');
    a.d.getElementById('filmPause').click();await settle();assert(!a.hero.paused);
    a.d.getElementById('picker').classList.add('hidden');await settle();assert(a.hero.paused);
    a.d.getElementById('picker').classList.remove('hidden');await settle();assert(!a.hero.paused);
    a.d.getElementById('filmOpen').click();await settle();a.hide(true);assert(a.story.paused);a.hide(false);await settle();assert(!a.story.paused);
    a.reduce(true);assert(a.hero.paused);assert(a.story.paused);
  } finally {a.dom.window.close();}
});

test('A media failure leaves ordering navigation available and shows a translated recovery message',async()=>{
  const a=await setup();
  try {
    a.hero.dispatchEvent(new a.w.Event('error'));
    assert.match(a.d.getElementById('filmMessage').textContent,/continue creating your song/);
    assert.equal(a.d.querySelector('.hero-actions .primary').getAttribute('href'),'#ocasiones');
    assert.equal(a.d.querySelectorAll('[data-t]').length,12);
    a.w.ShiaI18n.setLanguage('es');await settle();a.hero.dispatchEvent(new a.w.Event('error'));
    assert.match(a.d.getElementById('filmMessage').textContent,/continuar creando su canción/);
  } finally {a.dom.window.close();}
});
