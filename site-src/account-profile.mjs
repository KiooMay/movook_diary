export function validateDisplayName(value){
  if(typeof value!=='string')throw Error('Indica um nome válido.');
  const name=value.normalize('NFC').trim().replace(/\s+/gu,' ');
  if(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name))throw Error('O nome contém caracteres de controlo não permitidos.');
  if([...name].length<2||[...name].length>40)throw Error('O nome deve ter entre 2 e 40 caracteres.');
  return name;
}
export function accountLabel(user){if(!user)return 'Conta';try{return validateDisplayName(user.user_metadata?.display_name);}catch{return 'Conta';}}
export async function saveDisplayName(client,expectedId,value,currentId=()=>expectedId){
  const name=validateDisplayName(value);
  const auth=await client.auth.getUser();
  if(auth.error)throw auth.error;
  if(auth.data?.user?.id!==expectedId||currentId()!==expectedId)throw Error('A conta mudou. Volta a abrir Conta.');
  const result=await client.auth.updateUser({data:{display_name:name}});
  if(result.error)throw result.error;
  if(result.data?.user?.id!==expectedId||currentId()!==expectedId)throw Error('A conta mudou durante a gravação. Volta a abrir Conta.');
  return result.data.user;
}
function init(){
  let saving=false,queued=false;
  window.__movookProfile={label:accountLabel};
  function update(){
    const user=window.__movookAccount?.user,button=document.getElementById('accountBtn');
    if(button){const label=accountLabel(user);if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-label',user?'Abrir conta: '+label:'Abrir conta');}
    const dialog=document.getElementById('accountDlg');if(!dialog)return;
    if(!dialog.dataset.profileGuard){dialog.dataset.profileGuard='';dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});}
    const existing=dialog.querySelector('[data-profile-form]');
    if(existing&&existing.dataset.userId!==user?.id)existing.remove();
    if(!user||!dialog.querySelector('#signOut')||dialog.querySelector('[data-profile-form]'))return;
    const pane=dialog.querySelector('.m');if(!pane||pane.tagName==='FORM')return;
    const form=document.createElement('form');form.className='form';form.dataset.profileForm='';form.dataset.userId=user.id;
    form.innerHTML='<label>Nome de apresentação<input name="display_name" type="text" autocomplete="nickname" required maxlength="80" placeholder="Como queres aparecer na tua conta?"></label><p class="muted">Entre 2 e 40 caracteres. Não altera o email, a password ou a biblioteca. O nome não precisa de ser único.</p><div class="row"><button type="submit" class="btn fill">Guardar nome</button></div><p class="muted" data-profile-status role="status" aria-live="polite"></p>';
    const input=form.querySelector('input'),status=form.querySelector('[data-profile-status]');
    try{input.value=validateDisplayName(user.user_metadata?.display_name);}catch{input.value='';}
    const actions=pane.querySelector(':scope > .row');if(actions)actions.before(form);else pane.append(form);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(saving)return;const expected=form.dataset.userId,client=window.__movookClient;
      if(!client||window.__movookAccount?.user?.id!==expected){status.textContent='Inicia sessão novamente antes de guardar.';return;}
      try{validateDisplayName(input.value);}catch(err){status.textContent=err.message;return;}
      saving=true;status.textContent='A guardar o nome…';
      const controls=[...dialog.querySelectorAll('button,input,select,textarea')].map(node=>[node,node.disabled]);controls.forEach(([node])=>node.disabled=true);
      try{
        const next=await saveDisplayName(client,expected,input.value,()=>window.__movookAccount?.user?.id);
        window.__movookAccount.user=next;input.value=accountLabel(next);update();status.textContent='Nome guardado na tua conta.';
        window.dispatchEvent(new Event('movook:profile'));
      }catch(err){status.textContent='Não foi possível guardar: '+err.message;}
      finally{saving=false;controls.forEach(([node,disabled])=>node.disabled=disabled);}
    });
  }
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;update();});}
  const observer=new MutationObserver(records=>{if(records.some(r=>(r.target instanceof Element&&r.target.closest('#accountDlg'))||[...r.addedNodes].some(n=>n instanceof Element&&n.id==='accountDlg')))schedule();});
  observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('movook:account',schedule);window.addEventListener('movook:profile',schedule);update();
}
if(typeof document!=='undefined')init();
