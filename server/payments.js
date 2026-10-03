import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { checkoutReturnUrls } from './return-urls.js';
import { packageFor } from './catalog.js';
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length>0&&x.length===y.length&&timingSafeEqual(x,y);}
export function paymentCapability(orderId,packageKey,secret){return createHmac('sha256',secret).update(`shia-payment:v1:${orderId}:${packageKey}`).digest('base64url');}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class PaymentError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export class Payments{
  constructor({stripe,store,config}){this.stripe=stripe;this.store=store;this.config=config;}
  requireReady(){if(!this.config.enabled)throw new PaymentError('El pago en línea todavía no está activo.',503);}
  async provision({orderId,packageKey}){
    this.requireReady();if(typeof orderId!=='string'||!UUID.test(orderId)||!packageFor(packageKey))throw new PaymentError('Solicitud de pago inválida.');
    const token=paymentCapability(orderId,packageKey,this.config.tokenSecret);
    await this.store.provision({orderId,packageKey,tokenHash:hashToken(token)});
    return {orderId,paymentToken:token};
  }
  async checkout({orderId,paymentToken,packageKey}){
    this.requireReady();const p=packageFor(packageKey);
    if(typeof orderId!=='string'||!UUID.test(orderId)||!p||typeof paymentToken!=='string'||paymentToken.length>128)throw new PaymentError('Solicitud de pago inválida.');
    return this.store.withOrder(orderId,async(order,tx)=>{
      if(!order||!sameSecret(order.token_hash,hashToken(paymentToken))||new Date(order.token_expires_at)<=new Date())throw new PaymentError('El acceso al pago no es válido o ha vencido.',403);
      if(order.package_key!==packageKey)throw new PaymentError('El paquete no coincide con su solicitud.',403);
      const canonicalOrderId=order.order_id;
      if(order.payment_status==='paid')throw new PaymentError('Esta solicitud ya tiene un pago confirmado.',409);
      if(order.checkout_session_id){
        const prior=await this.stripe.checkout.sessions.retrieve(order.checkout_session_id);
        if(prior.status==='open')return {url:prior.url};
        if(prior.status==='complete')throw new PaymentError('El pago está en proceso de confirmación. No inicie otro pago.',409);
        if(prior.status!=='expired')throw new PaymentError('No se pudo comprobar el pago anterior.',409);
      }
      const priceId=this.config.priceIds[p.key];const price=await this.stripe.prices.retrieve(priceId);
      if(price.livemode!==false||price.active!==true||price.type!=='one_time'||price.unit_amount!==p.amount||price.currency!==p.currency)throw new PaymentError('El precio de este paquete todavía no está listo.',503);
      const attempt=order.checkout_attempt+1;
      // Eight random letters distinguish this integration in Stripe Workbench; the value is durable for retries.
      const label=`shia-songs-${[...createHmac('sha256',this.config.tokenSecret).update(`integration:${canonicalOrderId}:${attempt}`).digest().subarray(0,8)].map(x=>String.fromCharCode(97+x%26)).join('')}`;
      const args={mode:'payment',line_items:[{price:priceId,quantity:1}],client_reference_id:canonicalOrderId,metadata:{shia_order_id:canonicalOrderId,package_key:p.key},...checkoutReturnUrls(this.config),consent_collection:{terms_of_service:'required'},integration_identifier:label};
      if(tx.reserveAttempt)await tx.reserveAttempt({attempt,requestHash:hashToken(JSON.stringify(args))});
      const session=await this.stripe.checkout.sessions.create(args,{idempotencyKey:`shia:${canonicalOrderId}:${p.key}:${attempt}:v1`});
      if(session.livemode!==false||!session.url?.startsWith('https://checkout.stripe.com/'))throw new PaymentError('La sesión de pago no es válida.',502);
      await tx.saveSession({sessionId:session.id,attempt,integrationIdentifier:label,priceId,amount:p.amount,currency:p.currency});
      return {url:session.url};
    },{tokenHash:hashToken(paymentToken),packageKey});
  }
  async handleEvent(event){
    this.requireReady();
    if(event.livemode!==false)throw new PaymentError('Live events are not accepted by this sandbox scaffold.',400);
    const allowed=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'];
    if(!allowed.includes(event.type))return {received:true,ignored:true};
    const object=event.data?.object;
    if(!object?.id||!event.id)throw new PaymentError('Invalid event.',400);
    // Fetch server-authoritative current state. A success-page visit cannot trigger this path.
    const session=await this.stripe.checkout.sessions.retrieve(object.id);
    if(session.livemode!==false)throw new PaymentError('Live sessions are refused.',400);
    const stored=await this.store.session(session.id);
    if(!stored)return {received:true,ignored:true};
    const p=packageFor(stored.package_key);
    if(!p||session.mode!=='payment'||session.client_reference_id!==stored.order_id||session.metadata?.shia_order_id!==stored.order_id||session.metadata?.package_key!==stored.package_key||session.currency!==stored.currency||session.amount_total!==stored.amount)throw new PaymentError('Session does not match the durable payment order.',400);
    const items=await this.stripe.checkout.sessions.listLineItems(session.id,{limit:2});
    if(items.has_more||items.data.length!==1||items.data[0].price?.id!==stored.price_id||items.data[0].quantity!==1)throw new PaymentError('Session line items do not match the approved package.',400);
    const paid=session.status==='complete'&&['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&session.payment_status==='paid';
    const failed=event.type==='checkout.session.async_payment_failed'&&session.payment_status!=='paid';
    const expired=event.type==='checkout.session.expired'&&session.status==='expired'&&session.payment_status!=='paid';
    // Event receipt, paid state, and fulfillment outbox are one durable transaction.
    await this.store.applyEvent({eventId:event.id,eventType:event.type,sessionId:session.id,orderId:stored.order_id,paid,failed,expired});
    return {received:true};
  }
}
