import { createClient } from '@supabase/supabase-js';
// An optional PRIVATE bucket in a separate SHIA project. The shared inventory project is forbidden.
export function createStorage(env=process.env){
 if(!env.SHIA_STORAGE_URL||!env.SHIA_STORAGE_SERVICE_KEY||!env.SHIA_STORAGE_BUCKET)return null;
 const url=new URL(env.SHIA_STORAGE_URL);
 if(url.protocol!=='https:'||url.hostname==='bjnkgxkcbbnbtazelsjs.supabase.co')throw new Error('Use an approved isolated SHIA storage project.');
 const client=createClient(url.origin,env.SHIA_STORAGE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}});
 const bucket=client.storage.from(env.SHIA_STORAGE_BUCKET);
 return {
  async sign(path){const {data,error}=await bucket.createSignedUploadUrl(path);if(error)throw new Error('Storage signing unavailable');return data.signedUrl;},
  async verify(file){const [folder,name]=file.path.split('/');const {data,error}=await bucket.list(folder,{search:name,limit:100});if(error)throw new Error('Storage verification unavailable');const found=data?.find(f=>f.name===name);return found?.metadata?.size===file.size&&found.metadata.mimetype===file.type;}
 };
}
