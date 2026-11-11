export function activeFilterCount(controls){return controls.filter(control=>control.value!=='').length;}
function init(){
  const search=document.querySelector('#library #q'),sort=document.querySelector('#library #sort');
  const controls=search?.closest('.controls');
  const filters=['status','genre','tag'].map(id=>document.getElementById(id));
  if(!controls||!sort||filters.some(node=>!node)||controls.dataset.compactFilters)return;
  controls.dataset.compactFilters='1';
  const css=document.createElement('link');css.rel='stylesheet';css.href='library-filters.css';document.head.append(css);
  const toolbar=document.createElement('div');toolbar.className='library-filter-toolbar';
  const details=document.createElement('details');details.className='library-filter-details';
  const summary=document.createElement('summary');summary.textContent='Filtros';summary.setAttribute('aria-controls','library-filter-panel');details.append(summary);
  const panel=document.createElement('div');panel.id='library-filter-panel';panel.className='library-filter-panel';
  for(const node of filters)panel.append(node);
  details.append(panel);
  const clear=document.createElement('button');clear.type='button';clear.className='library-filter-clear';clear.textContent='Limpar';clear.setAttribute('aria-label','Limpar filtros de estado, género e tags');clear.hidden=true;
  toolbar.append(details,clear,sort);
  controls.append(search,toolbar);
  function update(){const count=activeFilterCount(filters);const text=count?'Filtros ('+count+')':'Filtros';if(summary.textContent!==text)summary.textContent=text;clear.hidden=count===0;}
  clear.addEventListener('click',()=>{for(const control of filters){if(control.value==='')continue;control.value='';control.dispatchEvent(new Event('change',{bubbles:true}));}update();});
  controls.addEventListener('change',update);
  details.addEventListener('keydown',event=>{if(event.key==='Escape'&&details.open){details.open=false;summary.focus();}});
  new MutationObserver(update).observe(controls,{childList:true,subtree:true});
  window.addEventListener('movook:library',update);
  window.addEventListener('movook:account',()=>{details.open=false;queueMicrotask(update);});
  update();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
