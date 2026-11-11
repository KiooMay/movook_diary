function init(){
  const toolbar=document.querySelector('#library .library-filter-toolbar'),grid=document.getElementById('grid'),tabs=document.getElementById('types');
  if(!toolbar||!grid||!tabs)return;
  const style=document.createElement('style');style.textContent='#library-result-count{display:none}#selected-category-count{margin:0;align-self:center;color:var(--muted);font-size:.75rem;font-weight:400;line-height:1.4;font-variant-numeric:tabular-nums}';document.head.append(style);
  const counter=document.createElement('p');counter.id='selected-category-count';counter.setAttribute('role','status');
  const details=toolbar.querySelector('.library-filter-details');if(details)details.after(counter);else toolbar.prepend(counter);
  const labels={all:['item','itens'],movie:['filme','filmes'],series:['série','séries'],anime:['anime','animes'],book:['livro','livros']};
  let queued=false;
  function update(){
    counter.hidden=!window.__movookAccount?.user;
    const type=tabs.querySelector('button.on[data-type]')?.dataset.type||'all';
    const count=grid.querySelectorAll('.card[data-id]').length;
    const names=labels[type]||labels.all;
    const text=count+' '+names[count===1?0:1];
    if(counter.textContent!==text)counter.textContent=text;
  }
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;update();});}
  const observer=new MutationObserver(schedule);observer.observe(grid,{childList:true});observer.observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const controls=document.querySelector('#library .controls');controls?.addEventListener('input',schedule);controls?.addEventListener('change',schedule);
  for(const name of ['movook:library','movook:account'])window.addEventListener(name,schedule);
  update();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
