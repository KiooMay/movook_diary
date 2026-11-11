import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {connectAnimeSearch} from './connect-anime-search.mjs';
export function connectBookProxy(source){
  const marker='if(blocked.has(host))';
  if(source.split(marker).length!==2||source.includes("from './books-proxy.mjs'"))throw Error('Ponto de ligação Google Books ausente, repetido ou já aplicado');
  return "import {readGoogleBooks} from './books-proxy.mjs';\n"+source.replace(marker,"if(host==='www.googleapis.com')return readGoogleBooks(url);"+marker);
}
export function connectBookPreview(source){
  function once(from,to){if(source.split(from).length!==2)throw Error('Book preview target missing or ambiguous: '+from);source=source.replace(from,to);}
  once("const isMedia=i=>['movie','series','anime'].includes(i.type);","const isMedia=i=>['movie','series','anime','book'].includes(i.type);");
  once('export async function findVersions(item,call){',"export async function findVersions(item,call){\n if(item.type==='book'){const result=await lookupBook(item,readBookPreview);if(!result.candidates.length&&result.errors?.length)throw Error(result.errors.join(' · '));const candidates=result.candidates.map(c=>({...c,type:'book'}));return item.year?[...candidates.filter(c=>yearOf(c)===item.year),...candidates.filter(c=>yearOf(c)!==item.year)]:candidates;}");
  once('async function resolve(candidate,item){let chosen=candidate;',"async function resolve(candidate,item){let chosen=item.type==='book'?await resolveBookPreview(candidate,readBookPreview):candidate;");
  once("label.append(year);titleField.closest('label').after(label);","label.append(year);titleField.closest('label').after(label);\n const authorLabel=document.createElement('label');authorLabel.textContent='Autor (opcional, para livros)';const author=document.createElement('input');author.id='fBookAuthor';authorLabel.append(author);label.after(authorLabel);");
  once('year:entry.year,creators:[],genres:[],tags:[],rating,status',"year:entry.year,creators:type==='book'&&author.value.trim()?[author.value.trim()]:[],genres:[],tags:[],rating,status");
  return `import {lookup as lookupBook,resolveCandidate as resolveBookPreview} from './book-metadata.mjs';
import {readGoogleBooks} from './books-proxy.mjs';
const bookPreviewCache=new Map();let bookPreviewAt=0;
async function readBookPreview(value){const u=new URL(value);if(u.hostname==='www.googleapis.com')return readGoogleBooks(value);if(u.origin!=='https://openlibrary.org')throw Error('Fonte de livros inválida');if(bookPreviewCache.has(value))return bookPreviewCache.get(value);await new Promise(r=>setTimeout(r,Math.max(0,bookPreviewAt-Date.now())));bookPreviewAt=Date.now()+1100;const r=await fetch(u,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});if(r.status===404)return null;if(!r.ok)throw Error('Open Library HTTP '+r.status);const data=await r.json();if(bookPreviewCache.size>=64)bookPreviewCache.delete(bookPreviewCache.keys().next().value);bookPreviewCache.set(value,data);return data;}
`+source;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await import('./anime-search.test.mjs');
  const path='_site/book-metadata.mjs';fs.writeFileSync(path,connectBookProxy(fs.readFileSync(path,'utf8')));
  const animePath='_site/auto-enrich.mjs';const anime=connectBookPreview(connectAnimeSearch(fs.readFileSync(animePath,'utf8')));
  const {spawnSync}=await import('node:child_process');const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:anime,encoding:'utf8'});if(check.status!==0)throw Error(check.stderr||'Invalid preview integration');
  fs.writeFileSync(animePath,anime);
}
