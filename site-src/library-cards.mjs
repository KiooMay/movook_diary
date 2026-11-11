function favorites(){
  const owner=window.__movookAccount?.user?.id||'guest';
  try{let values=JSON.parse(localStorage.getItem('mobook.favorites:'+owner));if(typeof values==='string')values=JSON.parse(values);return new Set(Array.isArray(values)?values.map(String):[]);}catch{return new Set();}
}
function init(){
  const grid=document.getElementById('grid'),modal=document.getElementById('modal');
  if(!grid||!modal)return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='library-cards.css';document.head.append(css);
  let selected=null,queued=false;
  function source(id){return [...grid.querySelectorAll('.card[data-id]')].find(card=>card.dataset.id===id)?.querySelector('.favstar');}
  function update(){
    const favs=favorites();
    for(const card of grid.querySelectorAll('.card[data-id]')){
      const star=card.querySelector('.favstar');if(!star)continue;
      const active=favs.has(card.dataset.id);
      const value=String(active);if(star.dataset.lightFavorite!==value)star.dataset.lightFavorite=value;
      if(active&&star.textContent!=='♥')star.textContent='♥';
    }
    const pane=modal.querySelector('.m');if(!pane)return;
    const edit=modal.querySelector('[data-edit]');
    const id=edit?.dataset.edit||selected;
    const original=id?source(id):null;
    let button=pane.querySelector('[data-card-favorite]');
    if(!original){button?.remove();return;}
    if(!button){button=document.createElement('button');button.type='button';button.dataset.cardFavorite='';const chips=pane.querySelector('.chips');if(chips)chips.before(button);else pane.append(button);button.addEventListener('click',()=>{const target=source(button.dataset.itemId);if(!target)return;target.click();schedule();});}
    button.dataset.itemId=id;
    const active=favs.has(id),label=active?'Remover dos favoritos':'Adicionar aos favoritos';
    if(button.textContent!==label)button.textContent=label;
    if(button.getAttribute('aria-pressed')!==String(active))button.setAttribute('aria-pressed',String(active));
  }
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;update();});}
  document.addEventListener('click',event=>{
    const card=event.target.closest?.('.card[data-id]');
    if(!card||!grid.contains(card)||event.target.closest('.favstar'))return;
    selected=card.dataset.id;schedule();
  },true);
  modal.addEventListener('close',()=>{selected=null;});
  const observer=new MutationObserver(schedule);
  observer.observe(grid,{childList:true,subtree:true});
  observer.observe(modal,{childList:true,subtree:true});
  for(const name of ['movook:local','movook:remote','movook:library'])window.addEventListener(name,schedule);
  window.addEventListener('movook:account',()=>{selected=null;schedule();});
  window.addEventListener('storage',schedule);
  update();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
