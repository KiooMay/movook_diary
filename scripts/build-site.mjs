// Lê media/**/*.md e gera _site/ (index.html + data.json). Sem dependências.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'media';
const OUT = '_site';

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}

// Tolerante a edições manuais: aceita JSON, números/datas soltos e [a, b]
function parseValue(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  try { return JSON.parse(v); } catch {}
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return v.replace(/^["']|["']$/g, '');
}

function section(body, name) {
  const parts = body.split(/^## /m).slice(1);
  const p = parts.find((x) => x.toLowerCase().startsWith(name));
  if (!p) return '';
  return p.slice(p.indexOf('\n') + 1).replace(/<!--[\s\S]*?-->/g, '').trim();
}

const items = [];
for (const file of walk(ROOT)) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) { console.warn('Sem frontmatter:', file); continue; }
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = parseValue(line.slice(i + 1));
  }
  const rating = fm.rating === null || fm.rating === '' ? null : Number(fm.rating);
  items.push({
    id: path.relative(ROOT, file).replace(/\.md$/, '').replace(/\\/g, '/'),
    ...fm,
    rating: Number.isFinite(rating) ? rating : null,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    genres: Array.isArray(fm.genres) ? fm.genres : [],
    creators: Array.isArray(fm.creators) ? fm.creators : [],
    synopsis: section(m[2], 'sinopse'),
    review: section(m[2], 'review'),
  });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync('site-src', OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'data.json'),
  JSON.stringify({ generated: new Date().toISOString(), items }));
console.log(`Site gerado com ${items.length} itens.`);
