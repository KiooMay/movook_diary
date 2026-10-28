// Remove entradas de media/ a partir de uma issue "Remover da biblioteca".
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'media';
const MAX_ITEMS = 30;
const ID_RE = /^(movie|series|anime|book)\/[a-z0-9-]+$/;

function parseForm(body) {
  const out = {};
  for (const part of body.split(/^### /m).slice(1)) {
    const nl = part.indexOf('\n');
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}

function fmField(text, key) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const r = m && m[1].match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!r) return '';
  try { const v = JSON.parse(r[1]); return typeof v === 'string' ? v : ''; }
  catch { return r[1].replace(/^["']|["']$/g, ''); }
}

const index = walk(ROOT).map((file) => {
  const txt = fs.readFileSync(file, 'utf8');
  const id = path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.md$/, '');
  const title = fmField(txt, 'title');
  return { file, id, title, names: [title, fmField(txt, 'original_title'), id.split('/')[1]].map(norm).filter(Boolean) };
});

function main() {
  const f = parseForm(process.env.ISSUE_BODY || '');
  if (!/\[x\]/i.test(f['Confirmação'] || '')) throw new Error('Falta a confirmação');

  const lines = (f['Itens a remover (um por linha)'] || '')
    .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Nenhum item indicado');
  if (lines.length > MAX_ITEMS) throw new Error(`Máximo de ${MAX_ITEMS} itens por issue`);

  const removed = [];
  const out = [];
  for (const line of lines) {
    let matches = [];
    if (ID_RE.test(line)) matches = index.filter((i) => i.id === line);
    if (!matches.length) matches = index.filter((i) => i.names.includes(norm(line)));

    if (matches.length === 1) {
      const [m] = matches;
      fs.rmSync(m.file);
      index.splice(index.indexOf(m), 1);
      removed.push(m.title || m.id);
      out.push(`🗑️ Removido: **${m.title || m.id}** (\`${m.id}\`)`);
    } else if (matches.length > 1) {
      out.push(`⚠️ "${line}" é ambíguo, nada foi apagado. Usa um destes IDs:\n` +
        matches.map((m) => `  - \`${m.id}\``).join('\n'));
    } else {
      out.push(`😕 Não encontrei "${line}".`);
    }
  }

  fs.writeFileSync('/tmp/commit-msg.txt',
    removed.length ? `media: remove ${removed.length > 3 ? `${removed.length} items` : removed.join(', ')}` : 'noop');
  fs.writeFileSync('/tmp/comment.md', out.map((o) => `- ${o}`).join('\n'));
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
