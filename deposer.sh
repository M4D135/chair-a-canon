#!/usr/bin/env bash
# Met https://canon.estrasse.fr à jour avec la page construite du commit courant. Commande manuelle, sans timer :
#     ./deposer.sh
# Sur amiga, compte ddd, sans root, même schéma que pdr.estrasse.fr :
#     ~/apps/chair-a-canon/releases/<commit>/index.html   page d'un commit ; les 3 plus récentes sont gardées
#     ~/apps/chair-a-canon/current                         lien vers la version en ligne, basculé d'un coup
#     ~/apps/caddy-shared/vhosts.d/canon.estrasse.fr.Caddyfile  copie de deploiement/, appliquée par apply-vhosts.sh
# Le VPS n'a pas accès au dépôt public : la page part de Spark.
# Refuse de déposer une page qui ne serait pas celle du commit : sources, page, vhost et ce script doivent être
# commités, avant et après la construction.
# Retour arrière : ssh amiga 'ln -sfn releases/<commit> ~/apps/chair-a-canon/current.new && mv -T ~/apps/chair-a-canon/current.new ~/apps/chair-a-canon/current'
set -euo pipefail

depot=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
hote=${CANON_HOTE:-amiga}
racine=/home/ddd/apps/chair-a-canon
vhost_local="$depot/deploiement/canon.estrasse.fr.Caddyfile"
vhost_distant=/home/ddd/apps/caddy-shared/vhosts.d/canon.estrasse.fr.Caddyfile
url=https://canon.estrasse.fr/

propre() { [ -z "$(git -C "$depot" status --porcelain -- src construire.py dist SIZE.json VERSION.json deploiement deposer.sh FERRO.lock.json)" ]; }
propre || { echo "src, construire.py, dist, SIZE.json, VERSION.json, le verrou, deploiement ou deposer.sh ont des modifications non commitées : committer d'abord." >&2; exit 1; }
commit=$(git -C "$depot" rev-parse HEAD)

python3 "$depot/construire.py"
propre || { echo "La page construite diffère de celle du commit : committer dist/chair-a-canon.html et SIZE.json, puis relancer." >&2; exit 1; }
page="$depot/dist/chair-a-canon.html"
empreinte=$(sha256sum "$page" | cut -d' ' -f1)

ssh -o BatchMode=yes "$hote" "install -d -m 755 $racine/releases && rm -rf -- $racine/releases/.tmp-$commit && install -d -m 755 $racine/releases/.tmp-$commit"
scp -q -o BatchMode=yes "$page" "$hote:$racine/releases/.tmp-$commit/index.html"
scp -q -o BatchMode=yes "$vhost_local" "$hote:$vhost_distant.tmp"
ssh -o BatchMode=yes "$hote" bash -s -- "$racine" "$commit" "$empreinte" "$vhost_distant" <<'DISTANT'
set -euo pipefail
racine=$1 commit=$2 empreinte=$3 vhost=$4
tmp=$racine/releases/.tmp-$commit
echo "$empreinte  $tmp/index.html" | sha256sum -c - >/dev/null
mv -T "$tmp" "$racine/releases/$commit"
ln -sfn "releases/$commit" "$racine/current.new"
mv -T "$racine/current.new" "$racine/current"
mv "$vhost.tmp" "$vhost"
"$HOME/apps/caddy-shared/apply-vhosts.sh" >/dev/null
ls -1dt "$racine"/releases/*/ | tail -n +4 | xargs -r rm -rf
DISTANT
curl -fsS -o /dev/null -w "%{http_code} %{size_download} o\n" "$url"
echo "déposé : $url commit $commit sha256 $empreinte"
