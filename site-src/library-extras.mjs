const THEME_KEY='movook.appearance';
function applyTheme(value){const root=document.documentElement;if(value==='light'||value==='dark')root.dataset.movookTheme=value;else delete root.dataset.movookTheme;}
function init(){
  const css=document.createElement('link');css.rel='stylesheet';css.href='library-extras.css';document.head.append(css);
  let theme='system';try{const saved=localStorage.getItem(THEME_KEY);if(['system','light','dark'].includes(saved))theme=saved;}catch{}applyTheme(theme);
  const appearance=document.createElement('dialog');appearance.id='appearanceDlg';appearance.setAttribute('aria-labelledby','appearance-title');appearance.innerHTML='<div class="m form"><h2 id="appearance-title">Aparência</h2><fieldset><legend>Tema</legend><label><input type="radio" name="appearance" value="system">Sistema</label><label><input type="radio" name="appearance" value="light">Claro</label><label><input type="radio" name="appearance" value="dark">Escuro</label></fieldset><p class="muted">A escolha fica guardada neste navegador.</p><div class="row"><button type="button" class="btn" data-close>Fechar</button></div></div>';document.body.append(appearance);
  appearance.querySelector('input[value="'+theme+'"]').checked=true;
  appearance.addEventListener('change',event=>{const value=event.target.value;if(!['system','light','dark'].includes(value))return;theme=value;applyTheme(value);try{localStorage.setItem(THEME_KEY,value);}catch{}});
  appearance.querySelector('[data-close]').onclick=()=>appearance.close();
  appearance.addEventListener('click',event=>{if(event.target===appearance)appearance.close();});
  function menu(){const panel=document.querySelector('header nav .ui-more-panel');if(!panel||panel.querySelector('[data-appearance]'))return;const button=document.createElement('button');button.type='button';button.dataset.appearance='';button.textContent='Aparência';button.onclick=()=>appearance.showModal();panel.append(button);}
  menu();const nav=document.querySelector('header nav');if(nav)new MutationObserver(menu).observe(nav,{childList:true,subtree:true});
  const grid=document.getElementById('grid');if(!grid)return;
  const count=document.createElement('p');count.id='library-result-count';count.hidden=true;count.setAttribute('role','status');grid.before(count);
  const recovery=document.createElement('div');recovery.id='library-recovery';recovery.hidden=true;const message=document.createElement('p'),retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Tentar novamente';recovery.append(message,retry);count.before(recovery);
  function owner(){return window.__movookAccount?.user?.id||null;}
  function error(text){if(!owner())return;if(message.textContent!==text)message.textContent=text;recovery.hidden=false;}
  function results(){const account=window.__movookAccount;const total=account?.user?(account.items||[]).length:0;const active=!!document.getElementById('q')?.value.trim()||['status','genre','tag'].some(id=>!!document.getElementById(id)?.value)||!!document.querySelector('#types button.on:not([data-type="all"])');const visible=!!account?.user&&active;count.hidden=!visible;const text=grid.querySelectorAll('.card[data-id]').length+' de '+total+' itens';if(count.textContent!==text)count.textContent=text;const failed=grid.querySelector('p');if(failed&&/Não foi possível carregar/i.test(failed.textContent))error(failed.textContent);}
  new MutationObserver(results).observe(grid,{childList:true,subtree:true});
  document.querySelector('#library .controls')?.addEventListener('input',results);
  document.querySelector('#library .controls')?.addEventListener('change',results);
  const toast=document.getElementById('toast');if(toast)new MutationObserver(()=>{if(/Erro ao carregar a biblioteca/i.test(toast.textContent))error(toast.textContent);}).observe(toast,{childList:true,subtree:true});
  function wrapRefresh(){const account=window.__movookAccount;if(!account?.refresh||account.refresh.movookFeedback)return;const original=account.refresh;const wrapped=async function(...args){const identity=owner();let timer;try{const result=await Promise.race([Promise.resolve().then(()=>original.apply(this,args)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('O carregamento demorou demasiado. A ligação pode ainda estar a terminar. Podes tentar novamente.')),20000);})]);if(owner()===identity)recovery.hidden=true;return result;}catch(cause){if(owner()===identity)error(cause.message||'Não foi possível carregar a biblioteca.');throw cause;}finally{clearTimeout(timer);results();}};wrapped.movookFeedback=true;account.refresh=wrapped;}
  retry.onclick=async()=>{
    if(!owner())return;
    const account=window.__movookAccount;
    if(typeof account?.refresh!=='function'){location.reload();return;}
    wrapRefresh();
    retry.disabled=true;
    try{await account.refresh();if(!recovery.hidden&&!grid.querySelector('.card[data-id]'))location.reload();}catch{if(!grid.querySelector('.card[data-id]'))location.reload();}finally{retry.disabled=false;}
  };
  window.addEventListener('movook:account',()=>{recovery.hidden=true;wrapRefresh();results();});
  window.addEventListener('movook:library',results);wrapRefresh();results();
  if('serviceWorker' in navigator){let controlled=!!navigator.serviceWorker.controller;let dismissed=false;function offer(){if(dismissed||document.getElementById('movook-update'))return;const banner=document.createElement('div');banner.id='movook-update';banner.setAttribute('role','status');const text=document.createElement('p');text.textContent='Nova versão disponível.';const update=document.createElement('button');update.type='button';update.className='btn';update.textContent='Atualizar';const later=document.createElement('button');later.type='button';later.className='btn';later.textContent='Mais tarde';banner.append(text,update,later);document.body.append(banner);update.onclick=()=>{if(document.querySelector('dialog[open]')){text.textContent='Guarda as alterações e fecha as janelas antes de atualizar.';return;}location.reload();};later.onclick=()=>{dismissed=true;banner.remove();};}
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)offer();controlled=true;});
    navigator.serviceWorker.ready.then(registration=>{function watch(worker){if(!worker)return;const check=()=>{if(worker.state==='installed'&&controlled)offer();};worker.addEventListener('statechange',check);check();}watch(registration.installing);if(registration.waiting&&controlled)offer();registration.addEventListener('updatefound',()=>watch(registration.installing));registration.update().catch(()=>{});}).catch(()=>{});
  }
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
