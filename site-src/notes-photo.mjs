function init(){
 const requests=new WeakMap();let sequence=0,viewerOwner='',returnFocus=null;
 const viewer=document.createElement('dialog');viewer.id='notesPhotoViewer';viewer.setAttribute('aria-label','Fotografia ampliada');viewer.style.cssText='width:96vw;max-width:1200px;max-height:94vh;padding:1rem';
 const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Fechar fotografia';
 const large=document.createElement('img');large.alt='Fotografia da nota';large.style.cssText='display:block;width:100%;height:auto;max-height:80vh;object-fit:contain;margin-top:.7rem';
 const error=document.createElement('p');error.hidden=true;error.textContent='Não foi possível carregar a fotografia.';large.onerror=()=>{error.hidden=false;};viewer.append(close,large,error);document.body.append(viewer);
 close.onclick=()=>viewer.close();viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});viewer.addEventListener('close',()=>{large.removeAttribute('src');error.hidden=true;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;viewerOwner='';});
 const uid=()=>window.__movookAccount?.user?.id||'';
 async function attach(card,id,ticket){
  const name=card.querySelector('.note-title')?.textContent||'';
  const dialog=[...document.querySelectorAll('dialog[open]')].find(d=>d!==viewer&&d.querySelector('.note-text')&&d.querySelector('h2')?.textContent===name);
  if(!dialog||ticket!==sequence)return;
  const owner=uid(),client=window.__movookClient;if(!owner||!client)return;
  const token=Symbol();requests.set(dialog,token);
  const current=()=>uid()===owner&&dialog.open&&requests.get(dialog)===token&&ticket===sequence;
  dialog.addEventListener('close',()=>{if(requests.get(dialog)===token)requests.delete(dialog);if(viewer.open)viewer.close();},{once:true});
  let preview;
  try{
   const row=await client.from('user_notes').select('image_path').eq('id',id).eq('user_id',owner).maybeSingle();
   if(!current())return;if(row.error)throw row.error;if(!row.data?.image_path)return;
   preview=document.createElement('button');preview.type='button';preview.setAttribute('aria-label','Ampliar fotografia de '+name);preview.style.cssText='display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in';
   const image=document.createElement('img');image.alt='Fotografia de '+name;image.style.cssText='display:block;width:100%;height:auto;max-height:320px;object-fit:contain;border-radius:10px';
   const caption=document.createElement('span');caption.className='muted';caption.textContent='Clica na fotografia para ampliar';preview.append(image,caption);dialog.querySelector('h2').after(preview);
   const signed=await client.storage.from('user-notes').createSignedUrl(row.data.image_path,3600);
   if(!current()){preview.remove();return;}if(signed.error||!signed.data?.signedUrl)throw signed.error||Error('Sem acesso à fotografia.');
   const url=signed.data.signedUrl;if(new URL(url).protocol!=='https:')throw Error('Endereço de imagem inválido.');image.src=url;
   image.onerror=()=>{if(!current())return;preview.disabled=true;caption.textContent='Não foi possível carregar a fotografia.';};
   preview.onclick=()=>{if(!current())return;viewerOwner=owner;returnFocus=preview;error.hidden=true;large.alt='Fotografia ampliada de '+name;large.src=url;if(!viewer.open)viewer.showModal();};
  }catch(e){if(current()){preview?.remove();const message=document.createElement('p');message.className='muted';message.textContent='Não foi possível carregar a fotografia da nota.';dialog.querySelector('h2').after(message);}}
 }
 function decorate(){for(const cover of document.querySelectorAll('#notes .note-card .note-cover')){if(!cover.querySelector('img')||cover.dataset.photoOpener)continue;cover.dataset.photoOpener='true';cover.tabIndex=0;cover.setAttribute('role','button');cover.setAttribute('aria-haspopup','dialog');cover.setAttribute('aria-label','Abrir nota: '+(cover.closest('.note-card').querySelector('.note-title')?.textContent||''));cover.style.cursor='pointer';}}
 document.addEventListener('click',e=>{
  const cover=e.target.closest?.('#notes .note-card .note-cover');
  if(cover&&cover.querySelector('img')){e.preventDefault();e.stopPropagation();cover.closest('.note-card').querySelector('.note-title')?.click();return;}
  const opener=e.target.closest?.('#notes .note-card [data-open]');if(!opener)return;
  const card=opener.closest('.note-card'),id=opener.dataset.open,ticket=++sequence;queueMicrotask(()=>attach(card,id,ticket));
 },true);
 document.addEventListener('keydown',e=>{const cover=e.target.closest?.('#notes .note-cover[data-photo-opener]');if(cover&&(e.key==='Enter'||e.key===' ')){e.preventDefault();cover.click();}});
 new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});decorate();
 window.addEventListener('movook:account',()=>{if(viewer.open&&uid()!==viewerOwner)viewer.close();});
}
if(typeof document!=='undefined')init();
