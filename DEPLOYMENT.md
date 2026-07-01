# Mise en production

Ce document est le runbook vivant de mise en production. Il doit rester a jour
avec le code pour permettre un deploiement reproductible, meme sans assistance
interactive.

## Principes

- Aucun secret ne doit etre commite.
- La base de donnees est preparee avant le lancement applicatif.
- Les migrations sont lancees explicitement et leur resultat est verifie.
- Les seeds de developpement ne sont jamais lances en production.
- Un backup PostgreSQL doit exister avant chaque migration en production.
- L'utilisateur PostgreSQL applicatif doit avoir le minimum de privileges une
  fois la base creee.

## Prerequis serveur

- VPS Ubuntu a jour.
- Node.js `24.16.0` ou plus recent.
- PostgreSQL accessible depuis le backend via le service Docker/local du VPS.
- Caddy pour le reverse proxy, TLS automatique et les domaines.
- Process manager pour l'API Node.js : service `systemd` sur le VPS actuel.
- Firewall actif, ports publics limites a SSH, HTTP, HTTPS et au port legacy
  encore necessaire au site historique.
- `fail2ban` actif au moins pour SSH.
- Strategie de backup PostgreSQL testee.

## Variables backend

Creer un fichier d'environnement hors Git pour le backend. En production,
`NODE_ENV=production` active les validations strictes de configuration.

Variables critiques :

- `NODE_ENV=production`
- `PORT`
- `WEB_CLIENT_URL`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_SSL`
- `DB_MAINTENANCE_NAME`
- `SESSION_SECRET`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_TTL_HOURS`
- `SESSION_CLEANUP_INTERVAL_MINUTES`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_CALLBACK_URL`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_CALLBACK_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `CHANGE_REQUEST_RATE_LIMIT_MAX`
- `PHOTO_UPLOAD_MAX_BYTES`
- `PHOTO_UPLOAD_RATE_LIMIT_MAX`
- `PHOTO_STORAGE_DIR`
- `PHOTO_DRAFT_MAX_AGE_HOURS`
- `METRICS_TOKEN`

`SESSION_SECRET` doit etre long, aleatoire et different de la valeur d'exemple.
`METRICS_TOKEN` doit aussi etre long, aleatoire, hors Git et identique entre le
`.env` backend et le fichier lu par Prometheus.

Les applications OAuth doivent autoriser les callbacks de production avant le
premier deploiement public :

- Google : `https://gta-rp.f1prediction.fr/api/auth/google/callback`
- Discord : `https://gta-rp.f1prediction.fr/api/auth/discord/callback`
- Twitch : `https://gta-rp.f1prediction.fr/api/auth/twitch/callback`

Les valeurs `GOOGLE_CALLBACK_URL`, `DISCORD_CALLBACK_URL` et
`TWITCH_CALLBACK_URL` doivent correspondre exactement aux URLs declarees chez
les fournisseurs OAuth, schema `https` inclus. Si plusieurs domaines pointent
vers le meme serveur, declarer chaque domaine utilise pour la connexion dans les
consoles Google, Discord et Twitch ou choisir un domaine canonique unique pour
l'authentification.

Le domaine canonique retenu pour le deploiement initial est
`gta-rp.f1prediction.fr`. Le domaine racine `f1prediction.fr` et son chemin
`/api/*` sont deja utilises par un autre site et ne doivent pas etre modifies
pour ce deploiement.

Le backend utilise desormais un store de session persistant en PostgreSQL pour
eviter la perte des sessions lors des redemarrages applicatifs. Les sessions
sont stockees dans la table `user_sessions`, avec une expiration serveur
pilotee par `SESSION_TTL_HOURS` et un nettoyage periodique des lignes expirees
toutes les `SESSION_CLEANUP_INTERVAL_MINUTES`.

En production derriere Caddy, l'API Express active `trust proxy` afin que les
cookies de session `Secure` soient bien emis pendant les flux OAuth. Si ce
reglage est retire, les callbacks OAuth echouent avec une erreur de verification
de connexion expiree car le cookie contenant l'etat OAuth n'est pas conserve.

Par defaut, les photos sont stockees sous `backend/storage/uploads`, ignore par
Git. En production, conserver ce dossier hors du repertoire servi directement
par Caddy : l'API expose uniquement les fichiers valides sous
`/uploads/characters`. Les brouillons temporaires restent internes sous
`tmp/`.

## Emplacements de production

Sur le VPS actuel :

- racine applicative : `/var/www/gta-rp-population-graph/current`
- backend : `/var/www/gta-rp-population-graph/current/backend`
- frontend build : `/var/www/gta-rp-population-graph/current/web-client/dist`
- stockage partage : `/var/www/gta-rp-population-graph/shared`
- uploads valides : `/var/www/gta-rp-population-graph/shared/storage/uploads/characters`
- brouillons photo : `/var/www/gta-rp-population-graph/shared/storage/uploads/tmp`
- backups PostgreSQL : `/var/www/gta-rp-population-graph/shared/backups/postgres`
- backups uploads : `/var/www/gta-rp-population-graph/shared/backups/uploads`
- logs applicatifs complementaires : `/var/www/gta-rp-population-graph/shared/logs`
- fichier d'environnement backend : `/var/www/gta-rp-population-graph/current/backend/.env`

Les logs principaux passent aujourd'hui par `journalctl` car le backend et les
jobs systeme sont geres par `systemd`.

Commandes utiles :

