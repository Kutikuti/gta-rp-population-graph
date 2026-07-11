# GTA-RP Population Graph

Site web d'annuaire et de graphe pour un serveur GTA-RP.

L'objectif est de permettre aux spectateurs de retrouver facilement les
personnages, leurs informations publiques, leurs streamers et leurs liens RP.

## Fonctionnalites principales

- Explorer les personnages via un graphe interactif.
- Consulter une fiche detaillee pour chaque personnage.
- Partager un lien direct vers une fiche precise avec recentrage du graphe.
- Rechercher et filtrer par nom, surnom, telephone, entreprise, streamer, tag,
  statut vital ou live Twitch.
- Proposer des modifications via un systeme de moderation.
- Garder un historique des changements valides.
- Administrer les utilisateurs, tags, imports Notion et demandes RGPD.

## Stack

- Backend : Express, TypeScript, Sequelize, PostgreSQL.
- Frontend : Vite, React, TypeScript.
- Graphe : Cytoscape.js.
- Qualite code : Biome pour lint et formatage, TypeScript pour le type-check.
- Authentification : Google OAuth, Discord OAuth et Twitch OAuth.
- Production : VPS Ubuntu avec Caddy, sur le sous-domaine
  `gta-rp.f1prediction.fr`.

## Direction produit

L'application doit rester moderne, sobre et lisible.

La direction visuelle initiale est un dark mode avec fond noir, accents bleu
"terminal", graphe bleu et panneaux lateraux bleu sombre.

La securite du serveur est la priorite numero 1 du developpement.

## Documentation projet

- [AGENTS.md](AGENTS.md) : consignes de developpement, architecture, style,
  securite et workflow.
- [PLANS.md](PLANS.md) : plan MVP, decisions produit/techniques et feuille de
  route de developpement.
- [DEPLOYMENT.md](DEPLOYMENT.md) : runbook vivant de mise en production.
- [PRIVACY.md](PRIVACY.md) : base documentaire RGPD, cookies et registre
  simplifie des traitements.

## Confidentialité et cookies

Le projet utilise actuellement :

- un cookie de session serveur strictement necessaire a l'authentification ;
- du `localStorage` pour les preferences d'interface du graphe ;
- une mesure serveur technique sans traceur client tiers.

Dans ce perimetre, aucun bandeau de consentement cookies n'est prevu pour
l'instant. Les regles de conservation, la cartographie des traitements et la
procedure minimale RGPD sont documentees dans [PRIVACY.md](PRIVACY.md).

## Etat actuel

Les etapes 1 a 13 du plan sont terminees. Le backend/frontend, PostgreSQL, les
routes publiques, le multi-SSO Google/Discord/Twitch, la contribution moderee,
la moderation, l'administration, le profil utilisateur, la conformite RGPD
minimale et les photos securisees sont en place.

La fiche publique et les formulaires de modification supportent maintenant :

- un bloc medias distinct avec streamer existant ou nouveau streamer ;
- plusieurs numeros de telephone ;
- les liens publics Twitch, Kick, YouTube, Instagram, TikTok et Discord, portes
  uniquement par le streamer rattache ;
- l'edition des parentes RP ;
- un lien partageable vers une fiche publique via un slug lisible
  `prenom-nom`, avec suffixe numerote si un doublon existe, et mis a jour si le
  nom public du personnage change.

Le graphe propose des preferences locales, le masquage des personnages decedes,
le choix des relations visibles, un filtre Twitch live et les dispositions
`Entreprise`, `Famille`, `Groupe` et `Libre`.

Le workflow d'import Notion est egalement operationnel cote administration :

- scraping batch par batch sans publication automatique ;
- revue fiche par fiche avant application ;
- import manuel de la photo Notion seulement apres application de la fiche ;
- liste des fiches importees triable de maniere stable par nom, avec recherche
  et suivi `a faire` / `appliquee`.

