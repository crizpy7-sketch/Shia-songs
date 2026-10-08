import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { buildSync } from 'esbuild';

const html = await readFile('index.html', 'utf8');
const bundle = buildSync({stdin:{contents:"import './assets/js/brand-film.js'; import './assets/js/song-player.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'}).outputFiles[0].text;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup() {
  const dom = new JSDOM(html, {url:'https://example.invalid/Shia-songs/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,states=new WeakMap(),calls=[];
  let hidden=false;
  const state = media => { if (!states.has(media)) states.set(media, {paused:true}); return states.get(media); };
  Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return state(this).paused;}});
  Object.defineProperty(w.HTMLMediaElement.prototype,'duration',{get(){return this.tagName==='AUDIO'?199.44:15;}});
  Object.defineProperty(w.HTMLMediaElement.prototype,'ended',{get(){return this.currentTime>=this.duration;}});
  w.HTMLMediaElement.prototype.play=async function(){state(this).paused=false;calls.push(this.id);this.dispatchEvent(new w.Event('play'));};
  w.HTMLMediaElement.prototype.pause=function(){if(state(this).paused)return;state(this).paused=true;this.dispatchEvent(new w.Event('pause'));};
  w.HTMLMediaElement.prototype.load=function(){state(this).paused=true;this.currentTime=0;this.dispatchEvent(new w.Event('loadedmetadata'));};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
  w.IntersectionObserver=class{observe(){}};
  Object.defineProperty(d,'hidden',{get:()=>hidden});
  const hero=d.getElementById('heroFilm');hero.muted=true;
  w.eval(bundle);await settle();
  return {dom,w,d,calls,hero,story:d.getElementById('storyFilm'),song:d.getElementById('featuredSong'),hide(value){hidden=value;d.dispatchEvent(new w.Event('visibilitychange'));}};
}

test('The selected full song starts only on request, and interface switches preserve its source and position',async()=>{
  const a=await setup();
  try {
    assert(a.song.controls);assert.equal(a.song.preload,'none');assert(a.song.paused);
    assert(!a.calls.includes('featuredSong'));
    a.d.getElementById('heroSongLink').dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,button:0,cancelable:true}));
    await settle();assert(!a.song.paused);assert(a.hero.paused);
    assert.equal(a.song.querySelector('source').getAttribute('src'),'assets/media/que-suerte-la-mia.mp3');
    a.song.currentTime=46.8;a.song.dispatchEvent(new a.w.Event('timeupdate'));
    a.w.ShiaI18n.setLanguage('es');await settle();
    assert(!a.song.paused);assert.equal(a.song.currentTime,46.8);
    assert.equal(a.d.getElementById('songState').textContent,'Reproduciendo');
    assert.equal(a.d.getElementById('songElapsed').textContent,'0:46');
    assert.equal(a.d.getElementById('songDuration').textContent,'3:19');
    assert.equal(a.d.getElementById('featuredSongTitle').textContent,'Qué suerte la mía');
    a.song.currentTime=199.44;a.song.pause();a.song.dispatchEvent(new a.w.Event('ended'));
    assert.equal(a.d.getElementById('songState').textContent,'Canción completada');
    a.d.getElementById('heroSongLink').dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,button:0,cancelable:true}));
    await settle();assert.equal(a.song.currentTime,0);assert(!a.song.paused);
  } finally {a.dom.window.close();}
});

test('Song and audible films take turns; silent decorative playback does not interrupt the song',async()=>{
  const a=await setup();
  try {
    a.hero.muted=false;await a.song.play();assert(a.hero.paused);assert(a.hero.muted);
    await a.hero.play();assert(!a.song.paused,'A silent film may continue decorating the hero');
    a.hero.muted=false;a.hero.dispatchEvent(new a.w.Event('volumechange'));assert(a.song.paused);
    await a.song.play();assert(a.hero.paused);assert(a.hero.muted);
    a.d.getElementById('filmOpen').click();await settle();assert(a.song.paused);assert(!a.story.paused);
    a.d.getElementById('filmClose').click();await settle();assert(a.song.paused,'Closing the film does not restart a song');
  } finally {a.dom.window.close();}
});

test('Leaving the page or customer landing stops the song; media failure preserves translated ordering navigation',async()=>{
  const a=await setup();
  try {
    await a.song.play();a.hide(true);assert(a.song.paused);a.hide(false);await settle();assert(a.song.paused);
    await a.song.play();a.d.getElementById('picker').classList.add('hidden');await settle();assert(a.song.paused);
    a.d.getElementById('picker').classList.remove('hidden');await settle();assert(a.song.paused);
    await a.song.play();a.d.getElementById('customerApp').classList.add('hidden');await settle();assert(a.song.paused);
    a.d.getElementById('customerApp').classList.remove('hidden');await settle();
    a.song.dispatchEvent(new a.w.Event('error'));
    assert.match(a.d.getElementById('songError').textContent,/continue creating your song/);
    a.w.ShiaI18n.setLanguage('es');assert.match(a.d.getElementById('songError').textContent,/seguir creando su canción/);
    assert.equal(a.d.querySelector('.song-copy a').getAttribute('href'),'#ocasiones');
    assert.equal(a.d.querySelectorAll('[data-t]').length,12);
  } finally {a.dom.window.close();}
});