```bash
sudo systemctl status gta-rp-backend.service --no-pager
sudo journalctl -u gta-rp-backend.service -n 100 --no-pager
sudo journalctl -u gta-rp-photo-cleanup.service -n 50 --no-pager
sudo journalctl -u gta-rp-postgres-backup.service -n 50 --no-pager
sudo journalctl -u gta-rp-uploads-backup.service -n 50 --no-pager
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 100 --no-pager
```

## Maintenance systeme recente

Maintenance executee le `2026-06-30` sur le VPS actuel :

- `apt-get full-upgrade` applique avec succes.
- Nouveau noyau charge apres reboot : `6.8.0-124-generic`.
- `caddy` mis a jour en `2.11.4`.
- `openssh-server`, `openssl`, `curl`, `docker.io`, `containerd` et les
  principaux paquets systeme ont ete mis a jour.
- `apt-daily.timer` est revenu en etat normal apres reboot.
- `gta-rp-backend.service` et `caddy.service` ont ete verifies apres
  redemarrage.
- Smoke tests publics verifies apres maintenance :
  - `https://gta-rp.f1prediction.fr/api/health`
  - `https://gta-rp.f1prediction.fr/`
  - `https://f1prediction.fr/`

Commandes utiles pour une future maintenance :

```bash
sudo apt-get update
sudo apt-get -s full-upgrade
sudo apt-get -y full-upgrade
sudo systemctl reboot
uname -r
apt list --upgradable
sudo systemctl --failed --no-pager
```

Verifier apres reboot :

```bash
sudo systemctl status gta-rp-backend.service --no-pager
sudo systemctl status caddy.service --no-pager
sudo systemctl status apt-daily.timer --no-pager
curl -fsS https://gta-rp.f1prediction.fr/api/health
curl -I https://gta-rp.f1prediction.fr/
curl -I https://f1prediction.fr/
```

## Verification ops du 2026-07-01

Passe non destructive executee depuis l'environnement de travail :

- `https://gta-rp.f1prediction.fr/` repond `HTTP 200`.
- `https://gta-rp.f1prediction.fr/api/health` repond `{"status":"ok",...}`.
- `https://gta-rp.f1prediction.fr/api/auth/session` repond
  `{"authenticated":false}` hors session active.
- `https://gta-rp.f1prediction.fr/api/characters?limit=1` renvoie des donnees
  publiques.
- `https://gta-rp.f1prediction.fr/api/auth/google` repond `HTTP 302` vers
  Google et pose un cookie de session `Secure`.
- Les services/timers `gta-rp-backend.service`, `caddy`,
  `gta-rp-photo-cleanup.timer`, `gta-rp-postgres-backup.timer` et
  `gta-rp-uploads-backup.timer` sont actifs.
- Les sauvegardes locales existent sur le VPS :
  - PostgreSQL quotidien : dernier dump vu le `2026-07-01 03:15 UTC`.
  - Uploads hebdomadaire : derniere archive vue le `2026-06-30 21:55 UTC`.
- `ufw` est actif avec politique entrante par defaut `deny`.
- PostgreSQL `5432/tcp` est explicitement refuse en entree publique.
- `fail2ban` protege `sshd` et avait des bannissements actifs au moment du
  controle.
- Espace disque : environ `6.3G / 38G`, soit `18%`.

Point a garder en tete : le port `5000` reste ouvert pour le site historique ou
un usage existant du VPS. Ne pas le fermer sans verifier l'autre application.

## Check ops reproductible

Le depot fournit un script de controle read-only pour rejouer les verifications
ops essentielles sans installer encore de dashboard complet :

```bash
scripts/check-production-ops.sh
```

Ce script verifie :

- page publique, healthcheck, session anonyme, endpoint personnages et demarrage
  OAuth Google ;
- backend, Caddy et timers `systemd` ;
- presence de sauvegardes PostgreSQL et uploads non vides ;
- firewall actif et PostgreSQL non expose publiquement ;
- jail `fail2ban` SSH disponible ;
- usage disque racine sous 80% ;
- retention `journald` appliquee.

Variantes utiles :

```bash
scripts/check-production-ops.sh --public-only
scripts/check-production-ops.sh --ssh-only
```

Le script accepte les memes variables d'environnement SSH que le script de
recuperation de sauvegarde : `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY` et
`REMOTE_BACKUP_ROOT`. Il ne remplace pas les futurs smoke tests metier
interactifs, mais sert de controle ops rapide apres maintenance, deploiement ou
incident.

## Hygiene stockage

Constat releve sur le VPS le `2026-06-30` apres maintenance :

- occupation disque globale ramenee a environ `6.3G / 38G` (`18%`).
- principal gisement de nettoyage identifie : `journald`.
- les journaux `systemd` occupaient environ `2.2G` avant nettoyage.
- un `journalctl --vacuum-size=500M` a ramene `journald` a environ `490M`,
  soit un gain d'environ `1.7G`.
- `apt-get clean` a aussi reduit le cache APT a un niveau faible.

Plafonnement durable applique le `2026-07-01` :

- drop-in versionne : `ops/systemd/journald-gta-rp-retention.conf`
- fichier installe : `/etc/systemd/journald.conf.d/99-gta-rp-retention.conf`
- `SystemMaxUse=500M`
- `SystemKeepFree=1G`
- `MaxRetentionSec=30day`
- `systemd-journald` redemarre avec la configuration effective verifiee.
- usage journal au moment du controle : environ `17.2M`.

Commandes utiles de diagnostic :

