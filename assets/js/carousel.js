/* Native touch scrolling stays usable without any script or animation. */
const track=document.getElementById('tgrid');
if(track){
 const previous=document.querySelector('[data-carousel-prev]');
 const next=document.querySelector('[data-carousel-next]');
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
 let repeatTimer, repeatControl=null, heldPointer=null, holdMoved=false, suppressClick=false;
 const direction=button=>button===next?1:-1;
 const within=(button,event)=>{const box=button.getBoundingClientRect();return event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;};
 function stopRepeat(){clearTimeout(repeatTimer);repeatTimer=null;repeatControl=null;}
 function usable(){return !document.hidden && !track.closest('.hidden') && track.getBoundingClientRect().bottom>0 && track.getBoundingClientRect().top<innerHeight;}
 function beginRepeat(button,delay,kind){
  stopRepeat();repeatControl=button;
  const tick=()=>{
   if(repeatControl!==button || button.disabled || !usable()){stopRepeat();return;}
   update();
   // A repeat is a single immediate adjacent stop. No in-flight smooth scroll
   // remains to drift after pointer leave or cancel; sleeve faces still ease.
   go(selected+direction(button),false,'instant');update();
   if(kind==='hold')holdMoved=true;
   if(button.disabled){stopRepeat();return;}
   repeatTimer=setTimeout(tick,850);
  };
  repeatTimer=setTimeout(tick,delay);
 }
 let selected=0,frame,instantRestore;
 const originalOverflow=track.style.overflowX,originalSnap=track.style.scrollSnapType;
 function restoreNative(){clearTimeout(instantRestore);track.style.overflowX=originalOverflow;track.style.scrollSnapType=originalSnap;}
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
  if(repeatControl?.disabled)stopRepeat();
 }
 function go(index,focus=false,behavior=preference.matches?'instant':'smooth'){
  const list=cards();index=Math.max(0,Math.min(list.length-1,index));const card=list[index];if(!card)return;
  const left=card.offsetLeft-track.offsetLeft-(track.clientWidth-card.offsetWidth)/2;
  if(behavior==='instant'){
   // End a compositor swipe/snap before an explicit immediate command. Otherwise
   // its pending snap can overwrite the new target after reduced-motion keys.
   clearTimeout(instantRestore);
   track.style.overflowX='hidden';track.style.scrollSnapType='none';
   void track.offsetWidth;
   track.scrollTo({left,behavior:'instant'});
   void track.offsetWidth;
   instantRestore=setTimeout(restoreNative,250);
  }else track.scrollTo({left,behavior});
  if(focus)card.focus({preventScroll:true});
 }
 [previous,next].forEach(button=>{
  button.addEventListener('pointerenter',event=>{
   if(event.pointerType==='mouse' && finePointer.matches && !button.disabled)beginRepeat(button,650,'hover');
  });
  button.addEventListener('pointerleave',()=>{stopRepeat();if(heldPointer!==null)suppressClick=true;});
  button.addEventListener('blur',stopRepeat);
  button.addEventListener('pointerdown',event=>{
   stopRepeat();suppressClick=false;holdMoved=false;
   if(event.pointerType==='touch' || event.pointerType==='pen'){
    heldPointer=event.pointerId;button.setPointerCapture(event.pointerId);
    button.dataset.pressX=event.clientX;button.dataset.pressY=event.clientY;
    beginRepeat(button,450,'hold');
   }
  });
  button.addEventListener('pointermove',event=>{
   if(event.pointerId===heldPointer && (!within(button,event) || Math.hypot(event.clientX-Number(button.dataset.pressX),event.clientY-Number(button.dataset.pressY))>18)){suppressClick=true;stopRepeat();}
  });
  const endPress=event=>{
   stopRepeat();
   if(event.pointerId!==heldPointer)return;
   const tap=event.type==='pointerup' && within(button,event) && !suppressClick && !holdMoved && !button.disabled && usable();
   // Touch browsers may omit a synthetic click after a cancelled gesture.
   // Commit a valid tap from its real pointerup, then consume any synthetic
   // click. Holds/cancels never add a release step. Keyboard clicks stay native.
   suppressClick=true;
   heldPointer=null;stopRepeat();
   if(tap){button.focus({preventScroll:true});update();go(selected+direction(button));}
  };
  button.addEventListener('pointerup',endPress);
  button.addEventListener('pointercancel',endPress);
  button.addEventListener('lostpointercapture',endPress);
  button.addEventListener('click',event=>{
   stopRepeat();
   if(suppressClick && (event.detail!==0 || event.pointerType==='touch' || event.pointerType==='pen')){suppressClick=false;return;}
   suppressClick=false;update();go(selected+direction(button));
  });
 });
 track.addEventListener('keydown',event=>{
  if(!event.target.closest('.tcard'))return;
  const index=cards().indexOf(event.target.closest('.tcard'));
  const target={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:cards().length-1}[event.key];
  if(target===undefined)return;event.preventDefault();stopRepeat();go(target,true);
 });
 // Pointer focus arrives between press and release: moving its target here can
 // discard the native click. Only keyboard focus needs automatic centering.
 track.addEventListener('focusin',event=>{const card=event.target.closest('.tcard');if(card && card.matches(':focus-visible'))go(cards().indexOf(card));});
 track.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);},{passive:true});
 new MutationObserver(update).observe(track,{childList:true});
 document.addEventListener('visibilitychange',stopRepeat);
 window.addEventListener('blur',stopRepeat);window.addEventListener('pagehide',stopRepeat);
 window.addEventListener('scroll',stopRepeat,{passive:true});
 track.addEventListener('pointerdown',()=>{restoreNative();stopRepeat();});
 track.addEventListener('focusin',stopRepeat);
 new MutationObserver(stopRepeat).observe(document.getElementById('customerApp'),{attributes:true,subtree:true,attributeFilter:['class']});
 if(typeof IntersectionObserver==='function')new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stopRepeat();}).observe(track);
 window.addEventListener('resize',update);window.addEventListener('shia:languagechange',update);update();
}
