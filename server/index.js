import { createServer } from 'node:http';
import Stripe from 'stripe';
import { readConfig } from './catalog.js';
import { Payments } from './payments.js';
import { PostgresStore } from './store.js';
import { Intake } from './intake.js';
import { createStorage } from './storage.js';
import { createApp } from './app.js';
const config=readConfig();
if(config.intakeEnabled&&process.env.SHIA_STORAGE_URL)config.storageOrigin=new URL(process.env.SHIA_STORAGE_URL).origin;
const stripe=config.enabled?new Stripe(config.apiKey,{apiVersion:'2026-09-30.endive',maxNetworkRetries:2,timeout:20000}):null;
const store=(config.enabled||config.intakeEnabled)?new PostgresStore(config.databaseUrl):null;
const payments=new Payments({stripe,store,config});
const intake=config.intakeEnabled?new Intake({store,config,storage:createStorage()}):null;
const server=createServer(createApp({config,payments,stripe,intake}));
const port=Number(process.env.PORT)||3000;
server.listen(port,process.env.HOST||'127.0.0.1',()=>{console.log(`SHIA SONGS local preview: http://localhost:${port}`);console.log(config.enabled?'Sandbox checkout is enabled.':'Checkout is disabled. '+config.reasons.join('; '));});
async function stop(){server.close();if(store)await store.close();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
