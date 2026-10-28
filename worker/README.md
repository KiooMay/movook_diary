# Mobook API (Cloudflare Worker)

Recebe pedidos da app e cria issues no GitHub (`add-media` / `remove-media`).
As Actions fazem o resto.

## 1. Token do GitHub
GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate:
- Repository access: **Only select repositories** → `mobook_diary`
- Permissions → Repository → **Issues: Read and write**
- O token tem de ser da conta dona do repo (o workflow só aceita issues criadas por ela).

## 2. Passphrase da app
Inventa uma frase longa (16+ caracteres). É o que a app envia ao Worker.
Não a ponhas no repositório (é público).

## 3a. Deploy pelo painel (sem instalar nada)
1. https://dash.cloudflare.com → Workers & Pages → Create → Worker → dá-lhe o nome `mobook-api` → Deploy.
2. Edit code → apaga o exemplo, cola o conteúdo de `src/index.js` → Deploy.
3. Settings → Variables and Secrets → adiciona:
   - Texto: `GITHUB_OWNER`, `GITHUB_REPO`, `ALLOWED_ORIGIN` (valores do `wrangler.toml`)
   - Secret: `GITHUB_TOKEN`, `APP_SECRET`
4. Copia o endereço do Worker (algo como `https://mobook-api.<conta>.workers.dev`).

## 3b. Deploy com a linha de comandos
```
cd worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put APP_SECRET
npx wrangler deploy
```

## 4. Ligar a app
No site: ⚙ → cola o endereço do Worker e a passphrase → Guardar.
Isto fica só no teu dispositivo; repete em cada aparelho.

## Manutenção
- Os tokens fine-grained expiram: quando falhar com 502 (401 do GitHub), gera outro e atualiza o secret.
- Para trocar a passphrase: atualiza `APP_SECRET` no Worker e volta a introduzi-la na app.
