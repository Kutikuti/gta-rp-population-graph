# GTA-RP Population Graph

Site web d'annuaire et de graphe pour un serveur GTA-RP.

L'objectif est de permettre aux spectateurs de retrouver facilement les
personnages, leurs informations publiques, leurs streamers et leurs liens RP.

## Objectif MVP

- Explorer les personnages via un graphe interactif.
- Consulter une fiche detaillee pour chaque personnage.
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

Le socle de l'etape 1 est initialise : backend Express TypeScript et frontend
Vite React TypeScript, avec Biome, tests, build et validation d'environnement.

L'etape 2 est terminee : Sequelize est configure, la base PostgreSQL peut
etre creee via `npm run db:ensure`, la migration initiale cree le schema
metier, les seeds produisent un graphe de developpement exploitable et les
checks backend passent. L'etape 3 est demarree avec les premieres routes
publiques de consultation.

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

## Authentification locale

Le socle d'authentification MVP utilise Google OAuth cote backend avec session
serveur et cookie `HttpOnly`.

Flux local actuel :

- Le frontend affiche un lien `Connexion Google` dans l'en-tete.
- Le clic ouvre `/api/auth/google` sur le backend.
- Google renvoie ensuite vers `/api/auth/google/callback`.
- Le frontend relit la session via `/api/auth/session` et affiche le compte
  connecte dans l'en-tete.

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
