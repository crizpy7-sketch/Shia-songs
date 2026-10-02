import { readConfig } from './catalog.js';
import { PostgresStore } from './store.js';
import { NotificationWorker,notificationProvider } from './notifications.js';
const config=readConfig();
const provider=notificationProvider();
if(!config.databaseUrl||!provider)throw new Error('Notification database/provider configuration is incomplete; no jobs sent.');
const store=new PostgresStore(config.databaseUrl);
const worker=new NotificationWorker({store,provider});
// Run under a supervised scheduler at least once per minute. A bounded batch exits cleanly.
try{for(let i=0;i<100;i++)if(!await worker.runOne())break;}finally{await store.close();}
