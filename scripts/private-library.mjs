import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const accountLoad=`let libraryOwner = null;
let librarySnapshot = null;
async function load(first) {
  const acct = window.__movookAccount;
  const owner = acct?.user?.id || null;
  const ownerChanged = owner !== libraryOwner;
  const previousY = window.scrollY;
  const previousX = window.scrollX;
  if (ownerChanged) {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('#modal').innerHTML = ''; $('#formDlg').innerHTML = '';
    libraryOwner = owner;
  }
  const nextItems = owner ? (acct.items || []) : [];
  const snapshot = JSON.stringify(nextItems);
  if (!first && !ownerChanged && snapshot === librarySnapshot) return;
  items = nextItems;
  librarySnapshot = snapshot;
  if (first || ownerChanged) {
    Object.assign(state, { type: 'all', q: '', status: '', genre: '', tag: '', sort: 'added' });
    $('#q').value = '';
  }
  setupControls();
  for (const key of ['status', 'genre', 'tag', 'sort']) {
    const control = $('#' + key);
    if (![...control.options].some(option => option.value === state[key])) state[key] = key === 'sort' ? 'added' : '';
    control.value = state[key];
  }
  $('#q').value = state.q;
  $('#types').hidden = !owner;
  $('.controls').hidden = !owner;
  if (first) bind();
  renderGrid();
  $('#empty').textContent = owner ? (items.length ? 'Nada encontrado.' : 'A tua biblioteca está vazia. Adiciona ou importa itens.') : 'Inicia sessão ou cria uma conta para veres a tua biblioteca.';
  if (owner) { renderStats(); loadInsights(); }
  else { insights = null; $('#insights').innerHTML = ''; $('#statsBody').innerHTML = ''; if (!first) document.querySelector('nav button[data-view="library"]')?.click(); }
  window.dispatchEvent(new Event('movook:library'));
  if (!first && !ownerChanged) {
    window.scrollTo({left:previousX,top:previousY,behavior:'instant'});
    const restoreOwner = owner;
    const cancelRestore = () => { cancelled = true; };
    let cancelled = false;
    const events = ['wheel','touchstart','pointerdown','keydown'];
    events.forEach(event => window.addEventListener(event,cancelRestore,{capture:true,passive:true}));
    requestAnimationFrame(() => {
      events.forEach(event => window.removeEventListener(event,cancelRestore,true));
      if (!cancelled && libraryOwner === restoreOwner) window.scrollTo({left:previousX,top:previousY,behavior:'instant'});
    });
  }
}
`;
const personalLoad=`let personalLoadVersion = 0;
  async function loadPersonal() {
    const request = ++personalLoadVersion;
    const ownerId = user?.id;
    if (!ownerId) return;
    const rows = [];
    for (let page = 0; ; page += 1000) {
      const { data, error } = await sb.from('user_media').select('id,data').eq('user_id', ownerId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page, page + 999);
      if (user?.id !== ownerId || request !== personalLoadVersion) return;
      if (error) { toast('Erro ao carregar a biblioteca: ' + error.message); throw error; }
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    if (user?.id !== ownerId || request !== personalLoadVersion) return;
    window.__movookAccount.items = rows.map(r => ({ ...(r.data || {}), id: String(r.id), creators: Array.isArray(r.data?.creators) ? r.data.creators : [], genres: Array.isArray(r.data?.genres) ? r.data.genres : [], tags: Array.isArray(r.data?.tags) ? r.data.tags : [] }));
    window.__movook?.reload?.();
  }
`;
export function privateLibrary(source){
  function section(start,end,to){if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Private library target missing or ambiguous');const a=source.indexOf(start),b=source.indexOf(end,a);if(b<a)throw Error('Invalid private library section');source=source.slice(0,a)+to+source.slice(b);}
  section('async function load(first) {',"\n$('#refreshBtn').addEventListener('click',",accountLoad);
  section('async function loadPersonal() {','\n  let catalogPromise;',personalLoad);
  const marker="const el = $('#insights');";if(source.split(marker).length!==2)throw Error('Insights privacy target missing or ambiguous');source=source.replace(marker,marker+"\n  if (!window.__movookAccount?.user) { el.innerHTML = ''; return; }");
  const authTarget="window.__movookAccount.items = []; window.__movookAccount.user = u; window.dispatchEvent(new Event('movook:account'));";
  if(source.split(authTarget).length!==2)throw Error('Session identity target missing or ambiguous');
  source=source.replace(authTarget,"const movookIdentityChanged = (window.__movookAccount.user?.id || null) !== (u?.id || null); window.__movookAccount.user = u; if (movookIdentityChanged) { window.__movookAccount.items = []; window.dispatchEvent(new Event('movook:account')); }");
  return source;
}
export function preserveMetadataDialog(source){
  const target="window.addEventListener('movook:account',()=>{if(!busy&&dlg.open)dlg.close();});";
  if(source.split(target).length!==2)throw Error('Metadata account listener missing or ambiguous');
  return source.replace(target,"window.addEventListener('movook:account',()=>{if(dlg.open&&(window.__movookAccount?.user?.id||'')!==owner)dlg.close();});");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path='_site/index.html';
  const next=privateLibrary(fs.readFileSync(path,'utf8'));
  for(const m of next.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);
  const metadataPath='_site/media-metadata.mjs';
  const metadata=preserveMetadataDialog(fs.readFileSync(metadataPath,'utf8'));
  const {spawnSync}=await import('node:child_process');
  const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:metadata,encoding:'utf8'});
  if(check.status!==0)throw Error(check.stderr||'Invalid metadata module');
  fs.writeFileSync(path,next);
  fs.writeFileSync(metadataPath,metadata);
}
