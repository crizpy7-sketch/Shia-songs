/* Original deterministic SHIA SONGS brand film. npm run render:film */
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { prepareHeroSong } = require('./hero-song.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'assets', 'media');
const locale = process.argv.includes('--es') ? 'es' : 'en';
const copy = (en,es) => locale === 'es' ? es : en;
let wedding;
fs.mkdirSync(output, { recursive: true });
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-Bold.otf', 'KineticDisplay');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf', 'KineticSans');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/urw-base35/NimbusMonoPS-Regular.otf', 'KineticMono');

const W = 1600, H = 900, PI = Math.PI, TAU = PI * 2;
const palette = { ink: '#171d20', acid: '#f3efe6', mint: '#cbd5bf', lilac: '#ddc6b7', orange: '#b5c4a6', paper: '#f3efe6' };
const canvas = createCanvas(1920, 1080);
const ctx = canvas.getContext('2d');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, v) => a + (b - a) * v;
const out = v => 1 - (1 - clamp(v)) ** 4;
const inOut = v => (v = clamp(v)) < .5 ? 8 * v ** 4 : 1 - (-2 * v + 2) ** 4 / 2;
const back = v => { v = clamp(v) - 1; return 1 + 2.70158 * v ** 3 + 1.70158 * v ** 2; };
const vec = (x,y,z) => ({x,y,z});
const add = (a,b) => vec(a.x+b.x,a.y+b.y,a.z+b.z);
const sub = (a,b) => vec(a.x-b.x,a.y-b.y,a.z-b.z);
const mul = (a,b) => vec(a.x*b,a.y*b,a.z*b);
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const cross = (a,b) => vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const norm = a => mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
function rotate(p, ax, ay, az) {
  const a=vec(p.x,p.y*Math.cos(ax)-p.z*Math.sin(ax),p.y*Math.sin(ax)+p.z*Math.cos(ax));
  const b=vec(a.x*Math.cos(ay)+a.z*Math.sin(ay),a.y,-a.x*Math.sin(ay)+a.z*Math.cos(ay));
  return vec(b.x*Math.cos(az)-b.y*Math.sin(az),b.x*Math.sin(az)+b.y*Math.cos(az),b.z);
}
function text(value, x, y, size, color=palette.ink, options={}) {
  ctx.save(); ctx.translate(x,y);
  if(options.rotate)ctx.rotate(options.rotate);
  ctx.scale(options.sx ?? 1, options.sy ?? 1);
  ctx.font = `${size}px ${options.mono?'KineticMono':options.sans?'KineticSans':'KineticDisplay'}`;
  ctx.textAlign=options.align||'left';ctx.textBaseline='alphabetic';
  if(options.stroke){ctx.lineWidth=options.stroke;ctx.strokeStyle=color;ctx.strokeText(value,0,0);}
  else {ctx.fillStyle=color;ctx.fillText(value,0,0);}
  ctx.restore();
}
function circle(x,y,r,color,stroke=0) {
  if(r<=0)return;
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);
  if(stroke){ctx.lineWidth=stroke;ctx.strokeStyle=color;ctx.stroke();}
  else {ctx.fillStyle=color;ctx.fill();}
}
function star(x,y,r,t,color,arms=8) {
  ctx.save();ctx.translate(x,y);ctx.rotate(t);ctx.fillStyle=color;
  for(let i=0;i<arms;i++){ctx.rotate(TAU/arms);ctx.fillRect(-r*.055,-r,r*.11,r*2);}
  ctx.restore();
}
function grid(color,alpha=.13,step=90) {
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=1;
  ctx.beginPath();for(let x=0;x<=W;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=0;y<=H;y+=step){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();ctx.restore();
}
function metadata(scene, label, color) {
  text('SHIA SONGS / '+copy('YOUR STORY IN MOTION','SU HISTORIA EN MOVIMIENTO'),54,47,16,color,{mono:true});
  text(copy('NAMES. MEMORIES. FEELINGS.','NOMBRES. RECUERDOS. EMOCIONES.'),W-54,47,16,color,{mono:true,align:'right'});
  text(`0${scene+1} / ${label}`,54,H-40,16,color,{mono:true});
  text(copy('PERSONALIZED SONGS','CANCIONES PERSONALIZADAS'),W-54,H-40,16,color,{mono:true,align:'right'});
  ctx.strokeStyle=color;ctx.globalAlpha=.35;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(54,66);ctx.lineTo(W-54,66);ctx.moveTo(54,H-66);ctx.lineTo(W-54,H-66);ctx.stroke();ctx.globalAlpha=1;
}

function torusMesh(knot=false) {
  const U=knot?170:140,V=56,verts=[],normals=[];
  const curve = u => knot ? vec((155+78*Math.cos(3*u))*Math.cos(2*u),(155+78*Math.cos(3*u))*Math.sin(2*u),95*Math.sin(3*u)) : vec(208*Math.cos(u),208*Math.sin(u),0);
  for(let i=0;i<=U;i++){
    const u=i/U*TAU, p=curve(u), tangent=norm(sub(curve(u+.002),curve(u-.002)));
    const n=norm(knot?cross(tangent,vec(0,0,1)):vec(Math.cos(u),Math.sin(u),0));
    const b=norm(cross(tangent,n));
    for(let j=0;j<=V;j++){
      const v=j/V*TAU, normal=add(mul(n,Math.cos(v)),mul(b,Math.sin(v)));
      const tube=knot?44:76;
      verts.push(add(p,mul(normal,tube)));normals.push(normal);
    }
  }
  const faces=[];for(let i=0;i<U;i++)for(let j=0;j<V;j++){
    const a=i*(V+1)+j;faces.push([a,a+V+1,a+V+2,a+1]);
  }
  return {verts,normals,faces};
}
const ring=torusMesh(),knot=torusMesh(true);
function metal(mesh,x,y,scale,t,knotMode=false) {
  const ax=knotMode?.78+Math.sin(t*.45)*.25:.45+Math.sin(t*.4)*.13;
  const ay=knotMode?t*.35:.28+Math.sin(t*.55)*.4;
  const az=knotMode?-.25+t*.12:.3+t*.32;
  const vertices=mesh.verts.map(p=>rotate(p,ax,ay,az));
  const normals=mesh.normals.map(n=>rotate(n,ax,ay,az));
  const project=p=>{const d=1000/(1000-p.z);return {x:x+p.x*scale*d,y:y+p.y*scale*d,z:p.z};};
  const screen=vertices.map(project);
  const faces=mesh.faces.map(indices=>({indices,z:indices.reduce((a,i)=>a+vertices[i].z,0)/4})).sort((a,b)=>a.z-b.z);
  for(const {indices} of faces){
    const n=norm(indices.reduce((a,i)=>add(a,normals[i]),vec(0,0,0)));
    const ny=n.y,nz=n.z,nx=n.x;
    // Environment stripes create moving, sharply reflected softbox highlights.
    let brightness=.15+.17*(nx+1)/2+.78*Math.exp(-(((ny+.38)/.20)**2))+.31*Math.exp(-(((ny-.78)/.15)**2));
    brightness+=.54*Math.exp(-(((nx-.52)/.12)**2))*Math.max(0,nz);
    brightness*=.65+.35*Math.max(0,nz);
    const b=clamp(brightness);const c=Math.round(20+b*234);
    ctx.fillStyle=`rgb(${c},${clamp(c+(knotMode?4:2),0,255)},${clamp(c+(knotMode?10:-4),0,255)})`;
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.75;
    ctx.beginPath();const q=screen[indices[0]];ctx.moveTo(q.x,q.y);for(let j=1;j<4;j++){const p=screen[indices[j]];ctx.lineTo(p.x,p.y);}ctx.closePath();ctx.fill();ctx.stroke();
  }
}
function shadow(x,y,rx,ry,alpha=.18) {
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(0,0,0,${alpha})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
}
function wave(t,color,alpha=1) {
  ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=2;
  for(let j=0;j<12;j++){ctx.beginPath();for(let x=-20;x<=W+20;x+=10){const y=H*.51+Math.sin(x*.005+t*2+j*.075)*(160+35*Math.cos(t+j*.08))+j*9;x===-20?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}ctx.restore();
}
function spark(t) {
  ctx.fillStyle=palette.acid;ctx.fillRect(0,0,W,H);grid(palette.ink,.10,90);
  const enter=out(t/.9), spin=t+1.25;
  const words=locale==='en'?[['YOUR',358,285],['STORY.',638,285]]:[['SU',358,285],['HISTORIA.',638,190]];
  words.forEach(([word,y,size],i)=>{const q=back((t-.12*i)/.7);ctx.save();ctx.beginPath();ctx.rect(70,y-250,910,280);ctx.clip();text(word,86-mix(420,0,q),y,size,palette.ink);ctx.restore();});
  // The form moves in front of the typography: real occlusion, not a flat sticker.
  shadow(1160,760,255,47,.25);
  circle(1190,432,316,palette.ink,1.3);
  ctx.save();ctx.translate(1190,432);ctx.rotate(-.45+t*.1);ctx.strokeStyle=palette.ink;ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,385,89,0,0,TAU);ctx.stroke();ctx.restore();
  metal(ring,1160+Math.sin(spin*.8)*24,448+Math.cos(spin)*17,.98*enter,spin);
  circle(1190+Math.cos(spin)*316,432+Math.sin(spin)*316,10,palette.ink);
  star(1490,137,28,t*.65,palette.ink);
  text(copy('IT STARTS WITH YOU.','TODO EMPIEZA CON USTED.'),86,756,23,palette.ink,{mono:true});
  text(copy('A FEELING, GIVEN FORM.','UNA EMOCIÓN, HECHA MÚSICA.'),978,800,17,palette.ink,{mono:true});
  metadata(0,copy('A STORY','UNA HISTORIA'),palette.ink);
}
function rhythm(t) {
  ctx.fillStyle=palette.ink;ctx.fillRect(0,0,W,H);
  grid(palette.mint,.075,100);wave(t,palette.mint,.18);
  const q=out(t/.7);
  ctx.save();ctx.beginPath();ctx.rect(951,127,560,620);ctx.clip();
  ctx.translate(1231,437);ctx.scale(1.02+t*.025,1.02+t*.025);ctx.drawImage(wedding,-330,-495,660,990);ctx.restore();
  ctx.fillStyle=palette.ink;ctx.globalAlpha=.14;ctx.fillRect(951,127,560,620);ctx.globalAlpha=1;
  const lines=locale==='en'?['THE','LITTLE','THINGS.']:['LOS','PEQUEÑOS','DETALLES.'];
  lines.forEach((line,i)=>{const r=back((t-i*.13)/.75);text(line,83+mix(-900,0,r),296+i*218,locale==='es'&&i>0?164:265,i===1?palette.mint:palette.paper);});
  text(copy('THE MOMENTS THAT STAY.','LOS MOMENTOS QUE SE QUEDAN.'),87,790,20,palette.mint,{mono:true});
  metadata(1,copy('A MEMORY','UN RECUERDO'),palette.mint);
}
function form(t) {
  ctx.fillStyle=palette.lilac;ctx.fillRect(0,0,W,H);
  grid(palette.ink,.08,100);
  const q=out(t/.85);
  text(copy('MADE','HECHA'),80,289,locale==='es'?216:242,palette.ink,{sx:q});
  text(copy('TO FEEL.','PARA SENTIR.'),82,459,locale==='es'?141:212,palette.ink,{sx:out((t-.12)/.8)});
  // A trefoil tube rotates in depth, with an environment-reflecting chrome finish.
  shadow(1030,771,300,55,.25);
  circle(1035,438,335,palette.ink,1);
  ctx.save();ctx.globalAlpha=.34;ctx.strokeStyle=palette.ink;ctx.setLineDash([3,9]);ctx.beginPath();ctx.moveTo(1035,85);ctx.lineTo(1035,796);ctx.moveTo(674,438);ctx.lineTo(1398,438);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  metal(knot,1120,443,1.06*q,t+5,true);
  circle(1460,147,30,palette.ink,1);star(1460,147,18,t*.7,palette.ink,6);
  text(copy('WHAT CAN BE HARD TO SAY.','LO QUE A VECES CUESTA DECIR.'),88,745,20,palette.ink,{mono:true});
  text(copy('WHAT DESERVES TO LAST.','LO QUE MERECE QUEDARSE.'),88,777,20,palette.ink,{mono:true});
  metadata(2,copy('A FEELING','UNA EMOCIÓN'),palette.ink);
}
function perspective(t) {
  ctx.fillStyle=palette.orange;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalAlpha=.14;
  for(let i=0;i<34;i++)circle(800+Math.sin(t*.3)*35,430,80+i*27+Math.sin(t+i*.12)*12,palette.ink,1.5);
  ctx.restore();wave(t,palette.ink,.18);
  const q=back(t/.75),r=out((t-.18)/.8);
  ctx.save();ctx.translate(W*.5,366);ctx.scale(q,q);text(copy('ONE STORY.','UNA HISTORIA.'),0,0,locale==='es'?207:248,palette.ink,{align:'center'});ctx.restore();
  text(copy('TWO SONGS.','DOS CANCIONES.'),W*.5,618,locale==='es'?194:247,palette.ink,{align:'center',sx:r});
  text(copy('YOUR WORDS. A NEW MELODY.','SUS PALABRAS. UNA NUEVA MELODÍA.'),800,743,22,palette.ink,{mono:true,align:'center'});
  metadata(3,copy('A NEW MELODY','UNA NUEVA MELODÍA'),palette.ink);
}
function signature(t) {
  ctx.fillStyle=palette.ink;ctx.fillRect(0,0,W,H);
  grid(palette.mint,.06,100);
  const q=out(t/.8),a=out((t-.28)/.8);
  ctx.save();ctx.translate(800,155);ctx.scale(mix(2,1,q),q);
  for(let i=-2;i<=2;i++){ctx.fillStyle=palette.mint;ctx.fillRect(i*19-3,-30+Math.abs(i)*8,6,60-Math.abs(i)*16);}ctx.restore();
  text('SHIA SONGS',800,521,278,palette.paper,{align:'center',sx:mix(.7,1,q),sy:q});
  ctx.save();ctx.globalAlpha=a;text(copy('YOUR STORY, MADE INTO A SONG.','SU HISTORIA, HECHA CANCIÓN.'),800,635,24,palette.mint,{mono:true,align:'center'});ctx.restore();
  text(copy('2 SONGS + LYRICS / FROM $20 USD','2 CANCIONES + LETRAS / DESDE $20 USD'),800,744,22,palette.paper,{mono:true,align:'center'});
  metadata(4,copy('SHIA SONGS','SHIA SONGS'),palette.mint);
}
const scenes=[spark,rhythm,form,perspective,signature];
function render(t) {
  ctx.reset();
  ctx.save();ctx.scale(canvas.width/W,canvas.height/H);
  const index=Math.min(4,Math.floor(t/3));const local=t-index*3;
  scenes[index](local);
  // A moving shutter changes scenes without repeated full-screen flashes.
  if(index>0&&local<.32){
    const edge=out(local/.32)*W;ctx.save();ctx.beginPath();ctx.rect(edge,0,W-edge,H);ctx.clip();scenes[index-1](2.999);ctx.restore();
    ctx.fillStyle=palette.ink;ctx.fillRect(edge-5,0,5,H);
  }
  ctx.restore();
}

async function main() {
  wedding=await loadImage(path.join(root,'assets/photos/couple.webp'));
  const marks=[1.6,4.6,7.7,10.55,14.1];
  const stills=path.join(root,'artifacts','film-render');fs.mkdirSync(stills,{recursive:true});
  for(let i=0;i<marks.length;i++){render(marks[i]);fs.writeFileSync(path.join(stills,`frame-${locale}-${i+1}.jpg`),canvas.toBuffer('image/jpeg',90));}
  render(1.6);fs.writeFileSync(path.join(output,`shia-story-${locale}.jpg`),canvas.toBuffer('image/jpeg',93));
  if(process.argv.includes('--stills'))return;
  const soundtrack=prepareHeroSong();
  const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgba','-video_size','1920x1080','-framerate','60','-i','pipe:0','-i',soundtrack,'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-profile:v','high','-level:v','4.2','-c:a','copy','-t','15','-movflags','+faststart',path.join(output,`shia-story-song-${locale}.mp4`)],{stdio:['pipe','inherit','inherit']});
  const completion=once(ff,'close');ff.stdin.on('error',()=>{});
  for(let i=0;i<900;i++){
    render(i/60);
    const rgba=ctx.getImageData(0,0,1920,1080).data;
    if(!ff.stdin.write(Buffer.from(rgba.buffer,rgba.byteOffset,rgba.byteLength)))await once(ff.stdin,'drain');
    if(i%120===0)process.stdout.write(`Rendered ${i}/900 frames\n`);
  }
  ff.stdin.end();const [code]=await completion;
  if(code!==0)throw new Error(`ffmpeg failed (${code})`);
  console.log(`SHIA SONGS ${locale} film complete: 1920 × 1080 / 60 fps / 15 seconds.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
