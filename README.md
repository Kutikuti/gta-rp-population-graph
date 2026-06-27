# GTA-RP Population Graph

Site web d'annuaire et de graphe pour un serveur GTA-RP.

L'objectif est de permettre aux spectateurs de retrouver facilement les
personnages, leurs informations publiques, leurs streamers et leurs liens RP.

## Objectif MVP

- Explorer les personnages via un graphe interactif.
- Consulter une fiche detaillee pour chaque personnage.
- Partager un lien direct vers une fiche precise avec recentrage du graphe.
- Rechercher et filtrer par nom, surnom, streamer, matricule, tag ou statut.
- Proposer des modifications via un systeme de moderation.
- Garder un historique des changements valides.

## Stack cible

- Backend : Express, TypeScript, Sequelize, PostgreSQL.
- Frontend : Vite, React, TypeScript.
- Graphe : Cytoscape.js.
- Qualite code : Biome pour lint et formatage, TypeScript pour le type-check.
- Authentification : Google OAuth.
- Production cible : VPS Ubuntu avec Nginx.

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

## Etat actuel

Le socle backend/frontend, la base PostgreSQL, les routes publiques de
consultation, Google OAuth, la contribution moderee, la moderation, le profil
utilisateur et les photos securisees sont en place.

La fiche publique et les formulaires de modification supportent maintenant :

- un bloc medias distinct avec streamer existant ou nouveau streamer ;
- les liens publics Twitch, Kick, YouTube, Instagram et TikTok ;
- l'edition des parentes RP ;
- un lien partageable vers une fiche publique via un slug lisible
  `prenom-nom`, avec suffixe numerote si un doublon existe, et mis a jour si le
  nom public du personnage change.

Le workflow d'import Notion est egalement operationnel cote administration :

- scraping batch par batch sans publication automatique ;
- revue fiche par fiche avant application ;
- import manuel de la photo Notion seulement apres application de la fiche ;
- liste des fiches importees triable de maniere stable par nom, avec recherche
  et suivi `a faire` / `appliquee`.

## Lancement local

Version Node.js attendue : `24.16.0` ou plus recente. Les fichiers `.nvmrc` et
`.node-version` sont fournis pour les gestionnaires de versions Node.js.

Installation et demarrage backend :

```bash
cd backend
npm install
npm run dev
```

Installation et demarrage frontend :

```bash
cd web-client
npm install
npm run dev
```

Checks utiles :

```bash
cd backend
npm run lint
npm run check
npm run format
npm test
npm run build
```

```bash
cd web-client
npm run lint
npm run check
npm run format
npm test
npm run build
```

Base PostgreSQL de developpement :

```bash
docker compose up -d postgres
```

Depuis le devcontainer, utiliser `DB_HOST=host.docker.internal` dans
`backend/.env` si PostgreSQL tourne dans Docker sur le host. Depuis WSL hors
devcontainer, `DB_HOST=localhost` suffit avec le port `5432` expose.

Commandes backend pour l'etape 2 :

```bash
cd backend
npm run db:ensure
npm run db:migrate
npm run db:seed
npm run db:migrate:executed
```

## Commandes disponibles

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
| `npm run db:reset` | Rejoue toutes les migrations puis les seeds. |
| `npm run notion:scrape-report` | Scrape une URL Notion publique puis enregistre un rapport d'import. |
| `npm run notion:import-report` | Importe un fichier JSON Notion prepare puis enregistre un rapport. |
| `npm run notion:preview` | Affiche une previsualisation terminale d'un batch Notion importe. |
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
normal consiste a scraper l'URL publique, enregistrer un batch d'import, puis
controler le rapport et la previsualisation avant toute publication future.

Scraper directement la page Notion publique :

```bash
cd backend
npm run notion:scrape-report -- "https://www.notion.so/Flashback-Whitelist-V6-34407fc32f6c80968f3bdedadec5253c"
```

Afficher le meme rapport en JSON complet :

```bash
cd backend
npm run notion:scrape-report -- "https://www.notion.so/Flashback-Whitelist-V6-34407fc32f6c80968f3bdedadec5253c" --json
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

Notes importantes :

- Le scrape Notion ecrit uniquement des donnees de travail dans les tables
  `notion_import_batches` et `notion_import_entries`.
- Ces imports ne publient pas encore les fiches dans les donnees publiques.
- Les donnees Notion restent communautaires et doivent etre verifiees avant
  publication.
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

Le socle d'authentification MVP utilise Google OAuth cote backend avec session
serveur et cookie `HttpOnly`.

Flux local actuel :

- Le frontend affiche un lien `Connexion Google` dans l'en-tete.
- Le clic ouvre `/api/auth/google` sur le backend.
- Google renvoie ensuite vers `/api/auth/google/callback`.
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
- En production, `SESSION_COOKIE_SECURE=true` est requis. En developpement
  local, le backend neutralise ce flag hors production pour permettre les
  tests HTTP locaux.

Verification rapide :

- Se connecter avec le bouton `Connexion Google`.
- Verifier que le nom, le role et l'avatar s'affichent.
- Recharger la page pour confirmer que la session persiste.
- Utiliser `Deconnexion` pour verifier la destruction de session.

La procedure de promotion du premier administrateur est documentee dans
[DEPLOYMENT.md](DEPLOYMENT.md).

## Donnees

La source initiale prevue est la page Notion communautaire Flashback Whitelist
V6. Les donnees importees doivent etre considerees comme communautaires et
verifiees avant publication.