La production de travail s'appuie maintenant sur le sous-domaine
`gta-rp.f1prediction.fr`, avec backend `systemd`, frontend statique derriere
Caddy, base PostgreSQL locale via Docker, sauvegardes automatisees et
durcissement minimal du VPS (`ufw`, `fail2ban`, nettoyage photo, backups).

## Lancement local

Chaine d'outillage de reference : Node.js `24.18.0`, npm `12.0.0` et
TypeScript `7.0.2`. Les fichiers `.nvmrc` et `.node-version` sont fournis pour
les gestionnaires de versions Node.js. Le devcontainer installe aussi
l'extension officielle TypeScript 7 et utilise `tsgo` pour les diagnostics de
l'editeur.

Installation et demarrage backend :

```bash
cd backend
npm ci
npm run dev
```

Installation et demarrage frontend :

```bash
cd web-client
npm ci
npm run dev
```

Checks utiles :

```bash
./scripts/run-all-checks.sh
```

ou detail par application :

```bash
cd backend
npm run lint
npm run check
npm run format
npm test
npm run test:coverage
npm run test:integration
npm run build
```

```bash
cd web-client
npm run lint
npm run check
npm run format
npm test
npm run test:coverage
npm run build
```

Base PostgreSQL de developpement :

```bash
docker compose up -d postgres
```

Depuis le devcontainer, utiliser `DB_HOST=host.docker.internal` dans
`backend/.env` si PostgreSQL tourne dans Docker sur le host. Depuis WSL hors
devcontainer, `DB_HOST=localhost` suffit avec le port `5432` expose.

La validation globale lance aussi les tests d'integration PostgreSQL. Ceux-ci
creent une base ephemere au nom strictement reserve aux tests, appliquent puis
annulent la migration initiale, et suppriment cette base a la fin du test.
PostgreSQL doit donc etre joignable avec les identifiants de `backend/.env`.

Commandes de base de donnees :

```bash
cd backend
npm run db:ensure
npm run db:migrate
npm run db:seed
npm run db:migrate:executed
```

## Commandes disponibles

### Racine du projet

| Commande | Usage |
| --- | --- |
| `./scripts/run-all-checks.sh` | Validation complete backend/frontend. |

### Backend

Toutes les commandes backend se lancent depuis `backend/`.

```bash
cd backend
```

| Commande | Usage |
| --- | --- |
| `npm run dev` | Demarre l'API Express en mode watch. |
| `npm run build` | Compile le backend TypeScript dans `dist/`. |
| `npm run start` | Lance le backend compile depuis `dist/index.js`. |
| `npm run lint` | Lance Biome en mode lint. |
| `npm run check` | Lance Biome en mode check complet. |
| `npm run format` | Formate les fichiers backend avec Biome. |
| `npm test` | Lance tous les tests backend avec Vitest. |
| `npm run test:watch` | Lance Vitest en mode watch. |
| `npm run db:ensure` | Cree la base de developpement si elle n'existe pas. |
| `npm run db:migrate` | Applique les migrations en attente. |
| `npm run db:migrate:undo` | Annule la derniere migration appliquee. |
| `npm run db:migrate:pending` | Liste les migrations en attente. |
| `npm run db:migrate:executed` | Liste les migrations deja appliquees. |
| `npm run db:seed` | Insere les donnees de seed. |
| `npm run db:reset` | Rejoue toutes les migrations sans inserer les seeds. |
| `npm run db:reset:seed` | Reset complet avec seeds. |
| `npm run notion:scrape-report` | Scrape Notion et cree un rapport. |
| `npm run notion:import-report` | Importe un JSON de travail. |
| `npm run notion:preview` | Previsualise un batch importe. |
| `npm run notion:sync-all` | Applique la source Notion complete. |
| `npm run photo:cleanup` | Nettoie les brouillons de photos expires. |

Exemples utiles :

```bash
cd backend
npm test
npm run check
npm run build
```

