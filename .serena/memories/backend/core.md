# Backend Core

- Dossier: `backend/`; API Express TypeScript en modules ESM.
- Entree applicative: `src/index.ts`; construction app dans `src/app.ts` via `createApp`.
- Securite socle: Helmet, CORS explicite via `WEB_CLIENT_URL`, rate limit global, gestion centralisee des erreurs.
- Configuration env: `src/config/env.ts` valide les variables avec Zod; ne pas lire/versionner de secrets depuis `backend/.env`; utiliser `backend/.env.example` comme reference.
- DB: Sequelize + PostgreSQL; connexion/migrations/seeds sous `src/db/`; `docker-compose.yml` fournit Postgres 16-alpine local.
- Modeles principaux centralises dans `src/db/models/index.ts`: Character, Streamer, Tag, CharacterRelationship, User, Role, Ban, ChangeRequest, ChangeHistory, CharacterTag.
- Valeurs controlees: migration initiale privilegie colonnes texte + contraintes CHECK plutot que ENUM PostgreSQL natifs.
- Routes publiques actuelles dans `src/routes/public.ts`: `GET /api/characters`, `GET /api/characters/:id`, `GET /api/graph`, `GET /api/history`, `GET /api/tags`.
- Service public actuel: `src/services/public-data.ts`, classe `SequelizePublicDataService`; construit listes, details, tags, historique et graphe Cytoscape-compatible.
- Toutes les routes de modification futures doivent verifier explicitement authentification, role, bannissement et payload; ne jamais faire confiance au frontend, meme moderateur/admin.
- Tests backend actuels sous `src/test/`: health, models, public routes, setup.