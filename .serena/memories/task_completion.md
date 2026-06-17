# Task Completion

- Toujours signaler les tests/checks lances et ceux non lances avec raison.
- Pour changement backend: lancer selon risque `cd backend && npm run lint`, `cd backend && npm test`, `cd backend && npm run build`.
- Pour changement frontend: lancer selon risque `cd web-client && npm run lint`, `cd web-client && npm test`, `cd web-client && npm run build`.
- Pour changement DB/migrations/seeds: utiliser Postgres local puis `cd backend && npm run db:ensure`, `npm run db:migrate`, `npm run db:seed`; verifier aussi lint/test/build backend.
- Pour changement API publique: couvrir recherche/filtres/validation/erreurs si surface touche `public.ts` ou `public-data.ts`.
- Pour changement securite/auth/moderation/admin: ajouter ou adapter tests de permissions, bannissement, validation payload, rate limit ou historique selon la zone.
- Apres modification substantielle: verifier coherence avec `PLANS.md`; mettre a jour ce fichier si la decision produit/technique a change.
- Mentionner risques residuels, tests manquants, dette/refactor necessaire quand ils existent.
- Ne jamais afficher ni recopier le contenu de `backend/.env`.