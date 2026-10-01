import pg from 'pg';
import { PaymentError } from './payments.js';
export class PostgresStore{
  constructor(connectionString,{pool}={}){this.pool=pool||new pg.Pool({connectionString,max:8,connectionTimeoutMillis:5000});}
  async close(){await this.pool.end();}
  async provision({orderId,packageKey,tokenHash}){
    const result=await this.pool.query(`INSERT INTO shia_payments.orders(order_id,package_key,token_hash,token_expires_at) VALUES($1,$2,$3,now()+interval '30 days') ON CONFLICT(order_id) DO UPDATE SET order_id=EXCLUDED.order_id WHERE shia_payments.orders.package_key=EXCLUDED.package_key AND shia_payments.orders.token_hash=EXCLUDED.token_hash RETURNING order_id`,[orderId,packageKey,tokenHash]);
    if(!result.rowCount)throw new PaymentError('El pedido ya tiene un paquete de pago diferente.',409);
  }
  async withOrder(orderId,fn){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const {rows}=await client.query('SELECT * FROM shia_payments.orders WHERE order_id=$1 FOR UPDATE',[orderId]);
      const tx={saveSession:async({sessionId,attempt,integrationIdentifier,priceId,amount,currency})=>{
        await client.query(`INSERT INTO shia_payments.sessions(session_id,order_id,package_key,price_id,amount,currency) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(session_id) DO NOTHING`,[sessionId,orderId,rows[0].package_key,priceId,amount,currency]);
        await client.query(`UPDATE shia_payments.orders SET checkout_session_id=$2,checkout_attempt=$3,integration_identifier=$4,updated_at=now() WHERE order_id=$1`,[orderId,sessionId,attempt,integrationIdentifier]);
      }};
      const value=await fn(rows[0],tx);await client.query('COMMIT');return value;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async session(sessionId){const {rows}=await this.pool.query('SELECT * FROM shia_payments.sessions WHERE session_id=$1',[sessionId]);return rows[0];}
  async applyEvent({eventId,eventType,sessionId,orderId,paid,failed,expired}){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const result=await client.query(`INSERT INTO shia_payments.events(event_id,event_type,session_id) VALUES($1,$2,$3) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,[eventId,eventType,sessionId]);
      if(result.rowCount){
        if(paid){
          await client.query(`UPDATE shia_payments.orders SET payment_status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() WHERE order_id=$1`,[orderId]);
          // The unique order id prevents repeat fulfillment across duplicate events or sessions.
          await client.query(`INSERT INTO shia_payments.fulfillment_jobs(order_id,session_id) VALUES($1,$2) ON CONFLICT(order_id) DO NOTHING`,[orderId,sessionId]);
        }else if(failed||expired){
          await client.query(`UPDATE shia_payments.orders SET payment_status=$2,updated_at=now() WHERE order_id=$1 AND checkout_session_id=$3 AND payment_status<>'paid'`,[orderId,failed?'failed':'expired',sessionId]);
        }
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
