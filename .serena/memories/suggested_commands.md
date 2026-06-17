# Suggested Commands

- Installer backend: `cd backend && npm install`.
- Dev backend: `cd backend && npm run dev`.
- Checks backend: `cd backend && npm run lint`, `cd backend && npm test`, `cd backend && npm run build`.
- DB locale: `docker compose up -d postgres` depuis la racine.
- DB backend: `cd backend && npm run db:ensure`, `npm run db:migrate`, `npm run db:seed`, `npm run db:migrate:pending`, `npm run db:migrate:executed`.
- Reset DB dev uniquement: `cd backend && npm run db:reset`.
- Installer frontend: `cd web-client && npm install`.
- Dev frontend: `cd web-client && npm run dev`.
- Checks frontend: `cd web-client && npm run lint`, `cd web-client && npm test`, `cd web-client && npm run build`.
- Frontend preview build: `cd web-client && npm run preview`.
- Depuis devcontainer vers Postgres Docker host: utiliser `DB_HOST=host.docker.internal`; depuis WSL hors devcontainer: `DB_HOST=localhost`.
- Controle memoires Serena: `serena memories check` depuis la racine projet.