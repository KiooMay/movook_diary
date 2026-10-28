// Mini-backend (Cloudflare Worker): recebe pedidos da app e cria issues no GitHub.
// As Actions já existentes (Add media / Remove media) fazem o resto.
//
// Variáveis (wrangler.toml): GITHUB_OWNER, GITHUB_REPO, ALLOWED_ORIGIN
// Secrets:                   GITHUB_TOKEN (fine-grained, só Issues: write), APP_SECRET

const TYPES = { movie: 'Filme', series: 'Série', anime: 'Anime', book: 'Livro' };
const STATUS = {
  planned: 'Quero ver/ler',
  'in-progress': 'A ver/ler',
  done: 'Concluído',
  dropped: 'Abandonado',
};
const MAX_ITEMS = 30;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (env.ALLOWED_ORIGIN && origin.toLowerCase() === env.ALLOWED_ORIGIN.toLowerCase()) {
    h['Access-Control-Allow-Origin'] = origin;
  }
  return h;
}

const json = (data, status, cors) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

// Comparação em tempo constante (via hashes, para tamanhos diferentes não vazarem)
async function authorized(request, env) {
  if (!env.APP_SECRET) return false;
  const m = (request.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(m[1])),
    crypto.subtle.digest('SHA-256', enc.encode(env.APP_SECRET)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// Uma linha de texto sem quebras nem "### " (que injetaria secções no formulário)
const cleanLine = (s) =>
  String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/^#+\s*/, '').trim().slice(0, 200);

const cleanList = (arr) => {
  if (!Array.isArray(arr)) throw new HttpError(400, 'Lista inválida');
  const out = arr.map(cleanLine).filter(Boolean);
  if (!out.length) throw new HttpError(400, 'Nenhum item indicado');
  if (out.length > MAX_ITEMS) throw new HttpError(400, `Máximo de ${MAX_ITEMS} itens`);
  return out;
};

const section = (label, value) => `### ${label}\n\n${value || '_No response_'}\n\n`;

async function createIssue(env, title, body, label) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'mobook-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: title.slice(0, 120), body, labels: [label] }),
    });
  if (!res.ok) {
    console.error('GitHub', res.status, await res.text());
    throw new HttpError(502, `O GitHub recusou o pedido (${res.status})`);
  }
  const issue = await res.json();
  return { ok: true, issue: issue.number, url: issue.html_url };
}

async function add(data, env) {
  const type = TYPES[data.type];
  if (!type) throw new HttpError(400, 'Tipo inválido');
  const status = STATUS[data.status || 'planned'];
  if (!status) throw new HttpError(400, 'Estado inválido');
  const titles = cleanList(data.titles);

  let rating = data.rating === '' || data.rating == null ? null : Number(data.rating);
  if (rating !== null && !(rating >= 0 && rating <= 10)) throw new HttpError(400, 'Nota inválida');
  const review = String(data.review ?? '').slice(0, 5000).replace(/^(\s*)###/gm, '$1\\###');

  const body =
    section('Tipo', type) +
    section('Títulos (um por linha)', titles.join('\n')) +
    section('Estado', status) +
    section('Nota (opcional)', rating === null ? '' : String(rating)) +
    section('Review (opcional)', review);
  const title = `[Adicionar] ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '…' : ''}`;
  return createIssue(env, title, body, 'add-media');
}

async function remove(data, env) {
  const items = cleanList(data.items);
  const body =
    section('Itens a remover (um por linha)', items.join('\n')) +
    section('Confirmação', '- [x] Confirmo que quero remover estes itens (o histórico do Git permite recuperá-los)');
  const title = `[Remover] ${items.slice(0, 3).join(', ')}${items.length > 3 ? '…' : ''}`;
  return createIssue(env, title, body, 'remove-media');
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405, cors);
    // Defesa em profundidade: se o pedido traz Origin, tem de ser o do site
    const origin = request.headers.get('Origin');
    if (origin && !cors['Access-Control-Allow-Origin']) return json({ error: 'Origem não permitida' }, 403, cors);
    if (!(await authorized(request, env))) return json({ error: 'Não autorizado' }, 401, cors);

    let data;
    try { data = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400, cors); }

    try {
      const { pathname } = new URL(request.url);
      if (pathname === '/add') return json(await add(data, env), 200, cors);
      if (pathname === '/remove') return json(await remove(data, env), 200, cors);
      return json({ error: 'Não encontrado' }, 404, cors);
    } catch (e) {
      return json({ error: e.status ? e.message : 'Erro interno' }, e.status || 500, cors);
    }
  },
};
