import { mkdir,cp,readFile,writeFile } from 'node:fs/promises';
const dest='artifacts/static-preview';await mkdir(dest,{recursive:true});
for(const file of ['index.html','payment-status.html','credits.html','assets'])await cp(file,`${dest}/${file}`,{recursive:true});
const path=`${dest}/assets/js/app.js`;const app=await readFile(path,'utf8');
if(!app.includes('const PREVIEW_MODE=false;'))throw new Error('Missing explicit preview gate');
await writeFile(path,app.replace('const PREVIEW_MODE=false;','const PREVIEW_MODE=true;'));
await writeFile(`${dest}/PREVIEW.txt`,'Safe visual preview. Intake, file uploads, admin login, and payments are disabled. No live Supabase client is initialized. Serve index.html from a static web server.\n');
console.log(`Safe static preview created at ${dest}. No Site was created or published.`);
