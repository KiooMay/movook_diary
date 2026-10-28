// Lê o corpo da issue, procura metadados e cria media/<tipo>/<slug>.md
// Sem dependências: usa o fetch nativo do Node 20.
import fs from 'node:fs';
import path from 'node:path';

const TMDB_KEY = process.env.TMDB_API_KEY;

const TYPES = { 'Filme': 'movie', 'Série': 'series', 'Anime': 'anime', 'Livro': 'book' };
const STATUS = {
  'Quero ver/ler': 'planned',
  'A ver/ler': 'in-progress',
  'Concluído': 'done',
  'Abandonado': 'dropped',
};

// ---------- helpers ----------
function parseForm(body) {
  const out = {};
  for (const part of body.split(/^### /m).slice(1)) {
    const nl = part.indexOf('\n');
    const key = part.slice(0, nl).trim();
    let val = part.slice(nl + 1).trim();
    if (val === '_No response_') val = '';
    out[key] = val;
  }
  return out;
}

async function getJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).hostname}`);
  return res.json();
}

function slugify(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const q = (v) => JSON.stringify(v ?? null); // JSON é YAML válido

// ---------- fornecedores ----------
async function tmdb(kind, query, year, id) {
  if (!TMDB_KEY) throw new Error('Falta o secret TMDB_API_KEY');
  const get = (p, params = {}) => {
    const u = new URL('https://api.themoviedb.org/3' + p);
    u.searchParams.set('api_key', TMDB_KEY);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    return getJson(u);
  };
  let others = [];
  if (!id) {
    const yearKey = kind === 'movie' ? 'year' : 'first_air_date_year';
    const r = await get(`/search/${kind}`, { query, language: 'pt-PT', [yearKey]: year });
    if (!r.results.length) return null;
    id = r.results[0].id;
    others = r.results.slice(1, 4).map((x) =>
      `${x.title || x.name} (${(x.release_date || x.first_air_date || '').slice(0, 4) || '?'}) — \`tmdb:${x.id}\``);
  }
  const d = await get(`/${kind}/${id}`, { language: 'pt-PT', append_to_response: 'credits' });
  if (!d.overview) d.overview = (await get(`/${kind}/${id}`, { language: 'en-US' })).overview;
  const creators = kind === 'movie'
    ? d.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name)
    : (d.created_by || []).map((c) => c.name);
  return {
    best: {
      title: d.title || d.name,
      original_title: d.original_title || d.original_name,
      year: parseInt((d.release_date || d.first_air_date || '').slice(0, 4)) || null,
      creators,
      genres: d.genres.map((g) => g.name),
      cover: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      synopsis: d.overview,
      length: kind === 'movie'
        ? { runtime_min: d.runtime }
        : { seasons: d.number_of_seasons, episodes: d.number_of_episodes },
      source: 'tmdb',
      source_id: String(d.id),
      source_url: `https://www.themoviedb.org/${kind === 'movie' ? 'movie' : 'tv'}/${d.id}`,
    },
    others,
  };
}

