import './library-filters.mjs';
function clean(){
  const el=document.querySelector('#insights');
  if(!el)return;
  const heading=[...el.querySelectorAll('h2')].find(h=>/Para ti/i.test(h.textContent));
  if(heading)heading.remove();
  el.querySelectorAll('.recs').forEach(node=>node.remove());
}
function init(){
  const target=document.querySelector('#insights')||document.body;
  new MutationObserver(clean).observe(target,{childList:true,subtree:true});
  clean();
}
if(typeof document!=='undefined')init();
