import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';import { tmpdir } from 'node:os';import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore } from '../server/store.js';
import { Intake } from '../server/intake.js';
import { NotificationWorker,notificationProvider } from '../server/notifications.js';
import { hashToken } from '../server/payments.js';
import { readConfig } from '../server/catalog.js';
import { createStorage } from '../server/storage.js';
function poolFor(db){
 const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};let lock=Promise.resolve();
 return {query,connect:async()=>{const prior=lock;let release;lock=new Promise(r=>release=r);await prior;return {query,release};},end:async()=>db.close()};
}
const config={enabled:true,intakeSecret:'local-intake-secret-32-characters-only',tokenSecret:'local-payment-secret-32-characters-only'};
const body=()=>({action:'submit',idempotency_key:randomUUID(),website:'',package_key:'songs',customer_name:'Fake customer',customer_email:'fake@example.invalid',answers:{story:'Fake story only'},files:[]});
const finalFor=(created,file_manifest=[])=>({action:'finalize',order_id:created.order_id,submission_token:created.submission_token,file_manifest});
async function fixture(fn){const db=new PGlite();await db.exec(await readFile('server/schema.sql','utf8'));await db.exec(await readFile('server/intake-schema.sql','utf8'));const store=new PostgresStore(null,{pool:poolFor(db)});const intake=new Intake({store,config});try{await fn({db,store,intake});}finally{await db.close();}}
const rows=async(db,table)=>(await db.query(`SELECT * FROM ${table}`)).rows;
test('Concurrent submit/finalize and lost responses return one inquiry, capability and notification',()=>fixture(async({db,intake})=>{
 const input=body();const [a,b]=await Promise.all([intake.handle(input),intake.handle(input)]);assert.deepEqual(a,b);
 const result=await Promise.all([intake.handle(finalFor(a)),intake.handle(finalFor(b))]);assert.deepEqual(result[0],result[1]);assert.equal(result[0].notification_status,'queued');assert.equal((await rows(db,'shia_intake.inquiries')).length,1);assert.equal((await rows(db,'shia_intake.notifications')).length,1);
 const order=(await rows(db,'shia_payments.orders'))[0];assert.equal(order.token_hash,hashToken(result[0].payment_token));assert.equal(order.payment_status,'pending');
 await assert.rejects(()=>intake.handle({...input,package_key:'slideshow'}),{status:409});await assert.rejects(()=>intake.handle({...finalFor(a),submission_token:'tampered'}),{status:403});
}));
test('Outbox failure rolls back finalize; token remains reusable; payment-provision failure also rolls back',()=>fixture(async({db,intake,store})=>{
 const a=await intake.handle(body());await db.exec(`CREATE FUNCTION shia_intake.reject_job() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fake database failure'; END$$; CREATE TRIGGER reject_job BEFORE INSERT ON shia_intake.notifications FOR EACH ROW EXECUTE FUNCTION shia_intake.reject_job();`);
 await assert.rejects(()=>intake.handle(finalFor(a)));assert.equal((await rows(db,'shia_intake.inquiries'))[0].state,'draft');assert.equal((await rows(db,'shia_payments.orders')).length,0);
 await db.exec('DROP TRIGGER reject_job ON shia_intake.notifications;');const original=store.provision;store.provision=async()=>{throw new Error('fake provision failure');};await assert.rejects(()=>intake.handle(finalFor(a)));assert.equal((await rows(db,'shia_intake.notifications')).length,0);store.provision=original;
 assert((await intake.handle(finalFor(a))).payment_token);
}));
test('Upload verification, exact manifests, captions/order and duplicate-upload recovery',()=>fixture(async({db,intake})=>{
 const input=body();input.package_key='slideshow';input.files=[{name:'fake.jpg',type:'image/jpeg',size:4}];let uploaded=false,signs=0;
 intake.storage={sign:async()=>{signs++;return 'https://storage.example.invalid/fake';},verify:async()=>uploaded};const a=await intake.handle(input);const m={...input.files[0],path:a.uploads[0].path,role:'slideshow',order:1,caption:'Fake caption'};
 await assert.rejects(()=>intake.handle(finalFor(a,[m])),{status:409});uploaded=true;
 const resumed=await intake.handle(input);assert.equal(resumed.uploads[0].uploaded,true);assert.equal(signs,1);
 await assert.rejects(()=>intake.handle(finalFor(a,[{...m,path:'someone-else/0'}])));await assert.rejects(()=>intake.handle(finalFor(a,[{...m,size:1}])));
 await intake.handle(finalFor(a,[m]));await assert.rejects(()=>intake.handle(finalFor(a,[{...m,caption:'changed'}])),{status:409});assert.equal((await rows(db,'shia_intake.inquiries'))[0].manifest[0].caption,'Fake caption');
}));
test('Capture remains successful with checkout disabled and no notification credentials',()=>fixture(async({db,intake,store})=>{
 intake.config={...config,enabled:false};const a=await intake.handle(body());const result=await intake.handle(finalFor(a));assert.equal(result.payment_token,undefined);const worker=new NotificationWorker({store,provider:null});await assert.rejects(()=>worker.runOne(),/configuration_missing/);assert.equal((await rows(db,'shia_intake.notifications'))[0].status,'pending');assert.equal((await rows(db,'shia_intake.inquiries'))[0].state,'finalized');
}));
test('Email failure and uncertain acceptance retry with stable provider key, then mark sent once',()=>fixture(async({db,intake,store})=>{
 const a=await intake.handle(body());await intake.handle(finalFor(a));const keys=[],accepted=new Set();let fail=true;
 const provider={send:async({key})=>{keys.push(key);if(fail){fail=false;throw new Error('secret destination provider payload');}accepted.add(key);return 'fake-provider-id';}};const worker=new NotificationWorker({store,provider});
 await worker.runOne();let job=(await rows(db,'shia_intake.notifications'))[0];assert.equal(job.status,'failed');assert.equal(job.last_error,'provider_unavailable');assert.equal(job.attempts,1);
 await db.exec("UPDATE shia_intake.notifications SET available_at=now()");
 const original=store.finishNotification.bind(store);let lostAck=true;store.finishNotification=async(...args)=>{if(lostAck&&args[1].providerId){lostAck=false;throw new Error('fake acknowledgement failure');}return original(...args);};
 await worker.runOne();await db.exec("UPDATE shia_intake.notifications SET available_at=now()");await worker.runOne();assert.equal(await worker.runOne(),false);
 job=(await rows(db,'shia_intake.notifications'))[0];assert.equal(job.status,'sent');assert.equal(job.attempts,3);assert.equal(new Set(keys).size,1);assert.equal(accepted.size,1);
}));
test('Worker leases recover crashes and fence stale acknowledgements; parallel claims cannot share a job',()=>fixture(async({db,intake,store})=>{
 await intake.handle(finalFor(await intake.handle(body())));const [first,other]=await Promise.all([store.claimNotification(randomUUID()),store.claimNotification(randomUUID())]);assert(first);assert.equal(other,undefined);
 await db.exec("UPDATE shia_intake.notifications SET locked_until=now()-interval '1 second'");const recovered=await store.claimNotification(randomUUID());assert.notEqual(first.lease_id,recovered.lease_id);
 await store.finishNotification(first,{providerId:'stale'});assert.equal((await rows(db,'shia_intake.notifications'))[0].status,'processing');await store.finishNotification(recovered,{providerId:'current'});assert.equal((await rows(db,'shia_intake.notifications'))[0].provider_id,'current');
}));
test('Expired provider dedupe window quarantines job without sending',()=>fixture(async({db,intake,store})=>{
 await intake.handle(finalFor(await intake.handle(body())));await db.exec("UPDATE shia_intake.notifications SET created_at=now()-interval '25 hours'");let calls=0;const worker=new NotificationWorker({store,provider:{idempotencyWindowMs:86400000,send:async()=>{calls++;}}});await worker.runOne();assert.equal(calls,0);assert.equal((await rows(db,'shia_intake.notifications'))[0].status,'blocked');assert.equal(await worker.runOne(),false);
}));
test('Paid notifications commit atomically with event, paid state and fulfillment; duplicate events enqueue once',()=>fixture(async({db,intake,store})=>{
 const a=await intake.handle(body());await intake.handle(finalFor(a));await store.withOrder(a.order_id,async(o,tx)=>tx.saveSession({sessionId:'cs_fake',attempt:1,integrationIdentifier:'fake',priceId:'price_fake',amount:2000,currency:'usd'}));
 const event={eventId:'evt_fake',eventType:'checkout.session.completed',sessionId:'cs_fake',orderId:a.order_id,paid:true};await store.applyEvent(event);await store.applyEvent(event);await store.applyEvent({...event,eventId:'evt_fake_2'});
 assert.equal((await rows(db,'shia_intake.notifications')).length,2);assert.equal((await rows(db,'shia_payments.fulfillment_jobs')).length,1);
}));
test('Finalize and notifications survive database restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shia-intake-'));let db=new PGlite(dir);
 try{await db.exec(await readFile('server/schema.sql','utf8'));await db.exec(await readFile('server/intake-schema.sql','utf8'));let intake=new Intake({store:new PostgresStore(null,{pool:poolFor(db)}),config});const input=body(),a=await intake.handle(input);const first=await intake.handle(finalFor(a));await db.close();db=new PGlite(dir);intake=new Intake({store:new PostgresStore(null,{pool:poolFor(db)}),config});assert.deepEqual(await intake.handle(input),a);assert.deepEqual(await intake.handle(finalFor(a)),first);assert.equal((await rows(db,'shia_intake.notifications')).length,1);}finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
