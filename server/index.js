import { createServer } from 'node:http';
import Stripe from 'stripe';
import { readConfig } from './catalog.js';
import { Payments } from './payments.js';
import { PostgresStore } from './store.js';
import { createApp } from './app.js';
const config=readConfig();
const stripe=config.enabled?new Stripe(config.apiKey,{apiVersion:'2026-09-30.endive',maxNetworkRetries:2,timeout:20000}):null;
const store=config.enabled?new PostgresStore(config.databaseUrl):null;
const payments=new Payments({stripe,store,config});
const server=createServer(createApp({config,payments,stripe}));
const port=Number(process.env.PORT)||3000;
server.listen(port,'127.0.0.1',()=>{console.log(`SHIA SONGS local preview: http://localhost:${port}`);console.log(config.enabled?'Sandbox checkout is enabled.':'Checkout is disabled. '+config.reasons.join('; '));});
async function stop(){server.close();if(store)await store.close();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
