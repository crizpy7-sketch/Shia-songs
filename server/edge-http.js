import { publicConfig } from './catalog.js';
import { PaymentError,sameSecret } from './payments.js';
// Web-standard transport with injected services. It does not assume a deployed table layout.
export async function edgeBody(request,max=16384){
 if(Number(request.headers.get('content-length'))>max)throw new PaymentError('La solicitud es demasiado grande.',413);
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader(),parts=[];let size=0;
 try{
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new PaymentError('La solicitud es demasiado grande.',413);}parts.push(value);}
 }finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
async function edgeJson(request,max){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new PaymentError('Tipo de solicitud no válido.',415);
 const value=JSON.parse(new TextDecoder().decode(await edgeBody(request,max)));
 if(!value||typeof value!=='object'||Array.isArray(value))throw new PaymentError('JSON no válido.');return value;
}
/**
 * @param {{config:any, payments?:{requireReady:()=>void,checkout?:(body:any)=>Promise<any>,handleEvent?:(event:any)=>Promise<any>}|null,
 * intake?:{handle:(body:any)=>Promise<any>}|null, worker?:{runOne:()=>Promise<boolean>}|null,
 * verifyWebhook?:((raw:Uint8Array,signature:string)=>Promise<any>)|null,
 * rateLimit?:((request:Request)=>Promise<any>)|null, paths?:{api:string,intake:string,webhook:string,worker:string}}} options
 */
export function createEdgeHandler({config,payments=null,intake=null,worker=null,verifyWebhook=null,rateLimit=null,
 paths={api:'/functions/v1/shia-song-payments',intake:'/functions/v1/shia-order-intake',webhook:'/functions/v1/shia-stripe-webhook',worker:'/functions/v1/shia-song-notifications'}}){
 const origin=new URL(config.origin);
 if(origin.origin!==config.origin||!(origin.protocol==='https:'||(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))))throw new Error('An exact trusted frontend origin is required.');
 function response(status,value,cors=false){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(cors){headers['Access-Control-Allow-Origin']=config.origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='content-type, apikey';}
  return new Response(status===204?null:JSON.stringify(value),{status,headers});
 }
 return async request=>{
  const rawPath=new URL(request.url).pathname;const path=rawPath.startsWith('/functions/v1/')?rawPath:`/functions/v1${rawPath}`;const customer=[paths.intake,`${paths.api}/payment-config`,`${paths.api}/checkout`].includes(path);let cors=false;
  try{
   if(customer){
    if(request.headers.get('origin')!==config.origin)throw new PaymentError('Origen no permitido.',403);cors=true;
    if(request.method==='OPTIONS')return response(204,null,true);
   }
   if(path===`${paths.api}/payment-config`&&request.method==='GET')return response(200,publicConfig({...config,enabled:!!(config.enabled&&payments&&rateLimit)}),cors);
   if(path===paths.intake&&request.method==='POST'){
    if(!intake||!rateLimit)throw new PaymentError('No se pudo enviar la solicitud.',503);
    await rateLimit(request);return response(200,await intake.handle(await edgeJson(request,128*1024)),cors);
   }
   if(path===`${paths.api}/checkout`&&request.method==='POST'){
    if(!payments||!rateLimit)throw new PaymentError('El pago en línea todavía no está activo.',503);
    await rateLimit(request);payments.requireReady();return response(200,await payments.checkout(await edgeJson(request)),cors);
   }
   if(path===paths.webhook&&request.method==='POST'){
    if(!payments||!verifyWebhook)throw new PaymentError('Webhook is not configured.',503);
    payments.requireReady();const raw=await edgeBody(request,1024*1024);const signature=request.headers.get('stripe-signature');let event;
    if(!signature)throw new PaymentError('Invalid webhook signature.',400);
    try{event=await verifyWebhook(raw,signature);}catch{throw new PaymentError('Invalid webhook signature.',400);}
    return response(200,await payments.handleEvent(event));
   }
   if(path===paths.worker&&request.method==='POST'){
    // A custom scheduler credential is independent of any public publishable key.
    if(request.headers.has('origin')||!sameSecret(request.headers.get('authorization'),`Bearer ${config.workerSecret||''}`)||(config.workerSecret||'').length<32)throw new PaymentError('Unauthorized worker.',401);
    if(!worker)throw new PaymentError('Notification worker is not configured.',503);
    // One bounded attempt per invocation. This reports processing, not inbox delivery.
    return response(200,{processed:await worker.runOne()});
   }
   return response(customer?405:404,{error:customer?'Método no permitido.':'Endpoint no disponible.'},cors);
  }catch(error){
   if(error instanceof PaymentError)return response(error.status,{error:error.message},cors);
   if(error instanceof SyntaxError)return response(400,{error:'JSON no válido.'},cors);
   // Do not expose/log customer payloads, tokens, provider responses or credentials.
   return response(500,{error:'No se pudo completar la solicitud. Intente de nuevo más tarde.'},cors);
  }
 };
}
