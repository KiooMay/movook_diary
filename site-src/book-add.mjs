import {lookup,resolveCandidate} from './book-metadata.mjs';
const cache=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
async function read(url){
  const host=new URL(url).hostname;if(!['openlibrary.org','www.googleapis.com'].includes(host))throw Error('Fonte inválida');
  if(cache.has(url))return cache.get(url);
  const r=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  if(r.status===404){cache.set(url,null);return null;}
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();cache.set(url,data);return data;
}
function openPreview({title,author,status,rating,review}){
  const dlg=document.createElement('dialog');dlg.className='m form';document.body.append(dlg);
  dlg.innerHTML=`<h2>Adicionar livro</h2><p class="muted">A pesquisar “${esc(title)}”…</p><label>Edição<select data-choice disabled><option value="">A pesquisar…</option></select></label><div data-preview class="muted">Sem pré-visualização.</div><div class="row"><button type="button" class="btn" data-cancel>Cancelar</button><button type="button" class="btn fill" data-add disabled>Adicionar</button></div><p data-message role="status"></p>`;
  dlg.showModal();
  const close=()=>{dlg.close();dlg.remove();};
  dlg.querySelector('[data-cancel]').onclick=close;
  dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
  let selected=null;
  (async()=>{
    try{
      const result=await lookup({type:'book',title,creators:author?[author]:[],external_ids:{}},read);
      const select=dlg.querySelector('[data-choice]');
      if(!result.candidates.length){dlg.querySelector('[data-message]').textContent=result.errors.length?'Não foi possível pesquisar: '+result.errors.join(' · '):'Nenhum resultado encontrado.';select.innerHTML='<option value="">Sem resultados</option>';return;}
      select.innerHTML='<option value="">Escolher edição…</option>'+result.candidates.map((c,i)=>`<option value="${i}">${esc(c.title)} — ${esc((c.authors||[]).join(', '))} — ${esc(c.year||'?')} — ${esc(c.provider)}${(c.isbns||[]).length?' — ISBN '+esc(c.isbns.slice(0,2).join(', ')):''}</option>`).join('');
      select.disabled=false;
      select.onchange=async()=>{
        const value=select.value;selected=null;const add=dlg.querySelector('[data-add]');add.disabled=true;
        const preview=dlg.querySelector('[data-preview]');preview.textContent='A carregar pré-visualização…';
        if(value===''){preview.textContent='Sem pré-visualização.';return;}
        try{const candidate=await resolveCandidate(result.candidates[Number(value)],read);selected=candidate;
        preview.innerHTML=`<div style="display:flex;gap:.8rem;align-items:flex-start"><img src="${esc(candidate.cover||'')}" alt="Capa do livro" referrerpolicy="no-referrer" style="width:90px;border-radius:8px" onerror="this.remove()"><div><strong>${esc(candidate.title)}</strong><div class="muted">${esc((candidate.authors||[]).join(', '))} · ${esc(candidate.year||'?')}</div><div class="txt" style="max-height:180px;overflow:auto">${esc(candidate.synopsis||'Sem sinopse disponível.')}</div></div></div>`;
        add.disabled=false;}catch(error){preview.textContent='Erro ao carregar a edição: '+error.message;}
      };
      dlg.querySelector('[data-add]').onclick=async()=>{
        if(!selected)return;const add=dlg.querySelector('[data-add]');add.disabled=true;
        try{
          const account=window.__movookAccount;if(!account?.user)throw Error('Inicia sessão primeiro.');
          await account.addPersonal({type:'book',title,original_title:selected.title||title,year:selected.year?Number(String(selected.year).slice(0,4))||null:null,creators:selected.authors||[],genres:[],tags:[],rating:rating?parseFloat(rating):null,status,date_added:new Date().toISOString().slice(0,10),date_finished:status==='done'?new Date().toISOString().slice(0,10):'',review,synopsis:selected.synopsis||'',cover:selected.cover||'',source_url:selected.url||'',length:{},external_ids:selected.isbns?.length?{isbn:selected.isbns[0]}:{}});
          close();await account.refresh();
          const toast=document.getElementById('toast');if(toast){toast.textContent='Livro adicionado com capa e sinopse.';toast.hidden=false;setTimeout(()=>toast.hidden=true,6000);}
        }catch(error){add.disabled=false;dlg.querySelector('[data-message]').textContent='Erro: '+error.message;}
      };
    }catch(error){dlg.querySelector('[data-message]').textContent='Erro: '+error.message;}
  })();
}
function install(){
  const form=document.getElementById('addForm');if(!form)return;
  form.addEventListener('submit',event=>{
    if(form.querySelector('#fType')?.value!=='book')return;
    const titles=String(form.querySelector('#fTitles')?.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(titles.length!==1)return;
    event.preventDefault();event.stopImmediatePropagation();
    openPreview({title:titles[0],author:'',status:form.querySelector('#fStatus')?.value||'done',rating:form.querySelector('#fRating')?.value||'',review:form.querySelector('#fReview')?.value||''});
  },true);
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();}