```bash
df -h / /var
sudo du -xhd1 /var | sort -h
sudo du -xhd2 /var/log | sort -h | tail -n 40
sudo journalctl --disk-usage
systemd-analyze cat-config systemd/journald.conf | grep -E '^(SystemMaxUse|SystemKeepFree|MaxRetentionSec)='
sudo du -sh /var/cache/apt /var/lib/apt/lists
sudo docker system df
find /var/www/gta-rp-population-graph/shared/backups -maxdepth 3 -type f | sort
```

Nettoyage prudent autorise :

```bash
sudo journalctl --vacuum-size=500M
sudo apt-get clean
sudo apt-get autoremove --purge
```

Points d'attention :

- ne pas supprimer a la main les dossiers `shared/storage` ou `shared/backups`
  sans verification metier.
- `docker system prune` n'est pas a lancer a l'aveugle sur ce VPS tant que
  l'inventaire complet des autres usages Docker n'est pas formalise.
- `/home/jrechau`, `/root/.nvm`, `/root/.npm` et les traces PM2 semblent lies a
  d'autres usages du serveur ; ils ne doivent pas etre nettoyes sans arbitrage
  explicite.

## Reverse proxy Caddy

Le VPS actuel utilise Caddy, pas Nginx. Le site existant reste servi sur
`f1prediction.fr` et `www.f1prediction.fr`. Le nouveau site doit etre ajoute
dans un bloc Caddy separe pour `gta-rp.f1prediction.fr`, afin de ne pas toucher
a la disponibilite du site existant.

Exemple cible :

```caddyfile
gta-rp.f1prediction.fr {
    route {
        handle /api/* {
            reverse_proxy 127.0.0.1:4000
        }

        handle /uploads/* {
            reverse_proxy 127.0.0.1:4000
        }

        handle /supervision/* {
            forward_auth 127.0.0.1:4000 {
                uri /api/supervision/authorize
                copy_headers X-WEBAUTH-USER
            }

            reverse_proxy 127.0.0.1:3001
        }

        handle {
            root * /var/www/gta-rp-population-graph/current/web-client/dist
            try_files {path} /index.html
            file_server
        }
    }
}
```

Avant toute modification de `/etc/caddy/Caddyfile`, creer une sauvegarde datee,
valider la configuration puis recharger Caddy :

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy emettra le certificat TLS automatiquement quand le DNS
`gta-rp.f1prediction.fr` pointera bien vers le VPS et que les ports 80/443
seront joignables publiquement.

Les photos issues des imports Notion ne doivent pas etre servies directement
depuis une URL distante. L'administration telecharge la photo au moment de
l'action `Importer la photo`, puis le backend la valide, la reencode et la
stocke localement comme n'importe quelle photo approuvee.

## Supervision Prometheus + Grafana

La supervision pre-utilisateurs retenue est auto-hebergee sur le meme VPS :

- Prometheus collecte les metriques.
- Grafana affiche les dashboards.
- `node_exporter` expose les metriques systeme VPS et les metriques textfile.
- `blackbox_exporter` sonde le site public en HTTP/TLS.
- Le backend expose `GET /api/internal/metrics`, en format Prometheus, protege
  par `METRICS_TOKEN`.
- Grafana est accessible uniquement via
  `https://gta-rp.f1prediction.fr/supervision/`.
- L'endpoint `GET /api/supervision/authorize`, utilise par Caddy
  `forward_auth`, est volontairement exclu du rate limit API global. Grafana
  declenche beaucoup de requetes rapprochées pour charger dashboards, panneaux
  et assets ; sans cette exemption, l'admin atteint vite la limite
  `Too many requests`.
- Les metriques visiteurs sont des estimations operationnelles, pas un outil
  d'analytics nominatif : le backend compte en memoire des empreintes
  IP+navigateur hachees, sans exposer ni stocker les IP ou user-agents en base.
  Le total repart a zero au redemarrage de l'API ; le compteur journalier suit
  la journee UTC courante.
- Prometheus, Grafana, node_exporter et blackbox_exporter restent bindes sur
  `127.0.0.1` et ne doivent pas etre exposes publiquement.
- Les conteneurs monitoring utilisent `network_mode: host` sur ce VPS afin de
  scraper le backend local et les exporters sans ouvrir de ports publics.

Fichiers versionnes :

- stack Compose : `ops/monitoring/docker-compose.yml`
- Prometheus : `ops/monitoring/prometheus/prometheus.yml`
- blackbox : `ops/monitoring/blackbox/blackbox.yml`
- provisioning Grafana : `ops/monitoring/grafana/provisioning/`
- dashboards Grafana : `ops/monitoring/grafana/dashboards/`
- metriques textfile : `scripts/write-monitoring-textfile-metrics.sh`
- timer textfile :
  `ops/systemd/gta-rp-monitoring-textfile.service`
  et `ops/systemd/gta-rp-monitoring-textfile.timer`

Creation des dossiers partages sur le VPS :

```bash
sudo mkdir -p /var/www/gta-rp-population-graph/shared/monitoring/prometheus
sudo mkdir -p /var/www/gta-rp-population-graph/shared/monitoring/grafana
sudo mkdir -p /var/www/gta-rp-population-graph/shared/monitoring/node-exporter-textfile
sudo mkdir -p /var/www/gta-rp-population-graph/shared/monitoring/secrets
sudo chown codex-deploy:codex-deploy /var/www/gta-rp-population-graph/shared/monitoring
sudo chown 65534:65534 /var/www/gta-rp-population-graph/shared/monitoring/prometheus
sudo chown 472:472 /var/www/gta-rp-population-graph/shared/monitoring/grafana
sudo chown codex-deploy:codex-deploy /var/www/gta-rp-population-graph/shared/monitoring/node-exporter-textfile
sudo chown codex-deploy:codex-deploy /var/www/gta-rp-population-graph/shared/monitoring/secrets
```

