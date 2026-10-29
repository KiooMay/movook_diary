// Utilitários partilhados. Fornecedor de AI GRATUITO e intermutável.
// Por defeito: Cloudflare Workers AI (camada gratuita, sem cartão).
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = 'media';

// ---------- ficheiros .md ----------
export function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}

function parseValue(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  try { return JSON.parse(v); } catch {}
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return v.replace(/^["']|["']$/g, '');
}

export function readEntry(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const lines = m[1].split('\n');
  const fm = {};
  for (const l of lines) {
    const i = l.indexOf(':');
    if (i > 0) fm[l.slice(0, i).trim()] = parseValue(l.slice(i + 1));
  }
  return { file, id: path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.md$/, ''), fm, lines, body: m[2] };
}

export function setKey(lines, key, value) {
  const i = lines.findIndex((l) => l.startsWith(key + ':'));
  const line = `${key}: ${value}`;
  if (i >= 0) lines[i] = line; else lines.push(line);
}

export const writeEntry = (e) => fs.writeFileSync(e.file, `---\n${e.lines.join('\n')}\n---\n${e.body}`);

export function section(body, name) {
  const p = body.split(/^## /m).slice(1).find((x) => x.toLowerCase().startsWith(name));
  return p ? p.slice(p.indexOf('\n') + 1).replace(/<!--[\s\S]*?-->/g, '').trim() : '';
}

export function replaceSection(body, name, text) {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^## ${name}\\b`, 'i').test(l));
  if (start === -1) return body.replace(/\s*$/, '') + `\n\n## ${name}\n\n${text}\n`;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  return [...lines.slice(0, start + 1), '', text, '', ...lines.slice(end)]
    .join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
}

// Dados externos nunca devem conseguir fechar a tag <data>
export const asData = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

// ---------- deteção simples de idioma (gratuita, sem AI) ----------
const PT = new Set('o a os as de do da dos das em no na nos nas um uma uns umas que e é para por com não se ao aos à às mais como mas foi são seu sua seus suas ele ela eles elas também já pelo pela entre sobre quando onde até depois só muito ser tem têm está estão há'.split(' '));
const EN = new Set('the of and to in is are was were that with for as on by from his her their they he she it its this who which when after has have had be been not but an at or into while'.split(' '));
export function detectLang(text) {
  const words = String(text).toLowerCase().match(/[a-zà-ú]+/g) || [];
  if (words.length < 6) return 'unknown';
  let pt = 0, en = 0;
  for (const w of words) { if (PT.has(w)) pt++; if (EN.has(w)) en++; }
  if (en > pt * 1.5) return 'en';
  return pt >= en ? 'pt' : 'unknown';
}

// Géneros do AniList (conjunto fixo): tradução direta, sem AI
export const ANILIST_GENRES = {
  'Action': 'Ação', 'Adventure': 'Aventura', 'Comedy': 'Comédia', 'Drama': 'Drama', 'Ecchi': 'Ecchi',
  'Fantasy': 'Fantasia', 'Horror': 'Terror', 'Mahou Shoujo': 'Mahou Shoujo', 'Mecha': 'Mecha',
  'Music': 'Música', 'Mystery': 'Mistério', 'Psychological': 'Psicológico', 'Romance': 'Romance',
  'Sci-Fi': 'Ficção científica', 'Slice of Life': 'Quotidiano', 'Sports': 'Desporto',
  'Supernatural': 'Sobrenatural', 'Thriller': 'Suspense',
};

// ---------- cliente de AI ----------
export class QuotaError extends Error {}
export class AuthError extends Error {}

export function aiConfig() {
  const e = process.env, t = (k) => (e[k] || '').trim();
  if (t('AI_BASE_URL') && t('AI_API_KEY')) {
    return { url: t('AI_BASE_URL').replace(/\/+$/, '') + '/chat/completions', key: t('AI_API_KEY'), model: t('AI_MODEL') || null };
  }
  if (t('CLOUDFLARE_ACCOUNT_ID') && t('CLOUDFLARE_API_TOKEN')) {
    return {
      url: `https://api.cloudflare.com/client/v4/accounts/${t('CLOUDFLARE_ACCOUNT_ID')}/ai/v1/chat/completions`,
      key: t('CLOUDFLARE_API_TOKEN'),
      model: t('AI_MODEL') || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    };
  }
  return null;
}

export function extractJson(content) {
  if (content && typeof content === 'object') return content;
  const s = String(content ?? '').replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Resposta sem JSON');
  return JSON.parse(s.slice(a, b + 1));
}

export async function callLLM({ system, user, maxTokens = 1200 }) {
  const cfg = aiConfig();
  if (!cfg) throw new Error('AI não configurada');
  if (!cfg.model) throw new Error('Falta AI_MODEL');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model, max_tokens: maxTokens, temperature: 0.2,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const t = (await res.text()).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new AuthError(`HTTP ${res.status}: ${t}`);
    if (res.status === 429 || /neurons|daily|quota|rate.?limit|allocation/i.test(t)) throw new QuotaError(`HTTP ${res.status}: ${t}`);
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  const j = await res.json();
  return extractJson(j.choices?.[0]?.message?.content ?? j.result?.response);
}
