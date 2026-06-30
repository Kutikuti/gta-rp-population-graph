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

A confirmer et completer pendant l'etape 11 :

- VPS Ubuntu a jour.
- Node.js `24.16.0` ou plus recent.
- PostgreSQL accessible depuis le backend via le service Docker/local du VPS.
- Caddy pour le reverse proxy, TLS automatique et les domaines.
- Process manager pour l'API Node.js : PM2 ou service systemd.
- Firewall actif, ports publics limites a SSH, HTTP et HTTPS.
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

`SESSION_SECRET` doit etre long, aleatoire et different de la valeur d'exemple.

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
./run-all-checks.sh
```

La sequence detaillee reste utile si un sous-ensemble doit etre relance :

```bash
cd backend
npm run check
npm test
npm run build
```

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

## Checklist deploiement initial

- [ ] Variables de production creees hors Git.
- [ ] `SESSION_SECRET` remplace par une valeur forte.
- [ ] `SESSION_COOKIE_SECURE=true` en production.
- [ ] Callback Google de production declare dans la console Google OAuth.
- [ ] Callback Discord de production declare dans le portail Discord Developer.
- [ ] Callback Twitch de production declare dans la console Twitch Developer.
- [ ] `GOOGLE_CALLBACK_URL`, `DISCORD_CALLBACK_URL` et `TWITCH_CALLBACK_URL`
      pointent vers les URLs publiques HTTPS declarees.
- [ ] Enregistrement DNS `A gta-rp.f1prediction.fr -> 65.109.171.143`
      propage.
- [ ] Base PostgreSQL dediee creee dans le PostgreSQL Docker/local du VPS ou
      `npm run db:ensure` execute avec succes.
- [ ] Backup initial configure.
- [ ] `npm run db:migrate` execute.
- [ ] `npm run db:migrate:pending` retourne `[]`.
- [ ] Dossier `PHOTO_STORAGE_DIR` cree ou creatable par l'utilisateur backend.
- [ ] Service `gta-rp-photo-cleanup.service` configure.
- [ ] Timer `gta-rp-photo-cleanup.timer` configure et actif.
- [ ] Backend build OK.
- [ ] Frontend build OK.
- [ ] Bloc Caddy `gta-rp.f1prediction.fr` ajoute sans modifier le bloc du site
      existant.
- [ ] `sudo caddy validate --config /etc/caddy/Caddyfile` OK.
- [ ] `sudo systemctl reload caddy` execute.
- [ ] Process manager configure.
- [ ] Firewall verifie.

## Points a completer plus tard

- Commandes exactes PM2 ou systemd.
- Configuration Caddy multi-domaines.
- Verification du TLS automatique Caddy apres propagation DNS.
- Backup automatise et test de restauration.
- Logs applicatifs et rotation.
- Monitoring minimal et alertes.
- Dashboard minimal incluant sante applicative, trafic, stockage et evolution
  des donnees.
- Piste outillage pour le dashboard et la supervision : priorite a une solution
  open source, gratuite et auto-hebergee de type Zabbix, avec comparaison
  possible contre Prometheus + Grafana au moment de l'implementation.

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
