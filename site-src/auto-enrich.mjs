import {lookup as lookupBook,resolveCandidate as resolveBookPreview} from './book-metadata.mjs';
import {readGoogleBooks} from './books-proxy.mjs';
import {makePatch,safeURL} from './media-metadata.mjs';
export function parseTitleYear(value,defaultYear=''){
 const raw=String(value||'').trim(),match=raw.match(/^(.*?)\s*\|\s*(\d{4})\s*$/);
 const title=(match?match[1]:raw).trim(),yearText=match?match[2]:String(defaultYear??'').trim();
 if(!title)throw Error('Indica o título.');
 if(yearText&&!/^[1-9]\d{3}$/.test(yearText))throw Error('O ano deve ter quatro algarismos.');
 return {title,year:yearText?Number(yearText):null};
}
const yearOf=c=>{const m=String(c.year||'').match(/^\d{4}/);return m?Number(m[0]):null;};
const bookPreviewCache=new Map();let bookPreviewAt=0;
async function readBookPreview(value){
 const u=new URL(value);
 if(u.hostname==='www.googleapis.com')return readGoogleBooks(value);
 if(u.origin!=='https://openlibrary.org')throw Error('Fonte de livros inválida');
 if(bookPreviewCache.has(value))return bookPreviewCache.get(value);
 await new Promise(r=>setTimeout(r,Math.max(0,bookPreviewAt-Date.now())));
 bookPreviewAt=Date.now()+1100;
 const r=await fetch(u,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
 if(r.status===404)return null;
 if(!r.ok)throw Error('Open Library HTTP '+r.status);
 const data=await r.json();
 if(bookPreviewCache.size>=64)bookPreviewCache.delete(bookPreviewCache.keys().next().value);
 bookPreviewCache.set(value,data);
 return data;
}
export async function findVersions(item,call){
 if(item.type==='book'){
  const result=await lookupBook(item,readBookPreview);
  if(!result.candidates.length&&result.errors?.length)throw Error(result.errors.join(' · '));
  const candidates=result.candidates.map(c=>({...c,type:'book'}));
  return item.year?[...candidates.filter(c=>yearOf(c)===item.year),...candidates.filter(c=>yearOf(c)!==item.year)]:candidates;
 }
 const query={type:item.type,title:item.title,...(item.year?{year:item.year}:{})};
 let result=await call(query),candidates=(result.candidates||[]).filter(c=>!c.type||c.type===item.type);
 if(item.year&&!candidates.some(c=>yearOf(c)===item.year)){
  const broad=await call({type:item.type,title:item.title});
  const seen=new Set(candidates.map(c=>JSON.stringify([c.provider,c.id,c.title,c.year])));
  for(const c of broad.candidates||[]){const key=JSON.stringify([c.provider,c.id,c.title,c.year]);if((!c.type||c.type===item.type)&&!seen.has(key)){seen.add(key);candidates.push(c);}}
 }
 if(item.year)candidates=[...candidates.filter(c=>yearOf(c)===item.year),...candidates.filter(c=>yearOf(c)!==item.year)];
 return candidates;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isMedia=i=>['movie','series','anime','book'].includes(i.type);
function init(){
 let activeOwner='',wrappedAccount=null;const approved=new WeakSet(),cache=new Map();
 const context=()=>{const account=window.__movookAccount,client=window.__movookClient,uid=account?.user?.id;if(!uid||!client)throw Error('Inicia sessão primeiro.');return {account,client,uid};};
 const guard=uid=>{if(window.__movookAccount?.user?.id!==uid)throw Error('A conta mudou. Volta a pesquisar.');};
 async function call(payload){const{client,uid}=context(),key=JSON.stringify([uid,payload]),hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value;const auth=await client.auth.getSession();guard(uid);if(auth.error||auth.data?.session?.user?.id!==uid)throw Error('Sessão expirada.');const r=await client.functions.invoke('books-search',{body:payload,headers:{Authorization:'Bearer '+auth.data.session.access_token}});guard(uid);if(r.error){let info={};try{info=await r.error.context?.clone().json();}catch{}throw Error(info.error||r.error.message||'Falha na pesquisa.');}if(!Array.isArray(r.data?.candidates))throw Error('Resposta de pesquisa inválida.');if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{until:Date.now()+300000,value:r.data});return r.data;}
 async function resolve(candidate,item){
  let chosen=candidate;
  if(item.type==='book')chosen=await resolveBookPreview(candidate,readBookPreview);
  else if(chosen.details_needed){const r=await call({type:chosen.type||item.type,action:'details',id:chosen.id});chosen=r.candidates?.[0];if(!chosen)throw Error('Não foi possível obter os detalhes desta versão.');}
  if(item.type!=='book'&&chosen.type&&chosen.type!==item.type)throw Error('O tipo da versão encontrada não corresponde ao pedido.');
  return {...chosen,year:yearOf(chosen)};
 }
 function withVersion(item,chosen){
  const base={...item,year:null};
  const patch=makePatch(base,chosen,{});
  const output={...base,...patch,year:yearOf(chosen)};
  const url=safeURL(chosen.source_url||chosen.url||'');
  if(url)output.source_url=url;
  if(chosen.title)output.original_title=chosen.original_title||chosen.title;
  if(item.year)output.requested_year=item.year;
  return output;
 }
 function wrap(){const account=window.__movookAccount;if(!account?.addPersonal||account===wrappedAccount)return;const original=account.addPersonal.bind(account);wrappedAccount=account;account.addPersonal=async item=>{const uid=context().uid;let next=item;if(!approved.has(item)){const parsed=parseTitleYear(item.title,item.year);next={...item,title:parsed.title,original_title:parsed.title,year:parsed.year};if(isMedia(next)&&(!next.cover||!next.synopsis)){const candidates=await findVersions(next,call);if(candidates.length){const chosen=await resolve(candidates[0],next);if(next.year&&yearOf(chosen)!==next.year&&!confirm('Não foi encontrada a versão de '+next.year+'. Adicionar '+chosen.title+' ('+(yearOf(chosen)||'ano desconhecido')+')?'))throw Error('Adição cancelada.');next=withVersion(next,chosen);}}}guard(uid);return original(next);};}
 function installForm(form){if(form.dataset.versionPicker)return;form.dataset.versionPicker='true';
 const titleField=form.querySelector('#fTitles');if(!titleField)return;
 const label=document.createElement('label');label.textContent='Ano (opcional; usado nas linhas sem | Ano)';const year=document.createElement('input');year.id='fYear';year.type='number';year.min='1000';year.max='9999';year.step='1';year.inputMode='numeric';label.append(year);titleField.closest('label').after(label);
 const authorLabel=document.createElement('label');authorLabel.textContent='Autor (opcional, para livros)';const author=document.createElement('input');author.id='fBookAuthor';authorLabel.append(author);label.after(authorLabel);
 const help=document.createElement('p');help.className='muted';help.textContent='Podes escrever Título | Ano em cada linha. O ano da linha tem prioridade. Para livros, escreve o autor para melhorar a pesquisa. Revê a edição antes de adicionar.';label.after(help);
 const panel=document.createElement('div');panel.dataset.versions='';panel.setAttribute('aria-live','polite');form.querySelector('.row')?.before(panel);if(!panel.parentElement)form.append(panel);
 const submit=form.querySelector('[type=submit]');if(submit)submit.textContent='Pesquisar / Pré-visualizar';
 let searching=false,saving=false,resolving=0,revision=0,plans=[],owner='';
 function invalidate(){if(saving)return;revision++;plans=[];panel.replaceChildren();}
 form.addEventListener('input',e=>{if(!panel.contains(e.target))invalidate();});
 form.addEventListener('change',e=>{if(!panel.contains(e.target))invalidate();});
 const message=text=>{const p=document.createElement('p');p.textContent=text;panel.append(p);};
 function showChoice(plan,k){
  const box=panel.querySelector('[data-preview="'+k+'"]');if(!box)return;
  const chosen=plan.chosen;box.replaceChildren();if(!chosen)return;
  const info=document.createElement('p');info.textContent=chosen.title+' — '+(yearOf(chosen)||'ano desconhecido');box.append(info);
  if(plan.item.year&&yearOf(chosen)!==plan.item.year){const warning=document.createElement('p');warning.className='danger';warning.textContent='Ano pedido: '+plan.item.year+'. Esta versão é de '+(yearOf(chosen)||'ano desconhecido')+'. Confirma se pretendes esta alternativa.';box.append(warning);}
  const cover=safeURL(chosen.cover);
  if(cover){const image=document.createElement('img');image.src=cover;image.alt='Capa da versão selecionada';image.style.cssText='width:90px;max-height:140px;object-fit:cover';image.referrerPolicy='no-referrer';box.append(image);}
  const description=document.createElement('p');description.textContent=String(chosen.synopsis||'Sem sinopse disponível.').slice(0,700);box.append(description);
 }
 function render(){
  panel.innerHTML=plans.map((p,k)=>'<section class="stat"><h3>'+esc(p.item.title)+(p.item.year?' — pedido: '+p.item.year:'')+'</h3>'+(p.candidates.length?'<label>Versão<select data-version="'+k+'">'+p.candidates.map((c,j)=>'<option value="'+j+'">'+esc(c.title)+' — '+esc(yearOf(c)||'ano desconhecido')+'</option>').join('')+'</select></label><div data-preview="'+k+'"></div>':'<p class="muted">Sem resultados. Será adicionada uma ficha pendente com o título e ano pedidos.</p>')+'</section>').join('');
  const save=document.createElement('button');save.type='button';save.className='btn fill';save.textContent='Adicionar versões selecionadas';save.onclick=commit;panel.append(save);
  plans.forEach((p,k)=>showChoice(p,k));
  panel.querySelectorAll('[data-version]').forEach(control=>control.onchange=async()=>{
   const k=Number(control.dataset.version),plan=plans[k],ticket=revision;resolving++;save.disabled=true;panel.querySelectorAll('[data-version]').forEach(n=>n.disabled=true);
   try{guard(owner);const chosen=await resolve(plan.candidates[Number(control.value)],plan.item);guard(owner);if(ticket!==revision)return;plan.chosen=chosen;plan.index=Number(control.value);showChoice(plan,k);}
   catch(e){control.value=String(plan.index||0);message('Erro: '+e.message);}
   finally{resolving--;panel.querySelectorAll('[data-version]').forEach(n=>n.disabled=resolving>0);save.disabled=resolving>0;}
  });
 }
 async function commit(){
  if(saving||searching||resolving)return;const ticket=revision;
  try{guard(owner);saving=true;form.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);
   for(const plan of plans){if(plan.saved)continue;guard(owner);if(ticket!==revision)throw Error('A seleção mudou. Volta a pesquisar.');const next=plan.chosen?withVersion(plan.item,plan.chosen):{...plan.item};approved.add(next);await context().account.addPersonal(next);plan.saved=true;}
   guard(owner);form.closest('dialog')?.close();if(typeof window.toast==='function')window.toast('Itens adicionados à tua biblioteca.');
  }catch(e){message('Erro: '+e.message+' Os itens já adicionados não serão repetidos se tentares novamente.');}
  finally{saving=false;form.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=false);}
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();e.stopImmediatePropagation();
  if(searching||saving)return;if(!form.reportValidity())return;
  const ticket=++revision;
  try{
   wrap();owner=context().uid;
   const lines=titleField.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   if(!lines.length||lines.length>30)throw Error('Indica entre 1 e 30 títulos.');
   const parsed=lines.map(t=>parseTitleYear(t,year.value));
   const type=form.querySelector('#fType').value,status=form.querySelector('#fStatus').value,rating=lines.length===1&&form.querySelector('#fRating').value!==''?Number(form.querySelector('#fRating').value):null,review=lines.length===1?form.querySelector('#fReview').value:'',bookAuthor=type==='book'?form.querySelector('#fBookAuthor')?.value.trim():'';
   searching=true;panel.textContent='A pesquisar versões…';if(submit)submit.disabled=true;plans=[];
   for(const entry of parsed){
    guard(owner);
    const item={type,title:entry.title,original_title:entry.title,year:entry.year,creators:bookAuthor?[bookAuthor]:[],genres:[],tags:[],rating,status,date_added:new Date().toISOString().slice(0,10),date_finished:status==='done'?new Date().toISOString().slice(0,10):'',review,synopsis:'',cover:'',source_url:'',length:{}};
    const candidates=await findVersions(item,call);
    guard(owner);
    const chosen=candidates.length?await resolve(candidates[0],item):null;
    if(ticket!==revision)return;
    plans.push({item,candidates,chosen,index:0,saved:false});
   }
   if(ticket===revision)render();
  }catch(e){if(ticket===revision){panel.replaceChildren();message('Erro: '+e.message);}}
  finally{searching=false;if(submit)submit.disabled=false;}
 },true);
 }
 const scan=()=>{const form=document.getElementById('addForm');if(form)installForm(form);};
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});scan();wrap();
 let tries=0;const timer=setInterval(()=>{wrap();if(wrappedAccount||++tries>240)clearInterval(timer);},250);
 window.addEventListener('movook:account',()=>{const uid=window.__movookAccount?.user?.id||'';if(uid!==activeOwner){cache.clear();activeOwner=uid;}queueMicrotask(wrap);});
}
if(typeof document!=='undefined')init();
