import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { OCCASION_PHOTOS } from '../assets/js/occasion-photos.js';
const credits=JSON.parse(readFileSync('docs/OCCASION_PHOTO_CREDITS.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('Twelve distinct optimized photos match verified build-input provenance, without old-image reuse',()=>{
 const previous=['couple','embrace','music','listener'].map(id=>hash(readFileSync(`assets/photos/${id}.webp`)));
 assert.equal(credits.assets.length,12);assert.equal(new Set(credits.assets.map(a=>a.photo_id)).size,12);assert.equal(new Set(credits.assets.map(a=>a.sha256)).size,12);
 const optimized=credits.assets.map(a=>{const bytes=readFileSync(a.local_asset);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.length,a.optimized_bytes);assert.equal(hash(bytes),a.optimized_sha256);assert(a.local_original_hash_verified&&a.local_original_dimensions_verified);assert(a.optimized_width<=1200&&a.optimized_height<=1200);return hash(bytes);});
 assert.equal(new Set(optimized).size,12);assert(optimized.every(h=>!previous.includes(h)));
});
test('Every enhanced and progressive sleeve uses its canonical licensed photo and bilingual description',()=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'));
 try{const cards=[...dom.window.document.querySelectorAll('.tcard')];assert.equal(cards.length,12);assert.deepEqual(cards.map(c=>c.dataset.t),Object.keys(OCCASION_PHOTOS));for(const card of cards){const image=card.querySelector('img'),photo=OCCASION_PHOTOS[card.dataset.t],record=credits.assets.find(a=>a.occasion_id===card.dataset.t);assert.equal(image.getAttribute('src'),photo.src);assert.equal(photo.src,record.local_asset);assert.equal(image.alt,record.alt_en);assert.equal(image.dataset.i18nAlt,record.alt_es);assert.equal(image.style.objectPosition,photo.position);assert.equal(Number(image.width),record.optimized_width);assert.equal(Number(image.height),record.optimized_height);}}
 finally{dom.window.close();}
});
test('Photo records retain primary sources, commercial-use license, and illustration limits',()=>{
 assert(credits.local_transfer.zip_contents_verified&&credits.local_transfer.originals_kept_outside_git);for(const a of credits.assets){assert.equal(new URL(a.source_url).hostname,'www.pexels.com');assert(a.source_url.includes(a.photo_id));assert(a.photographer);assert.equal(a.license_url,'https://www.pexels.com/license/');assert.equal(a.terms_url,'https://www.pexels.com/terms-of-service/');assert(a.alt_en&&a.alt_es);}
 assert.match(credits.assets.find(a=>a.occasion_id==='quinceanera').alt_en,/adult woman/);assert.match(credits.assets.find(a=>a.occasion_id==='quinceanera').occasion_fit,/not.*(?:describe|assert)|do not/i);
});
