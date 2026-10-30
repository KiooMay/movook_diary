import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function connectBookProxy(source){
  const marker='if(blocked.has(host))';
  if(source.split(marker).length!==2||source.includes("from './books-proxy.mjs'"))throw Error('Ponto de ligação Google Books ausente, repetido ou já aplicado');
  return "import {readGoogleBooks} from './books-proxy.mjs';\n"+source.replace(marker,"if(host==='www.googleapis.com')return readGoogleBooks(url);"+marker);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/book-metadata.mjs';fs.writeFileSync(path,connectBookProxy(fs.readFileSync(path,'utf8')));}
