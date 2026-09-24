# Mise en production GTA-RP

Ce document conserve les exigences propres à l'application : configuration,
build, migrations et contrôles avant livraison. `platform-ops` est la source de
référence pour les services, sauvegardes, accès et les
procédures d'administration. Consulter son [catalogue](https://github.com/Kutikuti/platform-ops/blob/main/OPS_CATALOG.md), ses [runbooks de changement](https://github.com/Kutikuti/platform-ops/blob/main/CHANGE_RUNBOOKS.md) et ses [consignes d'incident et de rollback](https://github.com/Kutikuti/platform-ops/blob/main/INCIDENT_AND_ROLLBACK.md) avant toute opération plateforme.

## Exigences de livraison applicative

- Aucun secret ne doit être commité ou copié dans une archive de release.
- Les dépendances sont installées de façon reproductible avec `npm ci`.
- Les builds backend et frontend doivent réussir avant livraison.
- Vérifier les migrations en attente avant de démarrer la nouvelle version.
- Une sauvegarde vérifiée est requise avant toute migration en production ; sa
  création et sa restauration suivent le runbook central.
- Les migrations sont exécutées explicitement avec l'identité de migration,
  distincte de l'identité runtime.
- Les seeds de développement ne sont jamais lancés en production.
- Le retour au code précédent suppose que le schéma reste compatible. Une
  migration destructive nécessite une procédure dédiée validée par
  `platform-ops`.

## Configuration backend

En production, `NODE_ENV=production` active les validations strictes. La
configuration réelle est fournie hors Git par la plateforme ; ce dépôt ne
contient que les noms de variables attendus par l'application :

- `NODE_ENV`, `PORT`, `WEB_CLIENT_URL`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_SSL`,
  `DB_MAINTENANCE_NAME`
- `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`,
  `SESSION_COOKIE_SAME_SITE`, `SESSION_TTL_HOURS`,
  `SESSION_CLEANUP_INTERVAL_MINUTES`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_CALLBACK_URL`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`,
  `CHANGE_REQUEST_RATE_LIMIT_MAX`, `PHOTO_UPLOAD_MAX_BYTES`,
  `PHOTO_UPLOAD_RATE_LIMIT_MAX`, `PHOTO_STORAGE_DIR`,
  `PHOTO_DRAFT_MAX_AGE_HOURS`, `METRICS_TOKEN`

`SESSION_SECRET` et `METRICS_TOKEN` doivent être aléatoires, longs, distincts
des exemples et stockés hors Git. Ne jamais inscrire leur valeur dans ce
document, un rapport de livraison ou un journal.

Les fournisseurs OAuth doivent autoriser les callbacks HTTPS configurés pour
l'environnement. Les trois variables `*_CALLBACK_URL` doivent correspondre
exactement aux valeurs déclarées chez leur fournisseur. Les domaines, reverse
proxy et services partagés relèvent des runbooks centraux.

Les sessions de production sont persistées dans PostgreSQL, avec expiration
serveur et nettoyage périodique. Derrière le proxy, l'application doit
conserver la configuration `trust proxy` nécessaire à l'émission des cookies
`Secure` pour OAuth.

## Photos et fichiers

En production, le stockage des photos doit rester hors du répertoire statique
du frontend. L'API n'expose que les photos validées sous
`/uploads/characters`; les brouillons restent privés. Les fichiers sont
validés, décodés puis réencodés côté serveur. Les photos publiques ne doivent
pas être rendues privées au point de casser leur diffusion par Caddy.

## Création de base et migrations

Le script applicatif crée la base si l'identité configurée possède les droits
nécessaires :

```bash
cd backend
npm run db:ensure
```

En production durcie, la base et ses rôles sont préparés par l'exploitant selon
le catalogue et le runbook `platform-ops`; l'identité runtime n'a pas de droit
de création de base. Les rôles et secrets PostgreSQL ne sont pas gérés dans ce
dépôt.

Contrôler les migrations avant et après leur application :

```bash
cd backend
npm run db:migrate:pending
npm run db:migrate
npm run db:migrate:executed
npm run db:migrate:pending
```

Le dernier `pending` doit être vide. La migration initiale crée notamment
`user_sessions` pour le store de session persistant et `public_slug` pour les
URLs publiques lisibles. Ne pas exécuter `npm run db:seed` en production.

La configuration de migration est injectée séparément de la configuration
runtime. Le mécanisme d'installation hors Git et le lien attendu en staging
sont documentés dans le runbook central ; ne pas transférer un fichier `.env`
depuis un poste de travail.

## Vérifications locales

La séquence complète de contrôles locaux est :

```bash
./scripts/run-all-checks.sh
```

Pour isoler les contrôles applicatifs :

```bash
cd backend
npm run check
npm test
npm run build
```

Les tests d'intégration PostgreSQL créent et suppriment leur propre base
éphémère. Ils exigent une instance joignable via `backend/.env` et refusent les
noms de base qui ne correspondent pas au préfixe de test prévu.

## Exploitation de la plateforme

Les procédures d'administration, contrôles de production, sauvegardes,
services et état effectif des environnements sont maintenus dans
[`platform-ops`](https://github.com/Kutikuti/platform-ops), notamment son
[catalogue](https://github.com/Kutikuti/platform-ops/blob/main/OPS_CATALOG.md).
Ce dépôt ne dépend pas d'un chemin local précis pour consulter ces documents.

Deux scripts restent temporairement dans ce dépôt pour des raisons de
compatibilité : le script de sauvegarde des uploads est encore référencé par
le service plateforme correspondant ; le script de packaging suppose que le
dépôt GTA est sa racine Git. Le catalogue central suit leur migration. Les
fragments de monitoring locaux restent propres à l'environnement de
développement et ne doivent pas être interprétés comme la configuration d'une
plateforme active.
