export function createGoogleBooksReader(context,now=()=>Date.now()){
  const cache=new Map(),cooldowns=new Map();
  return async function readGoogleBooks(value){
    const url=new URL(value);if(url.origin!=='https://www.googleapis.com'||url.pathname!=='/books/v1/volumes')throw Error('Pesquisa Google Books inválida');
    const q=(url.searchParams.get('q')||'').trim(),maxResults=Number(url.searchParams.get('maxResults')||8);
    if(!q||q.length>240||!Number.isInteger(maxResults)||maxResults<1||maxResults>10)throw Error('Parâmetros de pesquisa inválidos');
    const {client,uid}=context();if(!client||!uid)throw Error('Inicia sessão antes de pesquisar livros');
    const auth=await client.auth.getSession();const session=auth.data?.session;
    if(auth.error||!session?.access_token||session.user?.id!==uid)throw Error('Sessão expirada ou conta alterada. Entra novamente.');
    const ck=JSON.stringify([uid,q,maxResults]),hit=cache.get(ck);if(hit&&hit.until>now())return hit.data;
    const until=cooldowns.get(uid)||0;if(until>now())throw Error('Pesquisa temporariamente em pausa. Aguarda '+Math.ceil((until-now())/1000)+' segundos e tenta novamente.');
    let result;try{result=await client.functions.invoke('books-search',{body:{q,maxResults},headers:{Authorization:'Bearer '+session.access_token}});}catch{throw Error('Não foi possível contactar books-search. Verifica a ligação e a sessão.');}
    if(result.error){let detail={};const response=result.error.context;try{if(response?.clone)detail=await response.clone().json();}catch{}const status=response?.status;
      const delay=Number(detail.retry_after)||(status===429?60:status===502&&detail.provider_status===403?30:0);
      if(delay>0)cooldowns.set(uid,now()+Math.min(300,Math.max(5,delay))*1000);
      if(status===401)throw Error('books-search: sessão inválida ou expirada. Sai e volta a entrar.');
      if(status===404)throw Error('A função books-search não foi encontrada no projeto Supabase.');
      const message=typeof detail.error==='string'?detail.error:'Falha ao consultar books-search';
      const provider=Number.isInteger(detail.provider_status)?' (Google HTTP '+detail.provider_status+')':'';
      const reasons=Array.isArray(detail.reasons)?detail.reasons.filter(s=>typeof s==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(s)).slice(0,5).join(', '):'';
      throw Error(message+provider+(reasons?' — '+reasons:'')+(delay>0?'. Aguarda '+Math.min(300,Math.max(5,delay))+' segundos.':''));
    }
    const data=result.data;if(!data||typeof data!=='object'||data.error||(data.items&&!Array.isArray(data.items)))throw Error('Resposta de books-search inválida');
    if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(ck,{until:now()+5*60*1000,data});return data;
  };
}
export const readGoogleBooks=createGoogleBooksReader(()=>({client:globalThis.window?.__movookClient,uid:globalThis.window?.__movookAccount?.user?.id}));
