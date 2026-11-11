const TRAILER_CACHE=new Map();
function text(node){return String(node?.textContent||'').trim();}
function yearFrom(value){const match=String(value||'').match(/\b(19|20)\d{2}\b/);return match?match[0]:'';}
function youtubeSearch(title,year){const query=[title,year,'trailer'].filter(Boolean).join(' ');return 'https://www.youtube.com/results?search_query='+encodeURIComponent(query);}
function wookSearch(title,creators){const query=[title,...creators].filter(Boolean).join(' ');return 'https://www.wook.pt/pesquisa?query='+encodeURIComponent(query);}
function open(url){const win=window.open(url,'_blank','noopener,noreferrer');if(win)win.opener=null;}
async function animeTrailer(item){
  const id=item?.external_ids?.myanimelist;if(!id)return '';
  const key='mal:'+id;const hit=TRAILER_CACHE.get(key);if(hit)return hit;
  try{const r=await fetch('https://api.jikan.moe/v4/anime/'+encodeURIComponent(id));if(!r.ok)return '';const data=await r.json();const id2=data?.data?.trailer?.youtube_id;const url=id2?'https://www.youtube.com/watch?v='+encodeURIComponent(id2):'';TRAILER_CACHE.set(key,url);return url;}catch{return '';}
}
function install(){
  const modal=document.getElementById('modal');if(!modal)return;
  const style=document.createElement('style');style.textContent='.item-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin:.35rem 0 0}.item-actions a,.item-actions button{font-size:.8rem;padding:.22rem .6rem;border-radius:999px;border:1px solid var(--line);background:none;color:var(--accent);text-decoration:none;cursor:pointer}.item-actions a:hover,.item-actions button:hover{border-color:var(--accent)}';document.head.append(style);
  function enhance(){
    const top=modal.querySelector('.top');if(!top||top.querySelector('.item-actions'))return;
    const title=text(top.querySelector('h2'));if(!title)return;
    const muted=[...top.querySelectorAll('.muted')];const year=yearFrom(muted[0]?.textContent);const creators=(muted[1]?.textContent||'').split(',').map(s=>s.trim()).filter(Boolean);
    const items=window.__movookAccount?.items||[];const item=items.find(x=>String(x.title||'').trim()===title);
    const type=item?.type||(/\bpágs\.\b/i.test(top.textContent)?'book':null);
    const actions=document.createElement('div');actions.className='item-actions';
    if(type==='book'){const a=document.createElement('a');a.href=wookSearch(title,creators);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Wook ↗';actions.append(a);}
    else if(type){const button=document.createElement('button');button.type='button';button.textContent='▶ Trailer';button.onclick=async()=>{button.disabled=true;try{let url=item?.trailer_url||'';if(!url&&type==='anime')url=await animeTrailer(item);open(url||youtubeSearch(title,year));}finally{button.disabled=false;}};actions.append(button);}
    if(actions.children.length){const info=top.querySelector('div');(info||top).append(actions);}
  }
  new MutationObserver(()=>queueMicrotask(enhance)).observe(modal,{childList:true,subtree:true});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();}
