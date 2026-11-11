import './music.mjs';
function favorites(){
  const owner=window.__movookAccount?.user?.id||'guest';
  try{let values=JSON.parse(localStorage.getItem('mobook.favorites:'+owner));if(typeof values==='string')values=JSON.parse(values);return new Set(Array.isArray(values)?values.map(String):[]);}catch{return new Set();}
}
function init(){
  const grid=document.getElementById('grid');
  if(!grid)return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='library-cards.css';document.head.append(css);
  let queued=false;
  function update(){
    const favs=favorites();
    const items=window.__movookAccount?.items||[];
    for(const card of grid.querySelectorAll('.card[data-id]')){
      const item=items.find(x=>String(x.id)===card.dataset.id);
      if(item?.type&&card.dataset.mediaType!==item.type)card.dataset.mediaType=item.type;
      const star=card.querySelector('.favstar');if(!star)continue;
      const active=favs.has(card.dataset.id);
      const value=String(active);if(star.dataset.lightFavorite!==value)star.dataset.lightFavorite=value;
      if(active&&star.textContent!=='♥')star.textContent='♥';
    }
  }
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;update();});}
  new MutationObserver(schedule).observe(grid,{childList:true,subtree:true});
  for(const name of ['movook:local','movook:remote','movook:library','movook:account'])window.addEventListener(name,schedule);
  window.addEventListener('storage',schedule);
  update();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
