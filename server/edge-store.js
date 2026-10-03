import { randomUUID } from 'node:crypto';
import { PaymentError } from './payments.js';
export class EdgeStore {
 constructor(admin){this.admin=admin;}
 async rpc(name,args){
  const {data,error}=await this.admin.rpc(`shia_edge_${name}`,args);
  if(error){
   const code=error.message;
   const errors={shia_invalid:400,shia_forbidden:403,shia_conflict:409,shia_busy:409,shia_paid:409,shia_reconcile:409};
   if(Object.hasOwn(errors,code))throw new PaymentError(code==='shia_busy'?'El pago está en proceso de confirmación. No inicie otro pago.':code==='shia_paid'?'Esta solicitud ya tiene un pago confirmado.':code==='shia_forbidden'?'El acceso al pago no es válido o ha vencido.':'No se pudo enviar la solicitud.',errors[code]);
   throw new Error('SHIA database operation unavailable');
  }
  return data;
 }
 async withOrder(orderId,fn,{tokenHash,packageKey}={}){
  const leaseId=randomUUID();const order=await this.rpc('payment_claim',{p_order_id:orderId,p_token_hash:tokenHash,p_package_key:packageKey,p_lease_id:leaseId});
  try{return await fn(order,{
   reserveAttempt:async({attempt,requestHash})=>this.rpc('payment_reserve',{p_order_id:orderId,p_lease_id:leaseId,p_attempt:attempt,p_request_hash:requestHash}),
   saveSession:async({sessionId,attempt,priceId,amount,currency})=>this.rpc('payment_save',{p_order_id:orderId,p_lease_id:leaseId,p_session_id:sessionId,p_attempt:attempt,p_price_id:priceId,p_amount:amount,p_currency:currency})
  });}finally{await this.rpc('payment_release',{p_order_id:orderId,p_lease_id:leaseId});}
 }
 session(sessionId){return this.rpc('session',{p_session_id:sessionId});}
 applyEvent({eventId,eventType,sessionId,orderId,paid,failed,expired}){return this.rpc('event',{p_event_id:eventId,p_event_type:eventType,p_session_id:sessionId,p_order_id:orderId,p_paid:!!paid,p_failed:!!failed,p_expired:!!expired});}
 claimNotification(leaseId){return this.rpc('notification_claim',{p_lease_id:leaseId});}
 finishNotification(job,{providerId,error,delay=30,blocked=false}){return this.rpc('notification_finish',{p_id:job.id,p_lease_id:job.lease_id,p_status:blocked?'blocked':error?'failed':'sent',p_provider_id:providerId||null,p_error:error||null,p_delay:delay});}
}
