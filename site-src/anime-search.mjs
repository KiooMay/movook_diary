const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const JIKAN='https://api.jikan.moe/v4';
export function candidateLabel(candidate){const year=String(candidate.year||'').match(/^\d{4}/)?.[0]||'ano desconhecido';const base=candidate.title+' — '+year;if(candidate.type!=='anime')return base;return base+(candidate.provider==='tmdb'?' — TMDB ('+(candidate.external_ids?.tmdb_media_type==='movie'?'filme':'série')+'; guardar como Anime)':' — Jikan/MyAnimeList');}
function mapAnime(a){
  const id=String(a.mal_id||'');if(!id)return null;
  return {provider:'jikan',id,type:'anime',title:a.title_english||a.title||'',original_title:a.title||'',year:a.year||a.aired?.from?.slice(0,4)||'',cover:a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||'',synopsis:a.synopsis||'',creators:(a.studios||[]).map(x=>x.name),genres:(a.genres||[]).map(x=>x.name),length:{episodes:a.episodes||0},external_ids:{myanimelist:id},source_url:a.url||'',details_needed:false};
}
async function jikan(path){const r=await fetch(JIKAN+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4000)});if(r.status===429)throw Error('MyAnimeList está a limitar pedidos; tenta novamente dentro de um minuto.');if(!r.ok)throw Error('Jikan HTTP '+r.status);return r.json();}
export async function searchAnimeFallback(payload,call){
  if(payload.type!=='anime')return call(payload);
  if(payload.action==='details'&&payload.id){
    try{const data=await jikan('/anime/'+encodeURIComponent(payload.id));const candidate=mapAnime(data?.data);if(candidate)return {candidates:[candidate],state:'candidates',matched_by:'anime_jikan'};}catch(error){console.warn(error);}
    return call(payload);
  }
  const title=String(payload.title||'').trim();if(!title)return call(payload);
  const query=title.replace(/[\u2018\u2019'’]/g,"'").replace(/[^\p{L}\p{N}\s']/gu,' ').replace(/\s+/g,' ').trim();
  let primaryError=null;
  try{
    const data=await jikan('/anime?q='+encodeURIComponent(query)+'&limit=8&sfw=true');
    const candidates=(data?.data||[]).map(mapAnime).filter(Boolean);
    if(candidates.length){
      const norm=s=>normalize(s);
      const exact=candidates.filter(c=>norm(c.title)===norm(title)||norm(c.original_title)===norm(title));
      const ordered=exact.length?[...exact,...candidates.filter(c=>!exact.includes(c))]:candidates;
      if(payload.year){const year=String(payload.year);const matching=ordered.filter(c=>String(c.year)===year);if(matching.length)return {candidates:matching,state:'candidates',matched_by:'anime_jikan'};}
      return {candidates:ordered,state:'candidates',matched_by:'anime_jikan'};
    }
  }catch(error){primaryError=error;}
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
