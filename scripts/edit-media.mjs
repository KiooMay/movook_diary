// Atualiza estado, nota, data, tags e review de uma entrada em media/.
import fs from 'node:fs';
import path from 'node:path';

const STATUS = { 'Quero ver/ler': 'planned', 'A ver/ler': 'in-progress', 'Concluído': 'done', 'Abandonado': 'dropped' };
const ID_RE = /^(movie|series|anime|book)\/[a-z0-9-]+$/;

function parseForm(body) {
  const out = {};
  for (const part of body.split(/^### /m).slice(1)) {
    const nl = part.indexOf('\n');
    let val = part.slice(nl + 1).trim();
    if (val === '_No response_') val = '';
    out[part.slice(0, nl).trim()] = val;
  }
  return out;
}

function setKey(lines, key, value) {
  const i = lines.findIndex((l) => l.startsWith(key + ':'));
  const line = `${key}: ${value}`;
  if (i >= 0) lines[i] = line; else lines.push(line);
}

function replaceSection(body, name, text) {
  const content = text.trim() || '<!-- Escreve aqui a tua review -->';
  const lines = body.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^## ${name}\\b`, 'i').test(l));
  if (start === -1) return body.replace(/\s*$/, '') + `\n\n## ${name}\n\n${content}\n`;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  return [...lines.slice(0, start + 1), '', content, '', ...lines.slice(end)]
    .join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
}

function main() {
  const f = parseForm(process.env.ISSUE_BODY || '');
  const id = f['ID'];
  if (!ID_RE.test(id || '')) throw new Error('ID inválido');
  const file = path.join('media', `${id}.md`);
  if (!fs.existsSync(file)) throw new Error(`Não existe: ${id}`);

  const status = STATUS[f['Estado']];
  if (!status) throw new Error('Estado inválido');

  let rating = null;
  if (f['Nota']) {
    rating = parseFloat(f['Nota'].replace(',', '.'));
    if (!(rating >= 0 && rating <= 10)) throw new Error('Nota inválida');
  }
  let date = f['Data de conclusão'] || null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data inválida');
  const tags = (f['Tags'] || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20);
  const review = (f['Review'] || '').replace(/\r\n/g, '\n').replace(/^(\s*)\\###/gm, '$1###');

  const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('Ficheiro sem frontmatter');
  const fm = m[1].split('\n');

  // Marcado como concluído sem data (e sem data anterior): usa hoje
  const prev = (fm.find((l) => l.startsWith('date_finished:')) || '').slice(14).trim();
  if (!date && status === 'done' && (!prev || prev === 'null')) date = new Date().toISOString().slice(0, 10);

  setKey(fm, 'status', status);
  setKey(fm, 'rating', rating === null ? 'null' : String(rating));
  setKey(fm, 'date_finished', date || 'null');
  setKey(fm, 'tags', JSON.stringify(tags));

  fs.writeFileSync(file, `---\n${fm.join('\n')}\n---\n${replaceSection(m[2], 'Review', review)}`);

  let title = id;
  try { title = JSON.parse((fm.find((l) => l.startsWith('title:')) || '').slice(6)) || id; } catch {}
  fs.writeFileSync('/tmp/commit-msg.txt', `media: edit ${title}`);
  fs.writeFileSync('/tmp/comment.md', `✏️ Atualizado: **${title}** (\`${id}\`)`);
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
