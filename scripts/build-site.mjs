import fs from 'node:fs';
import path from 'node:path';
const OUT = '_site';
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}
function parseValue(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  try { return JSON.parse(v); } catch {}
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1,-1).split(',').map(s => s.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
  return v.replace(/^["']|["']$/g,'');
}
function section(body, name) {
  const p = body.split(/^## /m).slice(1).find(x => x.toLowerCase().startsWith(name));
  return p ? p.slice(p.indexOf('\n')+1).replace(/<!--[\s\S]*?-->/g,'').trim() : '';
}
const items = [];
for (const file of walk('media')) {
  const m = fs.readFileSync(file,'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) continue;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0,i).trim()] = parseValue(line.slice(i+1));
  }
  const rating = fm.rating == null || fm.rating === '' ? null : Number(fm.rating);
  items.push({id:path.relative('media',file).replace(/\.md$/,'').replace(/\\/g,'/'),...fm,
    rating:Number.isFinite(rating)?rating:null,
    tags:Array.isArray(fm.tags)?fm.tags:[],genres:Array.isArray(fm.genres)?fm.genres:[],creators:Array.isArray(fm.creators)?fm.creators:[],
    synopsis:section(m[2],'sinopse'),review:section(m[2],'review')});
}
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync('site-src',OUT,{recursive:true});
fs.mkdirSync(path.join(OUT,'covers'),{recursive:true});
const queue = items.filter(i => /^https?:\/\//i.test(i.cover||''));
const EXT = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
async function coverWorker() {
  while(queue.length) {
    const it = queue.shift();
    try {
      const res = await fetch(it.cover,{signal:AbortSignal.timeout(15000)});
      const type = (res.headers.get('content-type')||'').split(';')[0];
      if (!res.ok || !EXT[type]) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 3*1024*1024) throw new Error('imagem demasiado grande');
      const name = `covers/${it.id.replace(/\//g,'-')}.${EXT[type]}`;
      fs.writeFileSync(path.join(OUT,name),buf); it.cover = name;
    } catch(e) { console.warn('Capa mantida remota:',it.id,e.message); }
  }
}
await Promise.all(Array.from({length:5},coverWorker));
let html = fs.readFileSync(path.join(OUT,'index.html'),'utf8');
function patch(from,to) {
  if (!html.includes(from)) throw new Error('HTML incompatível com correção: '+from.slice(0,90));
  html = html.replace(from,to);
}
patch('function load(first) {','async function load(first) {');
patch("$('#refreshBtn').addEventListener('click', () => load(false).then(() => toast('Atualizado.')));", "$('#refreshBtn').addEventListener('click', async () => { try { if (window.__movookAccount?.user) await window.__movookAccount.refresh(); await load(false); toast('Atualizado.'); } catch(err) { toast('Erro: '+err.message); } });");
patch('user: null, items: [], addPersonal, updatePersonal, removePersonal','user: null, items: [], refresh: loadPersonal, addPersonal, updatePersonal, removePersonal');
patch('items = acct.items || [];','items = acct.items || []; window.dispatchEvent(new Event(\'movook:library\'));');
patch('items = d.items;','if (window.__movookAccount?.user) return load(false); items = d.items; window.dispatchEvent(new Event(\'movook:library\'));');
patch("const store = (k, v) => localStorage.setItem(k, JSON.stringify(v));", "const scopedKey = k => k + ':' + (window.__movookAccount?.user?.id || 'guest');\n  const store = (k,v) => { localStorage.setItem(scopedKey(k),JSON.stringify(v)); window.dispatchEvent(new Event('movook:local')); }; ");
patch('JSON.parse(localStorage.getItem(k)) ?? d', 'readArray(localStorage.getItem(k + \':\' + (window.__movookAccount?.user?.id || \'guest\')), d)');
patch('let favs = new Set(load(FAV_KEY, []));', "function readArray(raw,d=[]) { try { let v=JSON.parse(raw); if(typeof v==='string') v=JSON.parse(v); return Array.isArray(v)?v:d; } catch {return d;} }\n  let favs = new Set(load(FAV_KEY, []));");
patch("return fetch('data.json', { cache: 'no-cache' }).then((r) => r.json()).then((d) => { shelfItems = d.items || []; });", "shelfItems = window.__movookAccount?.user ? window.__movookAccount.items || [] : items; return Promise.resolve();");
patch('const favItems = shelfItems.filter((i) => favs.has(i.id));', "shelfItems = window.__movookAccount?.user ? window.__movookAccount.items || [] : items;\n    const favItems = shelfItems.filter((i) => favs.has(String(i.id)));");
patch('loadShelfData().then(() => { renderShelves(); });', "function refreshShelfState() { favs = new Set(load(FAV_KEY,[]).map(String)); shelves = load(SHELF_KEY,[]); loadShelfData(); renderShelves(); document.querySelectorAll('#grid .favstar').forEach(n=>n.remove()); decorate(); }\n  window.addEventListener('movook:library',refreshShelfState); window.addEventListener('movook:remote',refreshShelfState); window.addEventListener('movook:account',refreshShelfState);\n  renderShelves(); loadShelfData().then(() => { renderShelves(); });");
patch("const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };", "const accountKey = k => k + ':' + (user?.id || 'guest');\n  const load = k => { try { let v=JSON.parse(localStorage.getItem(accountKey(k))); if(typeof v==='string') v=JSON.parse(v); return Array.isArray(v)?v:[]; } catch {return [];} };");
patch('const store = (k, v) => localStorage.setItem(k, JSON.stringify(v));', 'const store = (k,v) => localStorage.setItem(accountKey(k),JSON.stringify(v));');
patch('store(FAV_KEY, JSON.stringify(merged));','store(FAV_KEY, merged);');
patch('store(SHELF_KEY, JSON.stringify(merged));','store(SHELF_KEY, merged);');
patch('window.__movookAccount.user = u;', "window.__movookAccount.items = []; window.__movookAccount.user = u; window.dispatchEvent(new Event('movook:account'));");
patch('await syncShelves();','await syncShelves(); window.dispatchEvent(new Event(\'movook:remote\'));');
const start = html.indexOf('  const origSet = localStorage.setItem.bind(localStorage);');
const end = html.indexOf('\n  (async () => {', start);
if(start<0||end<0) throw new Error('Bloco de sincronização não encontrado');
html = html.slice(0,start) + "  window.addEventListener('movook:local', () => { if (!user) return; pending.fav = pending.shelf = true; if (!syncing) syncAll(); });\n" + html.slice(end);
patch("if (error) { console.warn('personal library error', error); return; }", "if (error) { toast('Erro ao carregar a biblioteca: '+error.message); throw error; }");
patch("window.__movookAccount.items = (data || []).map((r) => ({ ...(r.data || {}), id: String(r.id) }));", `const ownerId = user.id;
    const catalog = await getCatalog();
    const recovered = [];
    for (const r of data || []) {
      const original = r.data || {};
      const enriched = enrichFromCatalog(original,catalog);
      if (JSON.stringify(original) !== JSON.stringify(enriched)) {
        const result = await sb.from('user_media').update({data:enriched}).eq('id',r.id).eq('user_id',ownerId);
        if(result.error) toast('Metadados apresentados, mas não guardados: '+result.error.message);
      }
      recovered.push({...enriched,id:String(r.id)});
    }
    if(user?.id !== ownerId) return;
    window.__movookAccount.items = recovered;`);
patch('async function addPersonal(item) {', `let catalogPromise;
  function getCatalog() {
    if(!catalogPromise) catalogPromise = fetch('data.json',{cache:'no-cache'}).then(r=>{if(!r.ok) throw new Error('Não foi possível consultar o catálogo'); return r.json();}).then(d=>d.items||[]).catch(e=>{catalogPromise=null; throw e;});
    return catalogPromise;
  }
  const normalized = s => String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function enrichFromCatalog(item,catalog) {
    const parts = String(item.title||'').split('|').map(s=>s.trim());
    const title = parts[0];
    const year = item.year || parts.find(s=>/^\\d{4}$/.test(s));
    const candidates = catalog.filter(c=>c.type===item.type && (!year || String(c.year)===String(year)) && [c.title,c.original_title].some(t=>normalized(t)===normalized(title)));
    if(candidates.length !== 1) return item;
    const c = candidates[0], result = {...item};
    for(const k of ['original_title','year','creators','genres','synopsis','cover','source','source_id','source_url','length']) {
      const v = result[k];
      if(v==null || v==='' || (typeof v==='object' && Object.keys(v).length===0)) {
        if(c[k]!=null) result[k]=c[k];
      }
    }
    return result;
  }
  async function addPersonal(item) {
    if(!user) throw new Error('Inicia sessão primeiro.');
    item = enrichFromCatalog(item,await getCatalog());
    if(!item.cover || !item.synopsis) throw new Error('Este título ainda não tem uma ficha completa no catálogo. A pesquisa externa para a biblioteca pessoal ainda não está ligada; nada foi adicionado.');`);
fs.writeFileSync(path.join(OUT,'index.html'),html);
const build = new Date().toISOString().replace(/\D/g,'').slice(0,14);
const swPath = path.join(OUT,'sw.js');
if(fs.existsSync(swPath)) fs.writeFileSync(swPath,fs.readFileSync(swPath,'utf8').replaceAll('__BUILD__',build));
fs.writeFileSync(path.join(OUT,'data.json'),JSON.stringify({generated:new Date().toISOString(),items}));
if(fs.existsSync('data/insights.json')) fs.copyFileSync('data/insights.json',path.join(OUT,'insights.json'));
console.log(`Site gerado com ${items.length} itens; correções da biblioteca pessoal aplicadas.`);
