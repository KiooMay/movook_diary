let box=null;
function ensure(){
  if(box)return box;
  box=document.createElement('dialog');
  box.id='coverZoom';
  box.style.cssText='border:0;padding:0;margin:0;background:transparent;width:100vw;height:100vh;max-width:100vw;max-height:100vh;overflow:hidden';
  box.innerHTML='<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.92)"><img alt="" style="max-width:96vw;max-height:92vh;object-fit:contain;border-radius:8px"><button type="button" data-zoom-close aria-label="Fechar" style="position:absolute;top:max(.75rem,env(safe-area-inset-top));right:.75rem;background:rgba(0,0,0,.6);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:999px;padding:.3rem .9rem;font:inherit;cursor:pointer">Fechar</button></div>';
  box.addEventListener('click',e=>{if(e.target!==box.querySelector('img'))box.close();});
  box.addEventListener('close',()=>box.querySelector('img').removeAttribute('src'));
  document.body.append(box);
  return box;
}
function open(img){
  const zoom=ensure(),big=zoom.querySelector('img');
  big.src=img.currentSrc||img.src;
  big.alt=img.alt||'Capa';
  if(!zoom.open)zoom.showModal();
}
function init(){
  const modal=document.querySelector('#modal');
  if(!modal)return;
  const mark=()=>{
    modal.querySelectorAll('img').forEach(img=>{
      if(img.dataset.zoom)return;
      img.dataset.zoom='1';
      img.style.cursor='zoom-in';
      img.setAttribute('role','button');
      img.setAttribute('aria-label','Ampliar capa');
      img.tabIndex=0;
    });
  };
  new MutationObserver(mark).observe(modal,{childList:true,subtree:true});
  mark();
  modal.addEventListener('click',e=>{
    const img=e.target.closest?.('img');
    if(img&&modal.contains(img)&&img.getAttribute('src'))open(img);
  });
  modal.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('img[data-zoom]')){e.preventDefault();open(e.target);}
  });
}
if(typeof document!=='undefined')init();
