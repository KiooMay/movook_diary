#!/usr/bin/env bash
# Uso: bash scripts/apply-and-push.sh <comando que altera media/ e escreve /tmp/commit-msg.txt>
# Corre o comando, faz commit e push. Se outro workflow gravou entretanto e há conflito,
# recomeça do zero sobre o estado mais recente (o comando é aplicado outra vez).
set -uo pipefail

git config user.name "media-bot"
git config user.email "media-bot@users.noreply.github.com"
BR="$(git rev-parse --abbrev-ref HEAD)"

for attempt in 1 2 3 4 5 6; do
  "$@" || exit 1
  git add -A media
  if git diff --cached --quiet; then echo "Nada para guardar."; exit 0; fi
  git commit -q -F "${COMMIT_MSG_FILE:-/tmp/commit-msg.txt}"
  if git pull --rebase -q origin "$BR" && git push -q origin "HEAD:$BR"; then
    echo "Guardado (tentativa $attempt)."; exit 0
  fi
  echo "Conflito na tentativa $attempt: a recomeçar sobre o estado atual."
  git rebase --abort 2>/dev/null || true
  git fetch -q origin "$BR"
  git reset -q --hard "origin/$BR"
  sleep $((attempt * 2 + RANDOM % 3))
done
echo "Não consegui guardar depois de várias tentativas." >&2
exit 1
