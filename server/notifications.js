import { randomUUID } from 'node:crypto';
export class DeliveryError extends Error {
 constructor(code){super(code);this.code=code;}
}
export function notificationProvider(env=process.env,fetcher=fetch){
 const mode=env.NOTIFICATION_PROVIDER;
 if(mode==='resend'&&env.RESEND_API_KEY&&env.NOTIFICATION_FROM&&env.NOTIFICATION_TO){
  return {idempotencyWindowMs:24*60*60*1000,send:async({key,kind,orderId})=>{
   // No customer stories, photos, contact details or bearer tokens leave the database.
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.NOTIFICATION_FROM,to:[env.NOTIFICATION_TO],subject:kind==='paid'?'SHIA Songs: payment confirmed':'SHIA Songs: new inquiry',text:`${kind==='paid'?'Payment confirmed':'New inquiry received'}. Reference: ${orderId}. Review the private SHIA inquiry ledger.`})});
   if(!response.ok)throw new DeliveryError(`provider_http_${response.status}`);
   const data=await response.json();if(typeof data.id!=='string')throw new DeliveryError('provider_invalid_response');return data.id;
  }};
 }
 if(mode==='webhook'&&env.NOTIFICATION_WEBHOOK_URL?.startsWith('https://')&&env.NOTIFICATION_WEBHOOK_SECRET&&env.NOTIFICATION_WEBHOOK_IDEMPOTENT==='true'){
  return {send:async({key,kind,orderId})=>{
   const response=await fetcher(env.NOTIFICATION_WEBHOOK_URL,{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${env.NOTIFICATION_WEBHOOK_SECRET}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({kind,orderId})});
   if(!response.ok)throw new DeliveryError(`provider_http_${response.status}`);return key;
  }};
 }
 return null;
}
export class NotificationWorker {
 constructor({store,provider,now=()=>Date.now()}){Object.assign(this,{store,provider,now});}
 async runOne(){
  // Missing credentials/recipient never imply successful delivery or dequeue a job.
  if(!this.provider)throw new DeliveryError('notification_configuration_missing');
  const job=await this.store.claimNotification(randomUUID());if(!job)return false;
  try{
   if(this.provider.idempotencyWindowMs&&this.now()-new Date(job.created_at).getTime()>=this.provider.idempotencyWindowMs){
    await this.store.finishNotification(job,{blocked:true,error:'provider_idempotency_window_expired'});return true;
   }
   const providerId=await this.provider.send({key:`shia-${job.id}`,kind:job.kind,orderId:job.order_id});
   await this.store.finishNotification(job,{providerId});
  }catch(error){
   // Never persist provider payloads, credentials, destination addresses or PII.
   await this.store.finishNotification(job,{error:error instanceof DeliveryError?error.code:'provider_unavailable',delay:Math.min(3600,30*2**Math.min(job.attempts-1,7))});
  }
  return true;
 }
}