```bash
cd backend
npm run db:ensure
npm run db:migrate
npm run db:seed
```

### Import Notion

La source initiale est la page publique Notion Flashback Whitelist V6. Le flux
controle consiste a scraper l'URL publique, enregistrer un batch d'import, puis
controler le rapport et la previsualisation avant application dans les donnees
publiques.

Scraper la page Notion publique par defaut :

```bash
cd backend
npm run notion:scrape-report
```

Une autre URL peut etre passee explicitement apres `--`. Afficher le rapport en
JSON complet :

```bash
cd backend
npm run notion:scrape-report -- --json
```

Importer un fichier JSON prepare, si un export de travail existe :

```bash
cd backend
npm run notion:import-report -- ./data/notion-import.json
```

Importer ce fichier avec une sortie JSON :

```bash
cd backend
npm run notion:import-report -- ./data/notion-import.json --json
```

Previsualiser le dernier batch importe dans le terminal :

```bash
cd backend
npm run notion:preview
```

Previsualiser un batch precis :

```bash
cd backend
npm run notion:preview -- <batch-id>
```

Limiter le nombre de lignes affichees :

```bash
cd backend
npm run notion:preview -- --limit=50
```

Previsualiser un batch precis en JSON :

```bash
cd backend
npm run notion:preview -- <batch-id> --json
```

Lancer la synchronisation automatique complete sur la source par defaut :

```bash
cd backend
npm run notion:sync-all
```

Cette commande applique les fiches et tente d'importer les photos. Elle est
reservee a une base que l'on souhaite effectivement alimenter ; pour une revue
humaine fiche par fiche, utiliser le scrape puis l'interface d'administration.

Notes importantes :

- Le scrape Notion ecrit uniquement des donnees de travail dans les tables
  `notion_import_batches` et `notion_import_entries`.
- Le scrape seul ne publie aucune fiche. L'application se fait ensuite depuis
  l'administration ou via `notion:sync-all`.
- Les donnees Notion restent communautaires : conserver leur statut de
  verification et ne pas presenter une valeur incertaine comme certaine, meme
  apres application.
- Il est possible de relancer le scrape plusieurs fois : les pages sont classees
  en `new`, `updated`, `unchanged`, `missing` ou `failed`.
- Dans l'interface d'administration, les fiches importees peuvent ensuite etre
  triees par nom, recherchees et filtrees entre `Toutes`, `Non appliquees` et
  `Appliquees` pour suivre l'avancement.
- Les liens sociaux recuperes depuis Notion doivent conserver l'URL cible
  reelle lorsqu'un texte de lien est mis en forme dans la page source.
- Les relations vers d'autres fiches Notion ne doivent pas bloquer
  l'application d'une fiche si la fiche cible n'a pas encore ete appliquee ;
  elles sont completees progressivement lors des applications suivantes, en
  evitant les doublons symetriques.

### Frontend

Toutes les commandes frontend se lancent depuis `web-client/`.

```bash
cd web-client
```

| Commande | Usage |
| --- | --- |
| `npm run dev` | Demarre Vite en local avec `--host 0.0.0.0`. |
| `npm run build` | Type-check puis compile le frontend de production. |
| `npm run preview` | Sert le build Vite localement. |
| `npm run lint` | Lance Biome en mode lint. |
| `npm run check` | Lance Biome en mode check complet. |
| `npm run format` | Formate les fichiers frontend avec Biome. |
| `npm test` | Lance tous les tests frontend avec Vitest. |
| `npm run test:watch` | Lance Vitest en mode watch. |

Exemples utiles :

```bash
cd web-client
npm run dev
```

```bash
cd web-client
npm test
npm run check
npm run build
```

## Authentification locale

Le socle d'authentification MVP utilise Google OAuth, Discord OAuth et Twitch
OAuth cote backend avec session serveur et cookie `HttpOnly`.

Flux local actuel :

