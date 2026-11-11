import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {connectAnimeSearch} from './connect-anime-search.mjs';
export function connectBookProxy(source){
  const marker='if(blocked.has(host))';
  if(source.split(marker).length!==2||source.includes("from './books-proxy.mjs'"))throw Error('Ponto de ligação Google Books ausente, repetido ou já aplicado');
  return "import {readGoogleBooks} from './books-proxy.mjs';\n"+source.replace(marker,"if(host==='www.googleapis.com')return readGoogleBooks(url);"+marker);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await import('./anime-search.test.mjs');
  const path='_site/book-metadata.mjs';fs.writeFileSync(path,connectBookProxy(fs.readFileSync(path,'utf8')));
  const animePath='_site/auto-enrich.mjs';const anime=connectAnimeSearch(fs.readFileSync(animePath,'utf8'));
  const {spawnSync}=await import('node:child_process');const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:anime,encoding:'utf8'});if(check.status!==0)throw Error(check.stderr||'Invalid anime integration');
  fs.writeFileSync(animePath,anime);
}
