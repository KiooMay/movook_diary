export function connectAnimeSearch(source){
  function once(from,to){if(source.split(from).length!==2)throw Error('Anime integration target missing or ambiguous: '+from);source=source.replace(from,to);}
  if(source.includes("from './anime-search.mjs'"))throw Error('Anime integration already applied');
  once('async function call(payload){','async function call(payload){return searchAnimeFallback(payload,rawCall);}\n async function rawCall(payload){');
  once("info.textContent=chosen.title+' — '+(yearOf(chosen)||'ano desconhecido');","info.textContent=candidateLabel(chosen);");
  once("esc(c.title)+' — '+esc(yearOf(c)||'ano desconhecido')","esc(candidateLabel(c))");
  return "import {searchAnimeFallback,candidateLabel} from './anime-search.mjs';\n"+source;
}
