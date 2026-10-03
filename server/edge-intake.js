import { randomUUID,createHmac } from 'node:crypto';
import { hashToken,sameSecret,paymentCapability,PaymentError } from './payments.js';
import { packageFor } from './catalog.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types=new Set(['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function date(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new PaymentError('No se pudo enviar la solicitud.');return value;}
export class EdgeIntake {
 constructor({store,storage,config}){Object.assign(this,{store,storage,config});}
 token(id){return createHmac('sha256',this.config.intakeSecret).update(`shia-edge-intake:v2:${id}`).digest('base64url');}
 async handle(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new PaymentError('No se pudo enviar la solicitud.');
  if(body.action==='submit')return this.submit(body);if(body.action==='finalize')return this.finalize(body);throw new PaymentError('No se pudo enviar la solicitud.');
 }
 async submit(body){
  if(clean(body.website,100))return {ok:true,ignored:true};
  if(typeof body.idempotency_key!=='string'||!uuid.test(body.idempotency_key)||!packageFor(body.package_key)||!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))throw new PaymentError('No se pudo enviar la solicitud.');
  const order={order_type:clean(body.order_type,80)||'personalized_song',title:clean(body.title,180)||'Canción personalizada',customer_name:clean(body.customer_name,160),customer_email:clean(body.customer_email,254).toLowerCase(),customer_phone:clean(body.customer_phone,60),event_date:date(body.event_date),couple_names:clean(body.couple_names,240)||null,anniversary_date:date(body.anniversary_date),years_married:body.years_married===null||body.years_married===undefined||body.years_married===''?null:Number(body.years_married),language:clean(body.language,80)||null,music_style:clean(body.music_style,120)||null,emotion:clean(body.emotion,120)||null,answers:body.answers};
  if(!order.customer_name||!/^\S+@\S+\.\S+$/.test(order.customer_email)||!order.customer_phone||(order.years_married!==null&&(!Number.isInteger(order.years_married)||order.years_married<0||order.years_married>2147483647)))throw new PaymentError('No se pudo enviar la solicitud.');
  if(!Array.isArray(body.files)||body.files.length>20||body.files.some(f=>!f||typeof f.name!=='string'||!f.name||f.name.length>255||!types.has(f.type)||!Number.isInteger(f.size)||f.size<=0||f.size>50*1024*1024))throw new PaymentError('No se pudo enviar la solicitud.');
  const files=body.files.map(({name,type,size})=>({name,type,size}));const id=randomUUID();
  const record=await this.store.rpc('submit',{p_request_hash:hashToken(body.idempotency_key.toLowerCase()),p_payload_hash:hashToken(JSON.stringify(canonical({order,files,package_key:body.package_key}))),p_order_id:id,p_token_hash:hashToken(this.token(id)),p_order:order,p_files:files.map((f,i)=>({...f,path:`${id}/${String(i+1).padStart(2,'0')}-${f.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-120)||'upload'}`})),p_package_key:body.package_key});
  const uploads=await Promise.all(record.files.map(async f=>await this.storage.verify(f)?{...f,uploaded:true}:{...f,...await this.storage.sign(f.path)}));
  return {ok:true,order_id:record.order_id,order_number:record.order_number,submission_token:this.token(record.order_id),uploads};
 }
 async finalize(body){
  if(typeof body.order_id!=='string'||!uuid.test(body.order_id)||!sameSecret(body.submission_token,this.token(body.order_id)))throw new PaymentError('No se pudo enviar la solicitud.',403);
  const tokenHash=hashToken(body.submission_token);const request=await this.store.rpc('request',{p_order_id:body.order_id,p_token_hash:tokenHash});
  const manifest=body.file_manifest;if(!Array.isArray(manifest)||manifest.length!==request.files.length)throw new PaymentError('No se pudo enviar la solicitud.');
  for(let i=0;i<manifest.length;i++){
   const m=manifest[i],f=request.files[i];if(!m||m.path!==f.path||m.name!==f.name||m.type!==f.type||m.size!==f.size||!['slideshow','referencia'].includes(m.role)||typeof m.caption!=='string'||m.caption.length>2000||(m.role==='slideshow'?(!f.type.startsWith('image/')||m.order!==i+1):m.order!==null))throw new PaymentError('No se pudo enviar la solicitud.');
  }
  if(!request.finalized_at)for(const m of manifest)if(!await this.storage.verify(m))throw new PaymentError('No se pudo enviar la solicitud.',409);
  const paymentToken=this.config.enabled?paymentCapability(body.order_id,request.package_key,this.config.tokenSecret):null;
  const result=await this.store.rpc('finalize',{p_order_id:body.order_id,p_token_hash:tokenHash,p_manifest:manifest,p_payment_hash:paymentToken?hashToken(paymentToken):null});
  return {ok:true,order_id:result.order_id,order_number:result.order_number,notification_status:result.notification_status,...(paymentToken?{payment_token:paymentToken}:{})};
 }
}
export function edgeStorage(admin){
 const bucket=admin.storage.from('shia-song-uploads');
 return {
  async sign(path){const {data,error}=await bucket.createSignedUploadUrl(path);if(error)throw new Error('SHIA upload signing unavailable');return {token:data.token,upload_url:data.signedUrl};},
  async verify(file){const slash=file.path.lastIndexOf('/');const {data,error}=await bucket.list(file.path.slice(0,slash),{search:file.path.slice(slash+1),limit:100});if(error)throw new Error('SHIA upload verification unavailable');const found=data?.find(f=>f.name===file.path.slice(slash+1));return found?.metadata?.size===file.size&&found.metadata.mimetype===file.type;}
 };
}
