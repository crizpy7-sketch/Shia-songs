import { t, TRANSLATIONS } from './i18n.js';
export function createPaymentUI({button,panel,note,fetcher=fetch}){
  let order=null;
  const message=source=>{note.dataset.i18n=source;note.textContent=t(source)};
  async function setOrder(value){
    order=value;panel.classList.remove('hidden');button.disabled=true;
    message('El pago en línea todavía no está activo. Su formulario se recibió sin realizar ningún cobro.');
    if(!value.token)return;
    try{
      const response=await fetcher('api/payment-config',{cache:'no-store'});
      if(!response.ok)return;
      const config=await response.json();
      if(config.enabled&&config.packages.some(p=>p.key===value.packageKey)){
        message('El formulario se recibió. Continúe a Stripe para revisar el importe y completar el pago.');button.disabled=false;
      }
    }catch{/* Receiving a story must not fail if the payment server is unavailable. */}
  }
  button.addEventListener('click',async()=>{
    if(button.disabled||!order?.token)return;
    button.disabled=true;message('Preparando el pago seguro…');
    try{
      const response=await fetcher('api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.orderId,paymentToken:order.token,packageKey:order.packageKey})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'No se pudo iniciar el pago.');
      const url=new URL(data.url);
      if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('La dirección de pago no es válida.');
      location.assign(url.href);
    }catch(error){message(Object.hasOwn(TRANSLATIONS,error.message)?error.message:'No se pudo iniciar el pago.');button.disabled=false;}
  });
  return {setOrder};
}
