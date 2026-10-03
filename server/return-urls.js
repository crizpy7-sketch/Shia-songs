// Trusted runtime configuration only; the browser cannot choose return URLs.
export function frontendBase(origin,value){
 const base=new URL(value||`${origin}/`);
 if(base.origin!==origin||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/'))throw new Error('Invalid frontend base URL');
 return base.href;
}
export function checkoutReturnUrls(config){
 const base=frontendBase(config.origin,config.frontendBaseUrl);
 return {success_url:new URL('payment-status.html',base).href,cancel_url:`${base}?checkout=cancelled#paquetes`};
}
