const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function candidateLabel(candidate){const year=String(candidate.year||'').match(/^\d{4}/)?.[0]||'ano desconhecido';const base=candidate.title+' — '+year;if(candidate.type!=='anime')return base;return base+(candidate.provider==='tmdb'?' — TMDB ('+(candidate.external_ids?.tmdb_media_type==='movie'?'filme':'série')+'; guardar como Anime)':' — Jikan/MyAnimeList');}
function variants(title){
  const base=String(title||'').trim();if(!base)return [];
  const clean=base.replace(/\s+/g,' ').trim();
  const noPunctuation=clean.replace(/[\u2018\u2019'’]/g,"'").replace(/[^\p{L}\p{N}\s']/gu,' ').replace(/\s+/g,' ').trim();
  const noArticle=noPunctuation.replace(/^(the|a|an|o|a|os|as)\s+/i,'').trim();
  const compact=noPunctuation.replace(/\s+/g,' ');
  const noYear=compact.replace(/\s*[([]?(19|20)\d{2}[)\]]?\s*$/,'').trim();
  return [...new Set([clean,noYear,noArticle,compact].filter(Boolean))];
}
export async function searchAnimeFallback(payload,call){
  if(payload.type!=='anime'||payload.action==='details')return call(payload);
  const title=String(payload.title||'').trim();
  const errors=[];
  for(const candidateTitle of variants(title)){
    try{
      const result=await call({...payload,title:candidateTitle,year:candidateTitle===title?payload.year:undefined});
      if(result?.candidates?.length)return result;
    }catch(error){
      if(/sessão|conta mudou|inicia sessão/i.test(error.message||''))throw error;
      errors.push(error.message||'Falha Jikan/MyAnimeList');
    }
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
  return {candidates,state:candidates.length?'candidates':'not_found',matched_by:candidates.length?'anime_tmdb_fallback':'anime_primary',warnings:[...errors,...fallbackErrors]};
}