test('Provider requires explicit sender/destination; validates HTTP and avoids transmitting customer details',async()=>{
 assert.equal(notificationProvider({NOTIFICATION_PROVIDER:'resend',RESEND_API_KEY:'fake'}),null);assert.equal(notificationProvider({NOTIFICATION_PROVIDER:'webhook',NOTIFICATION_WEBHOOK_URL:'http://unsafe.invalid'}),null);
 const env={NOTIFICATION_PROVIDER:'resend',RESEND_API_KEY:'fake-not-a-secret',NOTIFICATION_FROM:'fake@example.invalid',NOTIFICATION_TO:'recipient@example.invalid'};let request;
 const provider=notificationProvider(env,async(url,opts)=>{request=opts;return {ok:false,status:429};});await assert.rejects(()=>provider.send({key:'fake-key',orderId:'fake-id',kind:'inquiry'}),/provider_http_429/);assert.equal(request.headers['Idempotency-Key'],'fake-key');assert(!request.body.includes('Fake story'));
 assert.throws(()=>createStorage({SHIA_STORAGE_URL:'https://bjnkgxkcbbnbtazelsjs.supabase.co',SHIA_STORAGE_SERVICE_KEY:'fake',SHIA_STORAGE_BUCKET:'fake'}),/isolated/);
});
test('Deployed API and worker role artifacts enforce private ledger and queue isolation',()=>fixture(async({db,intake,store})=>{
 await db.exec(await readFile('server/roles.sql','utf8'));await db.exec('SET ROLE shia_api');const a=await intake.handle(body());await intake.handle(finalFor(a));
 await db.exec('RESET ROLE; SET ROLE shia_notifications');assert.equal((await rows(db,'shia_intake.notifications')).length,1);await assert.rejects(()=>rows(db,'shia_intake.inquiries'),/permission denied/);await assert.rejects(()=>rows(db,'shia_payments.orders'),/permission denied/);const job=await store.claimNotification(randomUUID());await store.finishNotification(job,{providerId:'fake'});await db.exec('RESET ROLE');
 assert.equal((await rows(db,'shia_intake.notifications'))[0].status,'sent');
}));
test('Paid-alert insertion failure rolls back webhook receipt, paid state and fulfillment',()=>fixture(async({db,intake,store})=>{
 const a=await intake.handle(body());await intake.handle(finalFor(a));await store.withOrder(a.order_id,async(o,tx)=>tx.saveSession({sessionId:'cs_fail_alert',attempt:1,integrationIdentifier:'fake',priceId:'price_fake',amount:2000,currency:'usd'}));
 await db.exec(`CREATE FUNCTION shia_intake.reject_paid() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.kind='paid' THEN RAISE EXCEPTION 'fake paid queue failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER reject_paid BEFORE INSERT ON shia_intake.notifications FOR EACH ROW EXECUTE FUNCTION shia_intake.reject_paid();`);
 const event={eventId:'evt_fail_alert',eventType:'checkout.session.completed',sessionId:'cs_fail_alert',orderId:a.order_id,paid:true};await assert.rejects(()=>store.applyEvent(event));assert.equal((await rows(db,'shia_payments.orders'))[0].payment_status,'pending');assert.equal((await rows(db,'shia_payments.events')).length,0);assert.equal((await rows(db,'shia_payments.fulfillment_jobs')).length,0);
 await db.exec('DROP TRIGGER reject_paid ON shia_intake.notifications');await store.applyEvent(event);assert.equal((await rows(db,'shia_payments.orders'))[0].payment_status,'paid');
}));

