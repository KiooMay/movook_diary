import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const accountLoad=`let libraryOwner = null;
async function load(first) {
  const acct = window.__movookAccount;
  const owner = acct?.user?.id || null;
  if (owner !== libraryOwner) {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('#modal').innerHTML = ''; $('#formDlg').innerHTML = '';
    libraryOwner = owner;
  }
  items = owner ? (acct.items || []) : [];
  Object.assign(state, { type: 'all', q: '', status: '', genre: '', tag: '', sort: 'added' });
  $('#q').value = '';
  setupControls();
  $('#types').hidden = !owner;
  $('.controls').hidden = !owner;
  if (first) bind();
  renderGrid();
  $('#empty').textContent = owner ? (items.length ? 'Nada encontrado.' : 'A tua biblioteca está vazia. Adiciona ou importa itens.') : 'Inicia sessão ou cria uma conta para veres a tua biblioteca.';
  if (owner) { renderStats(); loadInsights(); }
  else { insights = null; $('#insights').innerHTML = ''; $('#statsBody').innerHTML = ''; if (!first) document.querySelector('nav button[data-view="library"]')?.click(); }
  window.dispatchEvent(new Event('movook:library'));
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
  return source;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/index.html';const next=privateLibrary(fs.readFileSync(path,'utf8'));for(const m of next.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);fs.writeFileSync(path,next);}