Generer les secrets hors Git :

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Utiliser la premiere valeur comme `METRICS_TOKEN` dans :

- `/var/www/gta-rp-population-graph/current/backend/.env`
- `/var/www/gta-rp-population-graph/shared/monitoring/secrets/metrics_token`

Le fichier Prometheus doit contenir uniquement le token brut, sans prefixe
`Bearer` :

```bash
printf '%s' '<METRICS_TOKEN>' > /var/www/gta-rp-population-graph/shared/monitoring/secrets/metrics_token
sudo chown 65534:65534 /var/www/gta-rp-population-graph/shared/monitoring/secrets/metrics_token
sudo chmod 400 /var/www/gta-rp-population-graph/shared/monitoring/secrets/metrics_token
```

Utiliser la deuxieme valeur comme mot de passe admin local Grafana, dans un
fichier d'environnement non versionne :

```bash
cat >/var/www/gta-rp-population-graph/shared/monitoring/.env <<'EOF'
GRAFANA_ADMIN_USER=local-admin
GRAFANA_ADMIN_PASSWORD=<GRAFANA_ADMIN_PASSWORD>
MONITORING_SHARED_DIR=/var/www/gta-rp-population-graph/shared/monitoring
METRICS_TOKEN_FILE=/var/www/gta-rp-population-graph/shared/monitoring/secrets/metrics_token
EOF
chmod 600 /var/www/gta-rp-population-graph/shared/monitoring/.env
```

Lancer la stack :

```bash
cd /var/www/gta-rp-population-graph/current/ops/monitoring
sudo docker compose --env-file /var/www/gta-rp-population-graph/shared/monitoring/.env config
sudo docker compose --env-file /var/www/gta-rp-population-graph/shared/monitoring/.env up -d
sudo docker compose --env-file /var/www/gta-rp-population-graph/shared/monitoring/.env ps
```

Le plugin `docker compose` v2 est installe sur le VPS depuis le `2026-07-01`.
L'ancien binaire `docker-compose` v1 reste disponible temporairement en fallback.
Si ce fallback est necessaire, le fichier `shared/monitoring/.env` peut etre
lie dans le dossier Compose pour que `docker-compose` le charge automatiquement :

```bash
cd /var/www/gta-rp-population-graph/current/ops/monitoring
ln -sfn /var/www/gta-rp-population-graph/shared/monitoring/.env .env
sudo docker-compose config
sudo docker-compose up -d
sudo docker-compose ps
```

Installer le timer des metriques textfile :

```bash
cd /var/www/gta-rp-population-graph/current
sudo install -Dm755 scripts/write-monitoring-textfile-metrics.sh /var/www/gta-rp-population-graph/current/scripts/write-monitoring-textfile-metrics.sh
sudo install -Dm644 ops/systemd/gta-rp-monitoring-textfile.service /etc/systemd/system/gta-rp-monitoring-textfile.service
sudo install -Dm644 ops/systemd/gta-rp-monitoring-textfile.timer /etc/systemd/system/gta-rp-monitoring-textfile.timer
sudo systemctl daemon-reload
sudo systemctl enable --now gta-rp-monitoring-textfile.timer
sudo systemctl start gta-rp-monitoring-textfile.service
```

Modifier Caddy en ajoutant le `handle /supervision/*` du bloc exemple ci-dessus
avant le `handle` statique frontend, puis valider et recharger :

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Verifications :

```bash
curl -fsS http://127.0.0.1:9090/-/healthy
curl -I https://gta-rp.f1prediction.fr/supervision/
ss -lnt | grep -E '127\.0\.0\.1:(3001|9090|9100|9115)'
scripts/check-production-ops.sh
```

Dans Grafana, verifier les dashboards provisionnes :

- `GTA RP - Vue d'ensemble`
- `GTA RP - VPS`
- `GTA RP - Application`
- `GTA RP - Donnees metier`

Prometheus doit afficher les targets `prometheus`, `node`, `gta-rp-backend`,
`blackbox-http` et `blackbox-redirects` en etat `UP`.

## Creation de la base

Le script suivant cree la base `DB_NAME` si elle n'existe pas encore :

```bash
cd backend
npm run db:ensure
```

Le script se connecte a `DB_MAINTENANCE_NAME`, par defaut `postgres`, avec les
identifiants `DB_USER` et `DB_PASSWORD`. Il valide le nom de base avant de
construire la commande `CREATE DATABASE`.

Sur le VPS actuel, PostgreSQL est expose localement via Docker sur
`127.0.0.1:5432`. Le backend GTA-RP doit utiliser cette exposition locale avec
un nom de base et un utilisateur dedies, differents de ceux du site existant.

Deux modes restent possibles selon les droits PostgreSQL disponibles :

- En developpement ou sur un VPS simple, `DB_USER` peut avoir temporairement le
  droit `CREATEDB`, puis ce privilege doit etre retire si possible.
- En production durcie, creer la base avec un compte administrateur PostgreSQL
  separe, puis utiliser pour l'application un compte limite a la base cible.

Si l'utilisateur applicatif ne permet pas `CREATE DATABASE`, creer la base et
l'utilisateur avec un compte administrateur PostgreSQL, puis lancer directement
les migrations avec le compte limite.