async function anilist(query, year, id) {
  const fields = `id title { romaji english native } startDate { year } description(asHtml: false)
    genres coverImage { large } episodes format siteUrl studios(isMain: true) { nodes { name } }`;
  const run = (gql, variables) => getJson('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  });
  let m, others = [];
  if (id) {
    m = (await run(`query($id:Int){Media(id:$id,type:ANIME){${fields}}}`, { id: Number(id) })).data.Media;
  } else {
    const r = await run(
      `query($s:String){Page(perPage:5){media(search:$s,type:ANIME,sort:SEARCH_MATCH){${fields}}}}`,
      { s: query });
    let list = r.data.Page.media;
    if (year) list = [...list.filter((x) => x.startDate.year === year), ...list.filter((x) => x.startDate.year !== year)];
    if (!list.length) return null;
    m = list[0];
    others = list.slice(1, 4).map((x) =>
      `${x.title.english || x.title.romaji} (${x.startDate.year || '?'}) — \`anilist:${x.id}\``);
  }
  return {
    best: {
      title: m.title.english || m.title.romaji,
      original_title: m.title.native || m.title.romaji,
      year: m.startDate.year,
      creators: m.studios.nodes.map((s) => s.name),
      genres: m.genres,
      cover: m.coverImage.large,
      synopsis: (m.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim(),
      length: { episodes: m.episodes, format: m.format },
      source: 'anilist',
      source_id: String(m.id),
      source_url: m.siteUrl,
    },
    others,
  };
}

async function openlibrary(query, year, id) {
  let workKey, doc, others = [];
  if (id) {
    workKey = `/works/${id}`;
  } else {
    const u = new URL('https://openlibrary.org/search.json');
    u.searchParams.set('title', query);
    u.searchParams.set('limit', '5');
    u.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject');
    const r = await getJson(u);
    if (!r.docs.length) return null;
    doc = r.docs[0];
    workKey = doc.key;
    others = r.docs.slice(1, 4).map((x) =>
      `${x.title} — ${(x.author_name || ['?'])[0]} (${x.first_publish_year || '?'}) — \`ol:${x.key.split('/').pop()}\``);
  }
  const work = await getJson(`https://openlibrary.org${workKey}.json`);
  let synopsis = typeof work.description === 'string' ? work.description : work.description?.value || '';
  synopsis = synopsis.split(/\r?\n-{3,}/)[0].trim();
  let authors = doc?.author_name;
  if (!authors) {
    authors = [];
    for (const a of (work.authors || []).slice(0, 3)) {
      try { authors.push((await getJson(`https://openlibrary.org${a.author.key}.json`)).name); } catch {}
    }
  }
  const coverId = doc?.cover_i || work.covers?.[0];
  return {
    best: {
      title: work.title,
      original_title: work.title,
      year: doc?.first_publish_year || parseInt(work.first_publish_date) || null,
      creators: authors,
      genres: (doc?.subject || work.subjects || []).slice(0, 6),
      cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
      synopsis,
      length: { pages: doc?.number_of_pages_median ?? null },
      source: 'openlibrary',
      source_id: workKey.split('/').pop(),
      source_url: `https://openlibrary.org${workKey}`,
    },
    others,
  };
}

// ---------- main ----------
async function main() {
  const f = parseForm(process.env.ISSUE_BODY || '');
  const type = TYPES[f['Tipo']];
  if (!type) throw new Error('Tipo inválido');
  const query = f['Título'];
  if (!query) throw new Error('Título em falta');
  const year = parseInt(f['Ano (opcional)']) || null;

  // ID externo só é usado se o prefixo corresponder ao fornecedor do tipo
  const [prefix, rawId] = (f['ID externo (opcional)'] || '').split(':');
  const wanted = { movie: 'tmdb', series: 'tmdb', anime: 'anilist', book: 'ol' }[type];
  const id = prefix === wanted && rawId ? rawId.trim() : null;

  const found =
    type === 'movie' ? await tmdb('movie', query, year, id) :
    type === 'series' ? await tmdb('tv', query, year, id) :
    type === 'anime' ? await anilist(query, year, id) :
    await openlibrary(query, year, id);

  if (!found) {
    fs.writeFileSync('/tmp/comment.md',
      `😕 Não encontrei "${query}". Tenta outro título (ou o original) e abre nova issue.`);
    fs.writeFileSync('/tmp/commit-msg.txt', 'noop');
    return;
  }

  const m = found.best;
  const slug = slugify(m.title) + (m.year ? `-${m.year}` : '');
  const file = path.join('media', type, `${slug}.md`);

  if (fs.existsSync(file)) {
    fs.writeFileSync('/tmp/comment.md', `ℹ️ **${m.title}** já existe: \`${file}\`. Nada foi alterado.`);
    fs.writeFileSync('/tmp/commit-msg.txt', 'noop');
    return;
  }

  let rating = parseFloat((f['Nota (opcional)'] || '').replace(',', '.'));
  rating = Number.isFinite(rating) && rating >= 0 && rating <= 10 ? rating : null;
  const status = STATUS[f['Estado']] || 'planned';
  const today = new Date().toISOString().slice(0, 10);

  const md = `---
title: ${q(m.title)}
original_title: ${q(m.original_title)}
type: ${type}
year: ${q(m.year)}
creators: ${q(m.creators)}
genres: ${q(m.genres)}
cover: ${q(m.cover)}
length: ${q(m.length)}
source: ${m.source}
source_id: ${q(m.source_id)}
source_url: ${q(m.source_url)}
status: ${status}
rating: ${q(rating)}
date_added: ${today}
date_finished: ${status === 'done' ? today : null}
tags: []
---

# ${m.title}

## Sinopse

${m.synopsis || '_Sem sinopse disponível._'}

## Review

${f['Review (opcional)'] || '<!-- Escreve aqui a tua review -->'}
`;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, md);
  fs.writeFileSync('/tmp/commit-msg.txt', `media: add ${m.title}${m.year ? ` (${m.year})` : ''}`);

  let comment = `✅ Adicionado: **${m.title}**${m.year ? ` (${m.year})` : ''} → \`${file}\``;
  if (found.others.length) {
    comment += `\n\nNão era este? Outras hipóteses (abre nova issue com o ID no campo "ID externo"):\n` +
      found.others.map((o) => `- ${o}`).join('\n');
  }
  fs.writeFileSync('/tmp/comment.md', comment);
}

main().catch((e) => { console.error(e); process.exit(1); });
