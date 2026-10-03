import { readConfig } from './catalog.js';
import { PostgresStore } from './store.js';
import { createStorage } from './storage.js';
import { reviewInquiry } from './inquiry-review.js';
const [orderId,option,...extra]=process.argv.slice(2);
if(!orderId||extra.length||(option&&option!=='--files'))throw new Error('Usage: npm run inquiries:review -- <inquiry UUID> [--files]');
const config=readConfig();if(!config.databaseUrl)throw new Error('An approved isolated SHIA database is required.');
const store=new PostgresStore(config.databaseUrl);
try{
 // Output contains private customer data. Run only in an authorized operator terminal;
 // never schedule, pipe to public logs, or paste the result into email/issue trackers.
 const record=await reviewInquiry({store,storage:option?createStorage():null},orderId,{files:option==='--files'});
 process.stdout.write(JSON.stringify(record,null,2)+'\n');
}catch(error){process.stderr.write(`Inquiry review failed: ${error.status||'internal'}.\n`);process.exitCode=1;}finally{await store.close();}