## Migrations

Toujours verifier l'etat avant et apres :

```bash
cd backend
npm run db:migrate:pending
npm run db:migrate
npm run db:migrate:executed
npm run db:migrate:pending
```

Le dernier `pending` doit retourner une liste vide.

La migration initiale unique cree aussi la table `user_sessions` necessaire au
store de session persistant. Tant que cette migration n'est pas appliquee,
l'API ne doit pas etre demarree en production ou en environnement partage.

La migration des slugs publics de personnages backfill automatiquement la
colonne `public_slug` a partir du nom et prenom existants, au format lisible
`prenom-nom`, avec suffixe numerote si un doublon est detecte. Ces slugs
servent ensuite aux URLs publiques partageables des fiches. Lors d'une
modification ulterieure du prenom ou du nom, le slug est regenere
automatiquement avec la meme logique.

Ne pas lancer `npm run db:seed` en production. Les seeds sont uniquement faits
pour le developpement local.

## Checks avant redemarrage

Le script racine lance la sequence complete backend puis frontend :

```bash
./script/run-all-checks.sh
```

La sequence detaillee reste utile si un sous-ensemble doit etre relance :

```bash
cd backend
npm run check
npm test
npm run build
```

## Procedure de mise a jour reproductible

Sur le VPS actuel, le dossier de production `current` n'est pas un checkout
Git. La mise a jour doit donc se faire par synchronisation de fichiers depuis
une machine de travail ou un environnement de build maitrise.

Sequence recommandee :

1. Sur la machine source, verifier l'etat du code et lancer les validations.
2. Synchroniser le depot vers le serveur sans ecraser le stockage partage.
3. Reinstaller les dependances si necessaire.
4. Rebuilder backend et frontend sur le VPS.
5. Verifier l'etat des migrations.
6. Lancer un backup PostgreSQL avant toute migration si une migration est
   attendue.
7. Appliquer les migrations si besoin.
8. Redemarrer le backend.
9. Executer les smoke tests publics.

Exemple depuis la machine source :

```bash
cd /workspaces/gta-rp-population-graph
./script/run-all-checks.sh

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'backend/node_modules' \
  --exclude 'web-client/node_modules' \
  --exclude 'backend/dist' \
  --exclude 'web-client/dist' \
  --exclude 'backend/.env' \
  --exclude 'backend/storage' \
  -e "ssh -i ~/.ssh/codex_gta_rp_deploy" \
  /workspaces/gta-rp-population-graph/ \
  codex-deploy@65.109.171.143:/var/www/gta-rp-population-graph/current/
```

Puis sur le VPS :

```bash
cd /var/www/gta-rp-population-graph/current/backend
npm install
npm run build
npm run db:migrate:pending

cd /var/www/gta-rp-population-graph/current/web-client
npm install
npm run build

cd /var/www/gta-rp-population-graph/current/backend
if npm run db:migrate:pending | rg -qv '\[\]'; then
  sudo systemctl start gta-rp-postgres-backup.service
  npm run db:migrate
fi

sudo systemctl restart gta-rp-backend.service
curl -sS https://gta-rp.f1prediction.fr/api/health
```

Si un sous-ensemble seulement change, garder la meme logique mais ne relancer
que la partie concernee. En revanche, toute modification backend ou frontend
publique doit idealement etre suivie d'un build local, d'une synchronisation
propre et d'un smoke test public.

## Smoke tests de production

Apres chaque mise a jour applicative significative :

1. verifier la sante HTTP ;
2. verifier le chargement de la page publique ;
3. verifier au moins un endpoint public de donnees ;
4. verifier le demarrage OAuth ;
5. verifier les parcours proteges essentiels avec un compte de test ou un
   compte administrateur controle.

Smoke tests publics minimaux :

```bash
curl -I -sS https://gta-rp.f1prediction.fr/
curl -sS https://gta-rp.f1prediction.fr/api/health
curl -sS https://gta-rp.f1prediction.fr/api/auth/session
curl -sS 'https://gta-rp.f1prediction.fr/api/characters?limit=1'
curl -I -sS https://gta-rp.f1prediction.fr/api/auth/google
```

Resultats attendus :

- page publique : `HTTP 200`
- health : `{"status":"ok",...}`
- session anonyme : `{"authenticated":false}` hors session active
- characters : JSON avec `items`
- auth Google : `HTTP 302` vers `accounts.google.com`

Smoke tests metier a consigner manuellement :

- consultation publique d'une fiche et chargement du graphe
- ouverture du profil apres connexion
- login Google
- login Discord
- login Twitch
- modification directe admin d'une fiche
- ouverture moderation
- ouverture administration
- import Notion : consultation d'un batch, application d'une fiche
- import photo Notion

Si un test echoue :

1. recuperer l'heure de l'echec ;
2. consulter `journalctl` sur le backend et, si besoin, sur Caddy ;
3. verifier si une migration ou une synchronisation incomplete a eu lieu ;
4. decider rapidement entre correction a chaud et rollback.

### Passe automatisee du 2026-07-01

Smoke tests automatisables executes depuis l'environnement de travail :

- `scripts/check-production-ops.sh` complet : OK.
- Page publique `https://gta-rp.f1prediction.fr/` : `HTTP 200`.
- Fiche publique partageable `/?character=heitor-leite-jr` : `HTTP 200`.
- API fiche `GET /api/characters/heitor-leite-jr` : OK.
- API graphe `GET /api/graph` : OK.
- API historique `GET /api/history?limit=1` : OK.
- Photo publique validee `/uploads/characters/...webp` : `HTTP 200`,
  `content-type: image/webp`.
