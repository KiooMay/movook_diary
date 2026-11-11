const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function candidateLabel(candidate){const year=String(candidate.year||'').match(/^\d{4}/)?.[0]||'ano desconhecido';const base=candidate.title+' — '+year;if(candidate.type!=='anime')return base;return base+(candidate.provider==='tmdb'?' — TMDB ('+(candidate.external_ids?.tmdb_media_type==='movie'?'filme':'série')+'; guardar como Anime)':' — Jikan/MyAnimeList');}
export async function searchAnimeFallback(payload,call){
  if(payload.type!=='anime'||payload.action==='details')return call(payload);
  let primary,primaryError;
  try{primary=await call(payload);}catch(error){if(!/Jikan/i.test(error.message||''))throw error;primaryError=error;}
  if(primary?.candidates?.length)return primary;
  if(!String(payload.title||'').trim()){if(primaryError)throw primaryError;return primary;}
  const candidates=[],errors=[],seen=new Set();
  for(const type of ['series','movie']){
    try{
      const result=await call({type,title:payload.title,...(payload.year?{year:payload.year}:{})});
      for(const match of (result.candidates||[]).slice(0,3)){
        if(match.provider!=='tmdb'||!match.id)continue;
        const response=match.details_needed?await call({type,action:'details',id:match.id}):{candidates:[match]};
        const detail=response.candidates?.[0];if(!detail)continue;
        if(!(detail.genres||[]).some(genre=>['animation','animacao'].includes(normalize(genre))))continue;
        const key=type+':'+detail.id;if(seen.has(key))continue;seen.add(key);
        candidates.push({...detail,type:'anime',details_needed:false,anime_fallback:true,external_ids:{...(detail.external_ids||{}),tmdb:String(detail.id),tmdb_media_type:type}});
      }
    }catch(error){if(/sessão|conta mudou|inicia sessão/i.test(error.message||''))throw error;errors.push(error.message||'Falha TMDB');}
  }
  if(!candidates.length&&errors.length)throw Error('Pesquisa alternativa TMDB: '+errors.join(' · '));
  return {candidates,state:candidates.length?'candidates':'not_found',matched_by:'anime_tmdb_fallback',warnings:[...(primaryError?[primaryError.message]:[]),...errors]};
}
