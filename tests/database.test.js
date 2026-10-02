import test from 'node:test';import assert from 'node:assert/strict';import { readFile,mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';import { PostgresStore } from '../server/store.js';
const id='559a7da0-6206-4eb0-8e53-a78d48994209';
function poolFor(db){const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};return {query,connect:async()=>({query,release(){}}),end:async()=>db.close()};}
test('Actual PostgreSQL schema, session persistence, atomic paid/outbox, deduplication, and restart durability',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shia-payment-db-'));let db=new PGlite(dir);const schema=await readFile('server/schema.sql','utf8');await db.exec(schema);await db.exec(await readFile('server/intake-schema.sql','utf8'));let store=new PostgresStore(null,{pool:poolFor(db)});
 try{
  await store.provision({orderId:id,packageKey:'songs',tokenHash:'a'.repeat(64)});await store.provision({orderId:id,packageKey:'songs',tokenHash:'a'.repeat(64)});
  await assert.rejects(()=>store.provision({orderId:id,packageKey:'slideshow',tokenHash:'b'.repeat(64)}),{status:409});
  await store.withOrder(id,async(o,tx)=>{assert.equal(o.checkout_attempt,0);await tx.saveSession({sessionId:'cs_test_db',attempt:1,integrationIdentifier:'shia-songs-abcdefgh',priceId:'price_songs',amount:2000,currency:'usd'});});
  assert.equal((await store.session('cs_test_db')).amount,2000);
  await db.exec(`CREATE FUNCTION shia_payments.reject_job() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'test outbox failure'; END$$; CREATE TRIGGER reject_job BEFORE INSERT ON shia_payments.fulfillment_jobs FOR EACH ROW EXECUTE FUNCTION shia_payments.reject_job();`);
  const paid={eventId:'evt_db',eventType:'checkout.session.completed',sessionId:'cs_test_db',orderId:id,paid:true,failed:false,expired:false};
  await assert.rejects(()=>store.applyEvent(paid));assert.equal((await db.query('SELECT payment_status FROM shia_payments.orders')).rows[0].payment_status,'pending');assert.equal((await db.query('SELECT * FROM shia_payments.events')).rows.length,0);
  await db.exec('DROP TRIGGER reject_job ON shia_payments.fulfillment_jobs; DROP FUNCTION shia_payments.reject_job();');
  await store.applyEvent(paid);await store.applyEvent(paid);await store.applyEvent({...paid,eventId:'evt_other'});
  assert.equal((await db.query('SELECT * FROM shia_payments.fulfillment_jobs')).rows.length,1);assert.equal((await db.query('SELECT * FROM shia_payments.events')).rows.length,2);
  await store.applyEvent({...paid,eventId:'evt_stale_failure',paid:false,failed:true});assert.equal((await db.query('SELECT payment_status FROM shia_payments.orders')).rows[0].payment_status,'paid');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='shia_payments' AND c.relkind='r' AND c.relrowsecurity")).rows[0].n,4);
  await db.close();db=new PGlite(dir);store=new PostgresStore(null,{pool:poolFor(db)});assert.equal((await store.session('cs_test_db')).price_id,'price_songs');assert.equal((await db.query('SELECT status FROM shia_payments.fulfillment_jobs')).rows[0].status,'pending');
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