- Le frontend affiche un bouton `Connexion` dans l'en-tete, qui ouvre une
  popup de choix Google, Discord ou Twitch.
- Le clic sur Google ouvre `/api/auth/google` sur le backend.
- Google renvoie ensuite vers `/api/auth/google/callback`.
- Le clic sur Discord ouvre `/api/auth/discord` sur le backend.
- Discord renvoie ensuite vers `/api/auth/discord/callback`.
- Le clic sur Twitch ouvre `/api/auth/twitch` sur le backend.
- Twitch renvoie ensuite vers `/api/auth/twitch/callback`.
- Les integrations Discord et Twitch ont ete validees en local sur des comptes
  existants : rattachement depuis le profil et connexion via un compte Twitch
  deja lie fonctionnent.
- Depuis le profil, un compte connecte peut rattacher Google, Discord ou Twitch
  via `/api/auth/google/link`, `/api/auth/discord/link` et
  `/api/auth/twitch/link`.
- Le frontend relit la session via `/api/auth/session` et affiche le compte
  connecte dans l'en-tete.
- Hors environnement de test, la session serveur est maintenant stockee en
  PostgreSQL : un redemarrage du backend ne doit donc plus deconnecter
  l'utilisateur tant que le cookie navigateur reste present et que la migration
  de session a bien ete appliquee.

Points utiles en local :

- Le backend doit tourner sur `http://localhost:4000`.
- Le frontend doit tourner sur `http://localhost:5173`.
- `GOOGLE_CALLBACK_URL` doit pointer vers
  `http://localhost:4000/api/auth/google/callback`.
- L'application Google OAuth doit autoriser cette URL de callback.
- Pour Discord, configurer ensemble `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET` et `DISCORD_CALLBACK_URL`, avec
  `DISCORD_CALLBACK_URL=http://localhost:4000/api/auth/discord/callback` en
  local.
- L'application Discord doit autoriser cette URL dans ses redirects OAuth2.
- Pour Twitch, configurer ensemble `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
  et `TWITCH_CALLBACK_URL`, avec
  `TWITCH_CALLBACK_URL=http://localhost:4000/api/auth/twitch/callback` en
  local.
- L'application Twitch doit autoriser cette URL dans ses redirects OAuth.
- En production sur le VPS actuel, ajouter aussi les URLs de callback publiques
  dans Google, Discord et Twitch :
  `https://gta-rp.f1prediction.fr/api/auth/google/callback`,
  `https://gta-rp.f1prediction.fr/api/auth/discord/callback` et
  `https://gta-rp.f1prediction.fr/api/auth/twitch/callback`.
- En production, `SESSION_COOKIE_SECURE=true` est requis. En developpement
  local, le backend neutralise ce flag hors production pour permettre les
  tests HTTP locaux.

Verification rapide :

- Se connecter avec Google, puis tester une connexion initiale Discord ou
  Twitch dans un navigateur ou profil separe.
- Ouvrir le profil et verifier que `Lier Discord` et `Lier Twitch` rattachent
  bien les comptes configures.
- Verifier la dissociation d'un compte lie quand au moins deux moyens de
  connexion existent, puis verifier que le dernier moyen de connexion reste
  bloque.
- Tester la creation d'un nouveau compte utilisateur depuis Discord puis depuis
  Twitch, dans un navigateur ou profil separe.
- Verifier que le nom, le role et l'avatar s'affichent.
- Recharger la page pour confirmer que la session persiste.
- Utiliser `Deconnexion` pour verifier la destruction de session.

Sur une base sans utilisateur reel, le premier compte cree hors seeds recoit
automatiquement le role administrateur. La procedure de verification et de
recuperation est documentee dans [DEPLOYMENT.md](DEPLOYMENT.md).

## Donnees

La source initiale est la page Notion communautaire Flashback Whitelist V6. Les
donnees importees restent communautaires et doivent etre verifiees avant ou
apres application selon le niveau de confiance du champ.