test('Isolated intake config is opt-in and refuses shared databases or invalid origin',()=>{
 const env={INTAKE_ENABLED:'true',DATABASE_URL:'postgresql://localhost/shia_local',INTAKE_TOKEN_SECRET:'a'.repeat(32)};assert.equal(readConfig({}).intakeEnabled,false);assert.equal(readConfig(env).intakeEnabled,true);assert.equal(readConfig({...env,APP_ORIGIN:'https://example.invalid/path'}).intakeEnabled,false);assert.equal(readConfig({...env,DATABASE_URL:'postgresql://db.bjnkgxkcbbnbtazelsjs.supabase.co/postgres'}).databaseUrl,null);
});
test('Malformed credentials/packages fail safely without saving an inquiry',()=>fixture(async({db,intake})=>{
 const a=await intake.handle(body());for(const token of [42,{},[],null])await assert.rejects(()=>intake.handle({...finalFor(a),submission_token:token}),{status:403});
 for(const idempotency_key of [[randomUUID()],{},42,null])await assert.rejects(()=>intake.handle({...body(),idempotency_key}),{status:400});
 for(const package_key of [['songs'],{},null])await assert.rejects(()=>intake.handle({...body(),package_key}),{status:400});assert.equal((await rows(db,'shia_intake.inquiries')).length,1);
}));
test('Private reviewer can inspect finalized inquiries and short-lived file URLs, but cannot mutate or read tokens',()=>fixture(async({db,intake,store})=>{
 const {reviewInquiry}=await import('../server/inquiry-review.js');await db.exec(await readFile('server/roles.sql','utf8'));
 const a=await intake.handle(body());await intake.handle(finalFor(a));const draft=await intake.handle(body());
 await db.exec('SET ROLE shia_review');const result=await reviewInquiry({store},a.order_id);assert.equal(result.payload.customer_email,'fake@example.invalid');assert.equal(result.payment_status,'pending');assert(!JSON.stringify(result).includes('token_hash'));assert.equal(result.request_hash,undefined);
 await assert.rejects(()=>reviewInquiry({store},draft.order_id),{status:404});await assert.rejects(()=>reviewInquiry({store},'invalid'),{status:400});
 await assert.rejects(()=>db.query('SELECT token_hash FROM shia_payments.orders'),/permission denied/);await assert.rejects(()=>db.query("UPDATE shia_intake.inquiries SET state='draft'"),/permission denied/);await assert.rejects(()=>db.query('SELECT * FROM shia_intake.notifications'),/permission denied/);await db.exec('RESET ROLE');
 const input=body();input.files=[{name:'fake.jpg',type:'image/jpeg',size:4}];intake.storage={verify:async()=>true};const fileOrder=await intake.handle(input);const file={...input.files[0],path:fileOrder.uploads[0].path,role:'slideshow',order:1,caption:'Fake caption'};await intake.handle(finalFor(fileOrder,[file]));
 const paths=[];await db.exec('SET ROLE shia_review');const withFiles=await reviewInquiry({store,storage:{read:async path=>{paths.push(path);return 'https://private.example.invalid/fake-expiring';}}},fileOrder.order_id,{files:true});assert.deepEqual(paths,[file.path]);assert.equal(withFiles.manifest[0].view_url,'https://private.example.invalid/fake-expiring');await db.exec('RESET ROLE');
}));
test('Resend empty acknowledgement is treated as failure rather than successful delivery',async()=>{
 const env={NOTIFICATION_PROVIDER:'resend',RESEND_API_KEY:'fake',NOTIFICATION_FROM:'fake@example.invalid',NOTIFICATION_TO:'fake@example.invalid'};
 const provider=notificationProvider(env,async()=>({ok:true,json:async()=>({id:''})}));await assert.rejects(()=>provider.send({key:'fake-key',kind:'inquiry',orderId:'fake'}),/provider_invalid_response/);
});
