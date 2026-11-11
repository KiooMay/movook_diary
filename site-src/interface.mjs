import './notes-photo.mjs';
const heading=document.querySelector('header h1');
if(heading){heading.textContent='';const home=document.createElement('a');home.href='./';home.textContent='MOVOOK';home.style.cssText='color:inherit;text-decoration:none';home.setAttribute('aria-label','Ir para a página inicial do MOVOOK');heading.append(home);}
const custom=document.querySelector('link[href="custom.css"]');
if(custom)document.head.append(custom);
if(!document.querySelector('link[data-movook-interface]')){const link=document.createElement('link');link.rel='stylesheet';link.href='interface.css';link.dataset.movookInterface='';if(custom)custom.before(link);else document.head.append(link);}
const nav=document.querySelector('header nav');
if(nav){
  const menu=document.createElement('details');menu.className='ui-more';
  const summary=document.createElement('summary');summary.textContent='Mais ▾';summary.setAttribute('aria-label','Mais opções');menu.append(summary);
  const panel=document.createElement('div');panel.className='ui-more-panel';menu.append(panel);nav.append(menu);
  const about=document.createElement('dialog');about.id='ui-about';about.innerHTML='<div class="m"><h2>Sobre</h2><p class="muted">MOVOOK — a tua biblioteca pessoal de filmes, séries, animes e livros.</p><div class="row ui-dialog-actions"><button type="button" class="btn" data-ui-close>Fechar</button></div></div>';document.body.append(about);
  about.querySelector('[data-ui-close]').onclick=()=>about.close();
  const aboutButton=document.createElement('button');aboutButton.type='button';aboutButton.textContent='Sobre';aboutButton.onclick=()=>about.showModal();panel.append(aboutButton);
  function organize(){
    for(const node of [...nav.children]){if(node===menu||!node.matches('button,a'))continue;if(node.hasAttribute('data-view')||['addBtn','addLink'].includes(node.id))continue;panel.insertBefore(node,aboutButton);}
    for(const [id,label] of [['cfgBtn','Definições'],['refreshBtn','Atualizar biblioteca']]){const b=document.getElementById(id);if(b&&b.textContent!==label)b.textContent=label;}
    for(const footer of document.querySelectorAll('main > footer'))if(footer.querySelector('a[href="https://www.themoviedb.org/"]'))footer.remove();
    for(const link of document.querySelectorAll('#modal a'))if(/^Ver (?:na fonte|a fonte|fonte|mais)(?:\s*↗)?$/i.test(link.textContent.trim()))link.textContent='+Info';
  }
  function dialogActions(dialog){
    const pane=dialog.firstElementChild;if(!pane)return;const buttons=[...pane.querySelectorAll('button')].filter(b=>/^(Fechar|Cancelar)$/i.test(b.textContent.trim()));const groups=new Map();
    for(const b of buttons){let row=b.closest('.row');if(!row||!pane.contains(row)){row=pane.querySelector(':scope > .ui-dialog-actions');if(!row){row=document.createElement('div');row.className='row ui-dialog-actions';pane.append(row);}if(b.parentElement!==row)row.append(b);}row.classList.add('ui-dialog-actions');if(!groups.has(row))groups.set(row,[]);groups.get(row).push(b);}
    for(const [row,closes] of groups){const children=[...row.children],desired=[...children.filter(n=>!closes.includes(n)),...closes];if(children.some((n,i)=>n!==desired[i]))row.replaceChildren(...desired);if(row.parentElement!==pane||pane.lastElementChild!==row)pane.append(row);}
  }
  let queued=false;const refresh=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;organize();document.querySelectorAll('dialog').forEach(dialogActions);});};
  panel.addEventListener('click',e=>{if(e.target.closest('button,a'))menu.open=false;});
  document.addEventListener('click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;summary.focus();}});
  const observer=new MutationObserver(records=>{if(records.some(r=>(r.target instanceof Element&&(r.target===nav||r.target.matches('main')||r.target.closest('dialog')))||[...r.addedNodes].some(n=>n instanceof Element&&n.matches('dialog,footer'))))refresh();});
  observer.observe(document.body,{childList:true,subtree:true});refresh();
}
function installAddDefault(){
  const apply=()=>{const form=document.getElementById('addForm');if(!form||form.dataset.defaultDone)return;const status=form.querySelector('#fStatus');if(status){status.value='done';form.dataset.defaultDone='1';}};
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});apply();
}
function installCompletionSorting(){
  if(typeof SORTS==='undefined'||typeof state==='undefined'||typeof window.setupControls!=='function'||typeof renderGrid!=='function')return;
  const completionDate=item=>{const value=String(item.date_finished||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:'';};
  const compare=(a,b,ascending)=>{const x=completionDate(a),y=completionDate(b);if(!x&&y)return 1;if(x&&!y)return -1;return (ascending?x.localeCompare(y):y.localeCompare(x))||String(a.title||'').localeCompare(String(b.title||''),'pt');};
  SORTS.yearNewest=['Ano — mais recentes',(a,b)=>(b.year||0)-(a.year||0)];
  SORTS.finishedNewest=['Visto/lido — mais recentes primeiro',(a,b)=>compare(a,b,false)];
  SORTS.finishedOldest=['Visto/lido — mais antigos primeiro',(a,b)=>compare(a,b,true)];
  let selected='added';
  const originalSetup=window.setupControls;
  window.setupControls=function(...args){state.sort=selected;const result=originalSetup.apply(this,args);const control=document.getElementById('sort');if(control)control.value=selected;return result;};
  document.getElementById('sort')?.addEventListener('change',event=>{if(Object.hasOwn(SORTS,event.target.value))selected=event.target.value;});
  window.addEventListener('movook:account',()=>{selected='added';});
  window.setupControls();
  renderGrid();
}
installAddDefault();
installCompletionSorting();
