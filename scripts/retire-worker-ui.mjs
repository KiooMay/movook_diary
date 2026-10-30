import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function retireWorkerUI(source){
  function exact(from,to){if(source.split(from).length!==2)throw Error('Legacy worker target missing or ambiguous: '+from.slice(0,80));source=source.replace(from,to);}
  function section(start,end,to){if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Legacy worker section missing or ambiguous');const a=source.indexOf(start),b=source.indexOf(end,a);if(b<a)throw Error('Invalid legacy worker section');source=source.slice(0,a)+to+source.slice(b);}
  exact("const CFG_KEY = 'mobook.cfg';","const CFG_KEY = 'mobook.cfg';\ntry { localStorage.removeItem(CFG_KEY); } catch {}");
  exact("function getCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } }","function getCfg() { return {}; }");
  exact("function apiReady() { const c = getCfg(); return !!(c.url && c.secret); }","function apiReady() { return false; }");
  section('async function api(path, payload) {','\nfunction refreshActions() {',"async function api(path, payload) { throw new Error('Inicia sessão para alterar a tua biblioteca.'); }\n");
  section('function refreshActions() {',"\nconst dlg = $('#formDlg');","function refreshActions() {\n  $('#addBtn').hidden = false;\n  $('#addLink').hidden = true;\n  $('#cfgBtn').hidden = true;\n}\n");
  section('function openCfg() {',"\n$('#modal').addEventListener('click', (e) => {\n  const t = e.target.dataset?.tag;","function openCfg() { document.getElementById('accountBtn')?.click(); }\n");
  exact('id="cfgBtn" title=','id="cfgBtn" hidden title=');
  exact('function openAdd() {',"function openAdd() {\n  if (!window.__movookAccount?.user) {\n    const account = document.getElementById('accountBtn');\n    if (account) account.click(); else toast('A conta está a carregar. Tenta novamente.');\n    return;\n  }");
  exact("if(!item.cover || !item.synopsis) throw new Error('Este título ainda não tem uma ficha completa no catálogo. A pesquisa externa para a biblioteca pessoal ainda não está ligada; nada foi adicionado.');","item.metadata_pending = !(item.cover && item.synopsis);");
  exact(": REPO ? `<a class=\"danger\" href=\"${REPO}/issues/new?template=remove-media.yml&items=${encodeURIComponent(i.id)}\" target=\"_blank\" rel=\"noopener\">🗑 Remover da biblioteca</a>` : ''",": ''");
  return source;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/index.html';const next=retireWorkerUI(fs.readFileSync(path,'utf8'));for(const m of next.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);fs.writeFileSync(path,next);}
