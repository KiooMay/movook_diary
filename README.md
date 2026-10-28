# Biblioteca de livros, filmes, séries e animes

Base de dados em Markdown, preenchida automaticamente por GitHub Actions.

## Configuração (uma vez)
1. Cria uma conta e uma chave gratuita em https://www.themoviedb.org/settings/api (v3 auth).
2. No repo: Settings → Secrets and variables → Actions → New repository secret → `TMDB_API_KEY`.
3. Settings → Actions → General → Workflow permissions → "Read and write permissions".
4. Cria o label `add-media` (Issues → Labels), se ainda não existir.

## Uso
Issues → New issue → "Adicionar à biblioteca" → preenche → o bot cria `media/<tipo>/<slug>.md` e fecha a issue.
Edita o ficheiro depois para ajustar nota, datas e review.

## Fontes
TMDB (filmes/séries), AniList (animes), Open Library (livros).
