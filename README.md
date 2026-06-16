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

## Etat actuel

Le socle de l'etape 1 est initialise : backend Express TypeScript et frontend
Vite React TypeScript, avec lint, tests, build et validation d'environnement.

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
npm test
npm run build
```

```bash
cd web-client
npm run lint
npm test
npm run build
```

## Donnees

La source initiale prevue est la page Notion communautaire Flashback Whitelist
V6. Les donnees importees doivent etre considerees comme communautaires et
verifiees avant publication.