- Demarrage OAuth Google, Discord et Twitch : `HTTP 302` vers les fournisseurs
  attendus, avec cookie de session `Secure`.
- Routes protegees en anonyme : profil, contribution, moderation, admin et
  imports Notion repondent `401 AUTHENTICATION_REQUIRED`.
- Logs backend sur la fenetre de test : aucune erreur recente.

### Passe metier interactive du 2026-07-01

Smoke tests metier executes manuellement avec session reelle :

- Connexion Google : OK.
- Connexion Discord : OK.
- Connexion Twitch : OK.
- Profil connecte : OK.
- Administration :
  - creation de tag : OK ;
  - suppression de tag : OK ;
  - historique admin : OK.
- Notion :
  - import : OK ;
  - application de fiche : OK ;
  - import photo : OK.
- Modification de fiche :
  - import photo manuel : OK ;
  - modification : OK.

## Nettoyage des photos temporaires

Les uploads photo de contribution sont d'abord stockes en brouillons internes.
Ces fichiers temporaires doivent etre nettoyes periodiquement pour limiter le
spam disque et supprimer les brouillons abandonnes.

Le backend fournit un job dedie :

```bash
cd backend
npm run photo:cleanup
```

Le job supprime uniquement les fichiers du dossier temporaire qui respectent le
format attendu `userId.photoId.webp` et dont l'age depasse
`PHOTO_DRAFT_MAX_AGE_HOURS` (24 heures par defaut). Il ne parcourt pas
recursivement le stockage et ne touche jamais au dossier public
`characters/`.

Sur le VPS actuel, configurer un service et un timer systemd separes de l'API :

```ini
# /etc/systemd/system/gta-rp-photo-cleanup.service
[Unit]
Description=GTA RP photo draft cleanup

[Service]
Type=oneshot
User=codex-deploy
Group=codex-deploy
WorkingDirectory=/var/www/gta-rp-population-graph/current/backend
Environment=PATH=/opt/node-gta-rp/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/opt/node-gta-rp/bin/npm run photo:cleanup
```

