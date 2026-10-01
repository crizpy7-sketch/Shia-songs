/* Native touch scrolling stays usable without any script or animation. */
import { t } from './i18n.js';
const track=document.getElementById('tgrid');
if(track){
 const previous=document.querySelector('[data-carousel-prev]');
 const next=document.querySelector('[data-carousel-next]');
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 let selected=0,frame;
 const cards=()=>Array.from(track.children);
 function update(){
  const list=cards();if(!list.length)return;
  const center=track.scrollLeft+track.clientWidth/2;
  selected=list.reduce((best,card,i)=>Math.abs(card.offsetLeft-track.offsetLeft+card.offsetWidth/2-center)<Math.abs(list[best].offsetLeft-track.offsetLeft+list[best].offsetWidth/2-center)?i:best,0);
  list.forEach((card,i)=>{card.dataset.active=String(i===selected);card.style.setProperty('--sleeve-angle',`${Math.sign(i-selected)*(Math.abs(i-selected)>1?-52:-34)}deg`);card.style.setProperty('--sleeve-depth',`${Math.abs(i-selected)>1?-140:Math.abs(i-selected)*-80}px`);});
  const atStart=selected===0,atEnd=selected===list.length-1;
  // A newly disabled native button loses focus. Keep keyboard navigation in the
  // control group by moving only that focused endpoint to its available peer.
  if(atStart && document.activeElement===previous && !atEnd){next.disabled=false;next.focus({preventScroll:true});}
  if(atEnd && document.activeElement===next && !atStart){previous.disabled=false;previous.focus({preventScroll:true});}
  previous.disabled=atStart;next.disabled=atEnd;
 }
 function go(index,focus=false){
  const list=cards();index=Math.max(0,Math.min(list.length-1,index));const card=list[index];if(!card)return;
  track.scrollTo({left:card.offsetLeft-track.offsetLeft-(track.clientWidth-card.offsetWidth)/2,behavior:preference.matches?'instant':'smooth'});
  if(focus)card.focus({preventScroll:true});
 }
 previous.addEventListener('click',()=>go(selected-1));next.addEventListener('click',()=>go(selected+1));
 track.addEventListener('keydown',event=>{
  if(!event.target.closest('.tcard'))return;
  const index=cards().indexOf(event.target.closest('.tcard'));
  const target={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:cards().length-1}[event.key];
  if(target===undefined)return;event.preventDefault();go(target,true);
 });
 // Pointer focus arrives between press and release: moving its target here can
 // discard the native click. Only keyboard focus needs automatic centering.
 track.addEventListener('focusin',event=>{const card=event.target.closest('.tcard');if(card && card.matches(':focus-visible'))go(cards().indexOf(card));});
 track.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);},{passive:true});
 new MutationObserver(update).observe(track,{childList:true});
 window.addEventListener('resize',update);window.addEventListener('shia:languagechange',update);update();
}
