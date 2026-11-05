function init(){
const nav=document.querySelector('header nav'),main=document.querySelector('main');
if(!nav||!main)return;
const pages=nav.querySelector('.nav-pages');if(!pages)return;
const btn=document.createElement('button');btn.dataset.view='notes';btn.textContent='Notas';pages.append(btn);
const section=document.createElement('section');section.id='notes';section.hidden=true;
section.innerHTML=`<div class="notes-head"><h2 class="sec">Notas</h2><button class="btn" id="newNote">+ Nota</button></div><div class="tabs" id="noteFilters"><button data-filter="" class="on">Todas</button><button data-filter="todo">Por fazer</button><button data-filter="done">Feitas</button></div><div id="notesGrid" class="grid"></div><p id="notesEmpty" class="muted" hidden>Sem notas.</p>`;
main.append(section);
const style=document.createElement('style');
style.textContent=`.notes-head{display:flex;align-items:center;justify-content:space-between;gap:.7rem}.notes-head h2{margin:0}#notesGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}.note-card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;text-align:left;display:flex;flex-direction:column}.note-cover{aspect-ratio:16/9;background:var(--line);display:grid;place-items:center;color:var(--muted);font-size:1.6rem}.note-cover img{width:100%;height:100%;object-fit:cover;display:block}.note-body{padding:.7rem;display:grid;gap:.35rem}.note-body strong{font-size:.98rem;line-height:1.25}.note-meta{color:var(--muted);font-size:.82rem}.note-status{align-self:start;border-radius:999px;padding:.1rem .55rem;font-size:.75rem;border:1px solid var(--line)}.note-status.done{background:color-mix(in srgb,#2e9e5b 18%,transparent);border-color:#2e9e5b;color:#20713f}.note-actions{display:flex;gap:.35rem;padding:0 .7rem .7rem;flex-wrap:wrap}.note-actions button{font-size:.8rem;padding:.3rem .6rem}.note-text{white-space:pre-wrap}`;
document.head.append(style);
const dlg=document.createElement('dialog');document.body.append(dlg);
let notes=[],filter='',editing=null,busy=false;
const $=s=>section.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
function session(){const sb=window.__movookClient,uid=window.__movookAccount?.user?.id;if(!sb||!uid)throw Error('Inicia sessão para usar as notas.');return{sb,uid};}
async function imageUrl(path){if(!path)return '';const{sb}=session();const{data,error}=await sb.storage.from('user-notes').createSignedUrl(path,3600);if(error)return '';return data?.signedUrl||'';}
async function load(){try{const{sb,uid}=session();const{data,error}=await sb.from('user_notes').select('*').eq('user_id',uid).order('created_at',{ascending:false});if(error)throw error;notes=data||[];}catch(e){notes=[];section.querySelector('#notesGrid').innerHTML=`<p class="muted">Não foi possível carregar as notas: ${esc(e.message)}</p>`;}render();}
function render(){
const list=notes.filter(n=>!filter||n.status===filter);
const grid=$('#notesGrid');
grid.innerHTML='';
$('#notesEmpty').hidden=list.length>0;
for(const n of list){
const card=document.createElement('button');card.className='note-card';card.dataset.id=n.id;
card.innerHTML=`<div class="note-cover" data-cover></div><div class="note-body"><strong>${esc(n.title)}</strong><span class="note-meta">${esc([n.place,n.note_date].filter(Boolean).join(' · '))}</span><span class="note-status ${n.status==='done'?'done':''}">${n.status==='done'?'Feito':'Por fazer'}</span></div><div class="note-actions"><button data-toggle="${n.id}">${n.status==='done'?'Marcar por fazer':'Marcar feito'}</button><button data-edit="${n.id}">Editar</button><button data-delete="${n.id}">Apagar</button></div>`;
const cover=card.querySelector('[data-cover]');
if(n.image_path)imageUrl(n.image_path).then(u=>{if(u)cover.innerHTML=`<img src="${esc(u)}" alt="" loading="lazy">`;});
else cover.textContent='📝';
grid.append(card);
}
}
function openForm(note=null){
editing=note;
dlg.innerHTML=`<form class="m form" id="noteForm"><h2>${note?'Editar nota':'Nova nota'}</h2><label>Título<input name="title" required maxlength="120" value="${esc(note?.title||'')}"></label><label>Local (opcional)<input name="place" maxlength="120" value="${esc(note?.place||'')}"></label><label>Data (opcional)<input name="note_date" type="date" value="${esc(note?.note_date||'')}"></label><label>Estado<select name="status"><option value="todo" ${note?.status!=='done'?'selected':''}>Por fazer</option><option value="done" ${note?.status==='done'?'selected':''}>Feito</option></select></label><label>Texto<textarea name="body" required minlength="1">${esc(note?.body||'')}</textarea></label><label>Foto (opcional, até 5 MB)<input name="image" type="file" accept="image/*"></label>${note?.image_path?'<p class="muted">Já tem uma foto. Escolher outro ficheiro substitui-a.</p>':''}<p class="muted" data-status role="status"></p><div class="row"><button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn fill">Guardar</button></div></form>`;
dlg.showModal();
const form=dlg.querySelector('form'),status=form.querySelector('[data-status]');
form.querySelector('[data-cancel]').onclick=()=>dlg.close();
form.onsubmit=async e=>{
e.preventDefault();if(busy)return;
const file=form.elements.image.files[0];
if(file&&file.size>5*1024*1024){status.textContent='A foto deve ter menos de 5 MB.';return;}
busy=true;status.textContent='A guardar…';
const controls=[...form.querySelectorAll('button,input,select,textarea')];controls.forEach(n=>n.disabled=true);
try{
const{sb,uid}=session();
const values={title:form.elements.title.value.trim(),place:form.elements.place.value.trim(),note_date:form.elements.note_date.value||null,status:form.elements.status.value,body:form.elements.body.value.trim(),updated_at:new Date().toISOString()};
let image_path=note?.image_path||null;
if(file){
const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
image_path=`${uid}/${crypto.randomUUID()}.${ext}`;
const up=await sb.storage.from('user-notes').upload(image_path,file,{contentType:file.type,upsert:false});
if(up.error)throw up.error;
}
if(note){
const{error}=await sb.from('user_notes').update({...values,image_path}).eq('id',note.id).eq('user_id',uid);
if(error)throw error;
}else{
const{error}=await sb.from('user_notes').insert({user_id:uid,...values,image_path});
if(error)throw error;
}
dlg.close();await load();
}catch(e){status.textContent='Erro: '+e.message;controls.forEach(n=>n.disabled=false);}
finally{busy=false;}
};
}
function show(view,target){
nav.querySelectorAll('button[data-view]').forEach(b=>b.classList.toggle('on',b===target));
const library=document.querySelector('#library'),stats=document.querySelector('#stats');
if(library)library.hidden=view!=='library';
if(stats)stats.hidden=view!=='stats';
section.hidden=view!=='notes';
if(view==='notes')load();
}
section.addEventListener('click',async e=>{
const filterBtn=e.target.closest('#noteFilters button');
if(filterBtn){filter=filterBtn.dataset.filter;section.querySelectorAll('#noteFilters button').forEach(b=>b.classList.toggle('on',b===filterBtn));render();return;}
if(e.target.id==='newNote'){openForm();return;}
const toggle=e.target.closest('[data-toggle]');
if(toggle){try{const{sb,uid}=session();const n=notes.find(x=>String(x.id)===toggle.dataset.toggle);const status=n.status==='done'?'todo':'done';const{error}=await sb.from('user_notes').update({status,updated_at:new Date().toISOString()}).eq('id',n.id).eq('user_id',uid);if(error)throw error;await load();}catch(err){alert('Erro: '+err.message);}return;}
const edit=e.target.closest('[data-edit]');
if(edit){openForm(notes.find(n=>String(n.id)===edit.dataset.edit));return;}
const del=e.target.closest('[data-delete]');
if(del){const n=notes.find(x=>String(x.id)===del.dataset.delete);if(!confirm(`Apagar a nota "${n.title}"?`))return;try{const{sb,uid}=session();if(n.image_path)await sb.storage.from('user-notes').remove([n.image_path]);const{error}=await sb.from('user_notes').delete().eq('id',n.id).eq('user_id',uid);if(error)throw error;await load();}catch(err){alert('Erro: '+err.message);}}
});
nav.addEventListener('click',e=>{
const t=e.target.closest('button[data-view]');if(!t)return;
e.stopPropagation();
show(t.dataset.view,t);
},true);
}
if(typeof document!=='undefined')init();