```ini
# /etc/systemd/system/gta-rp-photo-cleanup.timer
[Unit]
Description=Run GTA RP photo draft cleanup hourly

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

Le timer se lance toutes les heures, execute le nettoyage, logue le nombre de
fichiers scannes/supprimes/ignores, puis s'arrete. L'API Express reste separee :
un echec du job ne doit pas rendre le site indisponible.

Quand le frontend aura son pipeline de production final :

```bash
cd web-client
npm run check
npm test
npm run build
```

## Backup et rollback

Avant toute migration de production :

1. Creer un dump PostgreSQL date.
2. Verifier que le dump est stocke hors du repertoire applicatif.
3. Verifier que la commande de restauration est connue et testee sur un
   environnement non production.

Rollback applicatif minimal :

1. Revenir au tag ou commit applicatif precedent.
2. Reinstaller les dependances si necessaire.
3. Relancer le build backend et frontend.
4. Redemarrer le process manager.
5. Restaurer la base seulement si la migration appliquee n'est pas compatible
   avec l'ancien code.

Sequence plus concrete sur ce VPS :

```bash
cd /var/www/gta-rp-population-graph/current
git fetch --all --tags
git checkout <commit-ou-tag-precedent>
cd backend && npm install && npm run build
cd ../web-client && npm install && npm run build
sudo systemctl restart gta-rp-backend.service
curl -sS https://gta-rp.f1prediction.fr/api/health
```

Si une restauration de base est necessaire, toujours :

1. couper d'abord les actions d'ecriture si possible ;
2. restaurer sur une base temporaire pour verification quand le temps le
   permet ;
3. ne remplacer la base active qu'avec une procedure validee manuellement.

## Strategie de backup cible pour un VPS 10 Go

Le VPS dispose de peu de stockage. Il faut donc eviter les dumps volumineux
conserves longtemps sur disque local. La strategie cible doit rester autonome,
avec rotation automatique, tout en preparant une vraie sortie hors VPS.

Principes retenus :

- Les sauvegardes PostgreSQL sont prioritaires : elles coutent peu, se
  compressent bien et couvrent l'essentiel des donnees metier.
- Les uploads photos doivent aussi etre sauvegardes, mais avec une frequence
  plus faible et une retention plus courte tant que leur volumetrie reste
  limitee.
- Une sauvegarde stockee uniquement sur le meme VPS n'est pas une sauvegarde
  suffisante contre une perte disque ou machine. Le local sert surtout de
  tampon court terme.

Plan recommande :

1. Sauvegardes PostgreSQL locales automatiques :
   - format `pg_dump --format=custom` ou dump compresse `gzip`
   - frequence : toutes les nuits
   - retention locale : `7` journaliers + `4` hebdomadaires
   - stockage cible : `/var/www/gta-rp-population-graph/shared/backups/postgres`
2. Sauvegarde locale des uploads valides :
   - archive compressee du dossier `shared/storage/uploads/characters`
   - frequence : hebdomadaire
   - retention locale : `2` a `4` archives maximum
   - stockage cible : `/var/www/gta-rp-population-graph/shared/backups/uploads`
3. Rotation automatique :
   - suppression automatique des archives depassant la retention
   - verification apres chaque run de l'espace disque restant
4. Sortie distante a activer des que possible :
   - cible recommandee : stockage objet ou box distante dediee
   - le local court terme reste utile, mais ne doit pas etre l'unique copie

Le depot versionne les briques de base suivantes :

- script PostgreSQL : `scripts/backup-postgres.sh`
- script uploads : `scripts/backup-uploads.sh`
- units `systemd` :
  - `ops/systemd/gta-rp-postgres-backup.service`
  - `ops/systemd/gta-rp-postgres-backup.timer`
  - `ops/systemd/gta-rp-uploads-backup.service`
  - `ops/systemd/gta-rp-uploads-backup.timer`

Retention de depart conseillee :

- PostgreSQL :
  - `7` sauvegardes journalieres
  - `4` sauvegardes hebdomadaires
- Uploads :
  - `2` a `4` sauvegardes hebdomadaires

Cette retention est volontairement conservative pour tenir dans `10` Go. Si la
base ou les photos grossissent, il faudra reduire encore la retention locale ou
accelerer la mise en place d'une cible hors VPS.

Implementation technique recommande :

- Un script `backup-postgres.sh` :
  - lit le `.env` backend
  - lance `pg_dump`
  - nomme les archives avec timestamp UTC
  - supprime les anciennes archives selon la retention
- Un script `backup-uploads.sh` :
  - archive uniquement `uploads/characters`
  - ignore `uploads/tmp`
  - applique la meme logique de retention
- Deux services `systemd` `oneshot`
- Deux timers `systemd` separes :
  - sauvegarde PostgreSQL : nightly
  - sauvegarde uploads : weekly

Installation sur le VPS :

```bash
sudo install -Dm755 scripts/backup-postgres.sh /var/www/gta-rp-population-graph/current/scripts/backup-postgres.sh
sudo install -Dm755 scripts/backup-uploads.sh /var/www/gta-rp-population-graph/current/scripts/backup-uploads.sh
sudo install -Dm644 ops/systemd/gta-rp-postgres-backup.service /etc/systemd/system/gta-rp-postgres-backup.service
sudo install -Dm644 ops/systemd/gta-rp-postgres-backup.timer /etc/systemd/system/gta-rp-postgres-backup.timer
sudo install -Dm644 ops/systemd/gta-rp-uploads-backup.service /etc/systemd/system/gta-rp-uploads-backup.service
sudo install -Dm644 ops/systemd/gta-rp-uploads-backup.timer /etc/systemd/system/gta-rp-uploads-backup.timer
sudo mkdir -p /var/www/gta-rp-population-graph/shared/backups/postgres/daily
sudo mkdir -p /var/www/gta-rp-population-graph/shared/backups/postgres/weekly
sudo mkdir -p /var/www/gta-rp-population-graph/shared/backups/uploads/weekly
sudo chown -R codex-deploy:codex-deploy /var/www/gta-rp-population-graph/shared/backups
sudo systemctl daemon-reload
sudo systemctl enable --now gta-rp-postgres-backup.timer
sudo systemctl enable --now gta-rp-uploads-backup.timer
```

Verification initiale :

```bash
sudo systemctl start gta-rp-postgres-backup.service
sudo systemctl start gta-rp-uploads-backup.service
sudo systemctl status gta-rp-postgres-backup.timer --no-pager
sudo systemctl status gta-rp-uploads-backup.timer --no-pager
find /var/www/gta-rp-population-graph/shared/backups -maxdepth 3 -type f | sort
```

Verification minimale apres chaque sauvegarde :

- fichier cree non vide
- taille coherente
- log `journalctl` sans erreur
- espace disque restant au-dessus d'un seuil raisonnable

Verification periodique de restauration :

- PostgreSQL : tester au moins une restauration sur base temporaire non
  production
- Uploads : verifier qu'une archive peut etre extraite proprement

Commandes de restauration PostgreSQL vers une base temporaire :

```bash
export PGPASSWORD='mot_de_passe_admin_ou_applicatif'
createdb -h 127.0.0.1 -p 5432 -U postgres gta_rp_population_graph_restore_test
pg_restore \
  --host=127.0.0.1 \
  --port=5432 \
  --username=postgres \
  --dbname=gta_rp_population_graph_restore_test \
  --clean \
  --if-exists \
  /var/www/gta-rp-population-graph/shared/backups/postgres/daily/<backup>.dump
