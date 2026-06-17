# Tech Stack

- Node.js attendu: `>=24.16.0`; verifier Node cote WSL/devcontainer avant commandes npm si doute.
- Package manager observe: npm via scripts `package.json`; pas de workspace racine declare.
- Backend: TypeScript strict, Express 5, Sequelize 6, PostgreSQL (`pg`), Umzug, Zod, Helmet, CORS, express-rate-limit, dotenv, tsx.
- Backend tests/outillage: Vitest, Supertest, ESLint, TypeScript 6.
- Backend TS: `module`/`moduleResolution` NodeNext, target ES2022, `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, no unused locals/params.
- Frontend: Vite 8, React 19, React DOM 19, TypeScript 6.
- Frontend tests/outillage: Vitest jsdom, Testing Library, ESLint, React Hooks/Refresh plugins.
- Frontend TS: project references; app config uses Bundler resolution, `jsx: react-jsx`, `strict`, `isolatedModules`, no emit.
- Local DB: Docker Compose service `postgres` image `postgres:16-alpine`, DB `gta_rp_population_graph`, exposed on `5432`.
- Auth cible: Google OAuth + session serveur cookie `HttpOnly`; frontend ne doit pas stocker de jeton sensible.