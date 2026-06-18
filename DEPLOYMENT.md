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

A confirmer et completer a l'etape 10 :

- VPS Ubuntu a jour.
- Node.js `24.16.0` ou plus recent.
- PostgreSQL accessible depuis le backend.
- Nginx pour le reverse proxy, TLS et les domaines.
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
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `CHANGE_REQUEST_RATE_LIMIT_MAX`

`SESSION_SECRET` doit etre long, aleatoire et different de la valeur d'exemple.

## Creation de la base

Le script suivant cree la base `DB_NAME` si elle n'existe pas encore :

```bash
cd backend
npm run db:ensure
```

Le script se connecte a `DB_MAINTENANCE_NAME`, par defaut `postgres`, avec les
identifiants `DB_USER` et `DB_PASSWORD`. Il valide le nom de base avant de
construire la commande `CREATE DATABASE`.

Deux modes sont possibles :

- En developpement ou sur un VPS simple, `DB_USER` peut avoir temporairement le
  droit `CREATEDB`, puis ce privilege doit etre retire si possible.
- En production durcie, creer la base avec un compte administrateur PostgreSQL
  separe, puis utiliser pour l'application un compte limite a la base cible.

Si le fournisseur PostgreSQL manage ne permet pas `CREATE DATABASE`, creer la
base via son interface d'administration puis lancer directement les migrations.

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

Ne pas lancer `npm run db:seed` en production. Les seeds sont uniquement faits
pour le developpement local.

## Checks avant redemarrage

```bash
cd backend
npm run check
npm test
npm run build
```

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
- [ ] Base PostgreSQL creee ou `npm run db:ensure` execute avec succes.
- [ ] Backup initial configure.
- [ ] `npm run db:migrate` execute.
- [ ] `npm run db:migrate:pending` retourne `[]`.
- [ ] Backend build OK.
- [ ] Frontend build OK.
- [ ] Nginx configure avec TLS.
- [ ] Process manager configure.
- [ ] Firewall verifie.

## Points a completer plus tard

- Commandes exactes PM2 ou systemd.
- Configuration Nginx multi-domaines.
- Procedure TLS Certbot.
- Backup automatise et test de restauration.
- Logs applicatifs et rotation.
- Monitoring minimal et alertes.

## Promotion du premier administrateur

Une fois le premier compte Google connecte avec succes, il existe en base avec
le role par defaut `user`. La promotion initiale peut se faire directement en
SQL via le role logique, sans hardcoder un UUID.

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