psql -h 127.0.0.1 -p 5432 -U postgres -d gta_rp_population_graph_restore_test -c '\dt'
dropdb -h 127.0.0.1 -p 5432 -U postgres gta_rp_population_graph_restore_test
unset PGPASSWORD
```

Commande de restauration d'une archive uploads vers un dossier de travail :

```bash
mkdir -p /tmp/gta-rp-uploads-restore-test
tar -xzf /var/www/gta-rp-population-graph/shared/backups/uploads/weekly/<backup>.tar.gz -C /tmp/gta-rp-uploads-restore-test
find /tmp/gta-rp-uploads-restore-test -maxdepth 3 -type f | sort
rm -rf /tmp/gta-rp-uploads-restore-test
```

Si aucune cible distante n'est disponible au debut :

- accepter le backup local comme solution transitoire
- documenter explicitement que ce n'est pas une protection suffisante contre la
  perte du VPS
- planifier rapidement une seconde copie hors machine

## Recuperer la derniere sauvegarde en local

Tant qu'aucune cible distante n'est disponible, une copie manuelle vers une
machine locale permet au moins de sortir periodiquement les dernieres archives
du VPS.

Le depot fournit un script dedie :

```bash
scripts/fetch-latest-backups.sh
```

Par defaut, il utilise :

- hote SSH : `65.109.171.143`
- utilisateur SSH : `codex-deploy`
- cle SSH : `.secrets/codex_gta_rp_deploy`
- source serveur : `/var/www/gta-rp-population-graph/shared/backups`
- destination locale : `.backups/server`

La destination `.backups/` est ignoree par Git. Ne jamais commiter les archives
recuperees : elles contiennent les donnees de production.

Recuperer uniquement la base :

```bash
scripts/fetch-latest-backups.sh --postgres
```

Recuperer uniquement les uploads :

```bash
scripts/fetch-latest-backups.sh --uploads
```

Choisir une destination locale hors depot :

```bash
LOCAL_BACKUP_DIR=~/gta-rp-backups scripts/fetch-latest-backups.sh --all
```

Le script ne declenche pas de nouvelle sauvegarde sur le serveur. Il recupere
seulement la derniere archive PostgreSQL journaliere et/ou la derniere archive
uploads hebdomadaire deja presentes sur le VPS.

## Checklist deploiement initial

- [x] Variables de production creees hors Git.
- [x] `SESSION_SECRET` remplace par une valeur forte.
- [x] `SESSION_COOKIE_SECURE=true` en production.
- [x] Callback Google de production declare dans la console Google OAuth.
- [x] Callback Discord de production declare dans le portail Discord Developer.
- [x] Callback Twitch de production declare dans la console Twitch Developer.
- [x] `GOOGLE_CALLBACK_URL`, `DISCORD_CALLBACK_URL` et `TWITCH_CALLBACK_URL`
      pointent vers les URLs publiques HTTPS declarees.
- [x] Enregistrement DNS `A gta-rp.f1prediction.fr -> 65.109.171.143`
      propage.
- [x] Base PostgreSQL dediee creee dans le PostgreSQL Docker/local du VPS ou
      `npm run db:ensure` execute avec succes.
- [x] Backup initial configure.
- [x] `npm run db:migrate` execute.
- [ ] `npm run db:migrate:pending` retourne `[]`.
- [x] Dossier `PHOTO_STORAGE_DIR` cree ou creatable par l'utilisateur backend.
- [x] Service `gta-rp-photo-cleanup.service` configure.
- [x] Timer `gta-rp-photo-cleanup.timer` configure et actif.
- [x] Service `gta-rp-postgres-backup.service` configure.
- [x] Timer `gta-rp-postgres-backup.timer` configure et actif.
- [x] Service `gta-rp-uploads-backup.service` configure.
- [x] Timer `gta-rp-uploads-backup.timer` configure et actif.
- [x] Backend build OK.
- [x] Frontend build OK.
- [x] Bloc Caddy `gta-rp.f1prediction.fr` ajoute sans modifier le bloc du site
      existant.
- [x] `sudo caddy validate --config /etc/caddy/Caddyfile` OK.
- [x] `sudo systemctl reload caddy` execute.
- [x] Process manager configure.
- [x] Firewall verifie.
- [x] Retention durable `journald` configuree.
- [x] `METRICS_TOKEN` fort genere hors Git.
- [x] Stack Prometheus + Grafana lancee sur le VPS.
- [x] Timer `gta-rp-monitoring-textfile.timer` configure et actif.
- [x] Route Caddy `/supervision/*` ajoutee avec `forward_auth`.
- [x] Grafana accessible avec une session administrateur du site.
- [x] Prometheus targets `UP`.
- [x] Ports monitoring bindes localement uniquement.

## Points a completer plus tard

- Configuration Caddy multi-domaines.
- Cible de sauvegarde distante hors VPS, afin de ne pas dependre uniquement du
  stockage local.
- Alerting externe email ou Discord sur les signaux critiques.

## Durcissement SSH minimal

Le VPS de production active desormais `fail2ban` pour `sshd`, en complement de
`ufw`.

Configuration minimale appliquee :

```ini
# /etc/fail2ban/jail.d/sshd.local
[sshd]
enabled = true
port = 22
backend = systemd
banaction = ufw
findtime = 10m
maxretry = 5
bantime = 1h
```

Verification utile :

```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
sudo systemctl status fail2ban
```

Etat reseau actuellement constate sur le VPS :

- `80/tcp` et `443/tcp` ouverts pour Caddy.
- `22/tcp` ouvert pour SSH.
- `5432/tcp` explicitement refuse publiquement.
- `3000/tcp` non utilise et non ouvert.
- `5000/tcp` reste ouvert tant que le site historique `f1prediction.fr` depend
  encore de ce backend Node distinct.

## Promotion du premier administrateur

Une fois le premier compte cree via Google, Discord ou Twitch, il existe en
base avec le role par defaut `user`. La promotion initiale peut se faire
directement en SQL via le role logique, sans hardcoder un UUID.

Verifier d'abord le compte cible :

```sql
SELECT u.id, u.email, u.display_name, r.name AS role_name
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.email = 'ton.email@example.com';
```

Promouvoir ensuite le compte :

```sql
UPDATE users
SET role_id = (
  SELECT id
  FROM roles
  WHERE name = 'administrator'
)
WHERE email = 'ton.email@example.com';
```

Verifier le resultat :

```sql
SELECT u.email, r.name AS role_name
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.email = 'ton.email@example.com';
```

Le backend recharge le role depuis la base a chaque requete authentifiee. Une
simple actualisation de la page suffit donc pour voir le nouveau role.
