import { PaymentError } from './payments.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Server-side operator access only. This service is not mounted on any HTTP route.
export async function reviewInquiry({store,storage=null},orderId,{files=false}={}){
 if(typeof orderId!=='string'||!UUID.test(orderId))throw new PaymentError('Invalid inquiry reference.');
 const {rows}=await store.pool.query(`SELECT i.order_id,i.package_key,i.payload,i.manifest,i.created_at,i.finalized_at,
   o.payment_status,o.paid_at FROM shia_intake.inquiries i
   LEFT JOIN shia_payments.orders o USING(order_id)
   WHERE i.order_id=$1 AND i.state='finalized'`,[orderId]);
 const inquiry=rows[0];if(!inquiry)throw new PaymentError('Finalized inquiry not found.',404);
 if(files){
  if(!storage)throw new PaymentError('Private file access is not configured.',503);
  inquiry.manifest=await Promise.all(inquiry.manifest.map(async file=>({...file,view_url:await storage.read(file.path)})));
 }
 return inquiry;
}
