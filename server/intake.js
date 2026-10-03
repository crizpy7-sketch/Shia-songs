import { randomUUID,createHmac } from 'node:crypto';
import { hashToken,sameSecret,paymentCapability,PaymentError } from './payments.js';
import { packageFor } from './catalog.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types=new Set(['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export class Intake {
 constructor({store,config,storage=null}) {Object.assign(this,{store,config,storage});}
 token(id){return createHmac('sha256',this.config.intakeSecret).update(`shia-intake:v1:${id}`).digest('base64url');}
 async handle(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new PaymentError('No se pudo enviar la solicitud.');
  if(body.action==='submit')return this.submit(body);
  if(body.action==='finalize')return this.finalize(body);
  throw new PaymentError('No se pudo enviar la solicitud.');
 }
 async submit(body){
  const {action,idempotency_key,website,...payload}=body;
  if(website||typeof idempotency_key!=='string'||!UUID.test(idempotency_key)||!packageFor(payload.package_key)||typeof payload.customer_name!=='string'||!payload.customer_name.trim()||payload.customer_name.length>200||typeof payload.customer_email!=='string'||payload.customer_email.length>254||!/^\S+@\S+\.\S+$/.test(payload.customer_email)||!payload.answers||typeof payload.answers!=='object'||Array.isArray(payload.answers))throw new PaymentError('No se pudo enviar la solicitud.');
  const files=payload.files;
  if(!Array.isArray(files)||files.length>20||files.some(f=>!f||typeof f!=='object'||typeof f.name!=='string'||f.name.length>255||!types.has(f.type)||!Number.isInteger(f.size)||f.size<=0||f.size>50*1024*1024))throw new PaymentError('No se pudo enviar la solicitud.');
  if(files.length&&!this.storage)throw new PaymentError('No se pudo enviar la solicitud.',503);
  const payloadHash=hashToken(JSON.stringify(canonical(payload)));
  const inquiry=await this.store.transaction(async client=>{
   const result=await client.query(`INSERT INTO shia_intake.inquiries(order_id,request_hash,payload_hash,payload,package_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(request_hash) DO UPDATE SET request_hash=EXCLUDED.request_hash RETURNING *`,[randomUUID(),hashToken(idempotency_key),payloadHash,JSON.stringify(payload),payload.package_key]);
   const row=result.rows[0];if(row.payload_hash!==payloadHash)throw new PaymentError('No se pudo enviar la solicitud.',409);return row;
  });
  const uploads=await Promise.all(files.map(async(f,index)=>{const path=`${inquiry.order_id}/${index}`;if(await this.storage.verify({...f,path}))return {path,uploaded:true};return {path,upload_url:await this.storage.sign(path)};}));
  return {order_id:inquiry.order_id,order_number:inquiry.order_id,submission_token:this.token(inquiry.order_id),uploads};
 }
 async finalize({order_id,submission_token,file_manifest}){
  if(typeof order_id!=='string'||!UUID.test(order_id)||!sameSecret(submission_token,this.token(order_id)))throw new PaymentError('No se pudo enviar la solicitud.',403);
  return this.store.transaction(async client=>{
   const {rows}=await client.query('SELECT * FROM shia_intake.inquiries WHERE order_id=$1 FOR UPDATE',[order_id]);const row=rows[0];
   if(!row)throw new PaymentError('No se pudo enviar la solicitud.',404);
   if(!Array.isArray(file_manifest)||file_manifest.length!==row.payload.files.length)throw new PaymentError('No se pudo enviar la solicitud.');
   const expected=row.payload.files;
   for(let i=0;i<expected.length;i++){
    const f=expected[i],m=file_manifest[i];
    if(!m||m.path!==`${order_id}/${i}`||m.name!==f.name||m.type!==f.type||m.size!==f.size||!['slideshow','referencia'].includes(m.role)||typeof m.caption!=='string'||m.caption.length>2000||(m.role==='slideshow'?(!f.type.startsWith('image/')||m.order!==i+1):m.order!==null))throw new PaymentError('No se pudo enviar la solicitud.');
   }
   const manifestHash=hashToken(JSON.stringify(canonical(file_manifest)));
   if(row.state==='finalized'&&manifestHash!==hashToken(JSON.stringify(canonical(row.manifest))))throw new PaymentError('No se pudo enviar la solicitud.',409);
   if(row.state!=='finalized'){
    for(const m of file_manifest)if(!await this.storage.verify(m))throw new PaymentError('No se pudo enviar la solicitud.',409);
    await client.query(`UPDATE shia_intake.inquiries SET state='finalized',manifest=$2,finalized_at=now() WHERE order_id=$1`,[order_id,JSON.stringify(file_manifest)]);
    await client.query(`INSERT INTO shia_intake.notifications(id,order_id,kind) VALUES($1,$2,'inquiry') ON CONFLICT(order_id,kind) DO NOTHING`,[randomUUID(),order_id]);
   }
   let payment_token;
   if(this.config.enabled){
    payment_token=paymentCapability(order_id,row.package_key,this.config.tokenSecret);
    await this.store.provision({orderId:order_id,packageKey:row.package_key,tokenHash:hashToken(payment_token)},client);
   }
   return {order_id,order_number:order_id,payment_token,notification_status:'queued'};
  });
 }
}
