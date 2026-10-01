import { build } from 'esbuild';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('assets/js/vendor',{recursive:true});
await build({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:process.cwd(),sourcefile:'supabase-entry.js'},bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'eof',outfile:'assets/js/vendor/supabase.js'});
console.log('Built pinned Supabase browser bundle. Static site is index.html + assets/.');
