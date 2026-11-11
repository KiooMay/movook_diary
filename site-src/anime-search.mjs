const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ANILIST='https://graphql.anilist.co',JIKAN='https://api.jikan.moe/v4';
export function candidateLabel(candidate){const year=String(candidate.year||'').match(/^\d{4}/)?.[0]||'ano desconhecido';const base=candidate.title+' — '+year;if(candidate.type!=='anime')return base;const source=candidate.provider==='anilist'?'AniList':candidate.provider==='jikan'?'Jikan/MyAnimeList':'TMDB ('+(candidate.external_ids?.tmdb_media_type==='movie'?'filme':'série')+'; guardar como Anime)';return base+' — '+source;}
function mapAniList(a){
  const id=String(a.id||'');if(!id)return null;
  return {provider:'anilist',id,type:'anime',title:a.title?.english||a.title?.romaji||'',original_title:a.title?.romaji||a.title?.native||'',year:a.startDate?.year||'',cover:a.coverImage?.large||a.coverImage?.medium||'',synopsis:(a.description||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').trim(),creators:(a.studios?.nodes||[]).map(x=>x.name),genres:a.genres||[],length:{episodes:a.episodes||0},external_ids:{anilist:id,...(a.idMal?{myanimelist:String(a.idMal)}:{})},source_url:a.siteUrl||'',details_needed:false};
}
function mapAnime(a){
  const id=String(a.mal_id||'');if(!id)return null;
  return {provider:'jikan',id,type:'anime',title:a.title_english||a.title||'',original_title:a.title||'',year:a.year||a.aired?.from?.slice(0,4)||'',cover:a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||'',synopsis:a.synopsis||'',creators:(a.studios||[]).map(x=>x.name),genres:(a.genres||[]).map(x=>x.name),length:{episodes:a.episodes||0},external_ids:{myanimelist:id},source_url:a.url||'',details_needed:false};
}
async function anilist(query,variables){
  const r=await fetch(ANILIST,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(5000)});
  if(r.status===429)throw Error('AniList está a limitar pedidos; tenta novamente dentro de um minuto.');
  if(!r.ok)throw Error('AniList HTTP '+r.status);
  const data=await r.json();if(data.errors?.length)throw Error(data.errors[0].message||'Falha AniList');return data.data;
}
async function jikan(path){const r=await fetch(JIKAN+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4000)});if(r.status===429)throw Error('MyAnimeList está a limitar pedidos; tenta novamente dentro de um minuto.');if(!r.ok)throw Error('Jikan HTTP '+r.status);return r.json();}
function order(candidates,title,year){
  const norm=s=>normalize(s);const exact=candidates.filter(c=>norm(c.title)===norm(title)||norm(c.original_title)===norm(title));
  const ordered=exact.length?[...exact,...candidates.filter(c=>!exact.includes(c))]:candidates;
  if(year){const matching=ordered.filter(c=>String(c.year)===String(year));if(matching.length)return matching;}
  return ordered;
}
export async function searchAnimeFallback(payload,call){
  if(payload.type!=='anime')return call(payload);
  if(payload.action==='details'&&payload.id){
    try{const result=await call(payload);if(result?.candidates?.length)return result;}catch(error){if(/sessão|conta mudou|inicia sessão/i.test(error.message||''))throw error;}
    try{const data=await anilist('query($id:Int){Media(id:$id,type:ANIME){id idMal title{romaji english native}description(asHtml:false)coverImage{large medium}genres studios{nodes{name}}episodes siteUrl startDate{year}}}',{id:Number(payload.id)});const candidate=mapAniList(data?.Media);if(candidate)return {candidates:[candidate],state:'candidates',matched_by:'anime_anilist'};}catch(error){console.warn(error);}
    try{const data=await jikan('/anime/'+encodeURIComponent(payload.id));const candidate=mapAnime(data?.data);if(candidate)return {candidates:[candidate],state:'candidates',matched_by:'anime_jikan'};}catch(error){console.warn(error);}
    return {candidates:[],state:'not_found',matched_by:'anime_primary',warnings:[]};
  }
  const title=String(payload.title||'').trim();if(!title)return call(payload);
  let primaryError=null;
  try{
    const data=await anilist('query($search:String,$year:Int){Page(page:1,perPage:8){media(search:$search,type:ANIME,isAdult:false){id idMal title{romaji english native}description(asHtml:false)coverImage{large medium}genres studios{nodes{name}}episodes siteUrl startDate{year}}}}',{search:title,year:payload.year?Number(payload.year):undefined});
    const candidates=(data?.Page?.media||[]).map(mapAniList).filter(Boolean);
    if(candidates.length)return {candidates:order(candidates,title,payload.year),state:'candidates',matched_by:'anime_anilist'};
  }catch(error){primaryError=error;}
  try{
    const data=await jikan('/anime?q='+encodeURIComponent(title)+'&limit=8&sfw=true');
    const candidates=(data?.data||[]).map(mapAnime).filter(Boolean);
    if(candidates.length)return {candidates:order(candidates,title,payload.year),state:'candidates',matched_by:'anime_jikan'};
  }catch(error){primaryError=primaryError||error;}
  try{
    const result=await call(payload);
    if(result?.candidates?.length)return result;
  }catch(error){
    if(/sessão|conta mudou|inicia sessão/i.test(error.message||''))throw error;
    primaryError=primaryError||error;
  }
  const candidates=[],fallbackErrors=[],seen=new Set();
  for(const type of ['series','movie']){
    try{
      const result=await call({type,title,...(payload.year?{year:payload.year}:{})});
      for(const match of (result.candidates||[]).slice(0,3)){
        if(match.provider!=='tmdb'||!match.id)continue;
        const response=match.details_needed?await call({type,action:'details',id:match.id}):{candidates:[match]};
        const detail=response.candidates?.[0];if(!detail)continue;
        if(!(detail.genres||[]).some(genre=>['animation','animacao'].includes(normalize(genre))))continue;
        const key=type+':'+detail.id;if(seen.has(key))continue;seen.add(key);
        candidates.push({...detail,type:'anime',details_needed:false,anime_fallback:true,external_ids:{...(detail.external_ids||{}),tmdb:String(detail.id),tmdb_media_type:type}});
      }
    }catch(error){
      if(/sessão|conta mudou|inicia sessão/i.test(error.message||''))throw error;
      fallbackErrors.push(error.message||'Falha TMDB');
    }
  }
  const warnings=[primaryError?.message,...fallbackErrors].filter(Boolean);
  return {candidates,state:candidates.length?'candidates':'not_found',matched_by:candidates.length?'anime_tmdb_fallback':'anime_primary',warnings};
}
