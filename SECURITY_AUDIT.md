# Audit de sécurité — étape 17

Mise à jour documentaire : 2026-09-24. La dernière revue applicative date du
2026-09-09. Les opérations VPS et leur état effectif sont suivis dans l'audit central
[`platform-ops/SECURITY_AUDIT.md`](https://github.com/Kutikuti/platform-ops/blob/main/SECURITY_AUDIT.md).

## Décision actuelle

**Audit applicatif encore ouvert.** Les tests couvrent les corrections OAuth,
les autorisations, la sonde SQL de santé et les protections des imports/uploads.
La recette navigateur complète des rôles et la revue complémentaire des
erreurs/logs restent à effectuer. Cette revue ne garantit pas l'absence de
faille.

## Référence pour l'exploitation VPS

`platform-ops` est la source de référence pour les helpers, unités, scripts,
accès et procédures d'administration VPS. Les copies GTA redondantes retirées
du présent dépôt sont cataloguées dans
[`OPS_CATALOG.md`](https://github.com/Kutikuti/platform-ops/blob/main/OPS_CATALOG.md).
L'audit de sécurité plateforme est dans
[`platform-ops/SECURITY_AUDIT.md`](https://github.com/Kutikuti/platform-ops/blob/main/SECURITY_AUDIT.md).
Ce document reste dédié au code applicatif GTA ; les fichiers de monitoring
locaux conservés sont des fragments non autorisés pour l'administration de la
stack active.

## Périmètre et frontières de confiance

Le navigateur et toutes les données communautaires sont non fiables. L'API
valide les entrées et les droits ; PostgreSQL conserve identités, demandes et
historique. Les photos passent par décodage/réencodage avant exposition. Notion
et les fournisseurs OAuth sont des services externes. Les propriétés du VPS,
du proxy et de la supervision sont décrites dans l'audit central.

Inventaire condensé des routes (préfixe `/api`) :

| Surface | Méthodes et routes | Autorisation / données |
| --- | --- | --- |
| Publique | GET `/health`, `/characters`, `/characters/directory`, `/characters/matches`, `/characters/:id`, `/graph`, `/tags`, `/streamers`, `/history` | Lecture anonyme ; données RP et noms publics |
| Authentification | GET `/auth/session`, `/auth/{google,discord,twitch}`, leurs `/callback` et `/link` ; POST `/auth/logout` | Session ; liaison réservée au compte connecté, callback lié à l'état OAuth |
| Profil | GET `/profile`, `/profile/personal-data` ; PATCH `/profile/display-name` ; DELETE `/profile/identities/:provider` | Compte courant ; données personnelles et identités SSO |
| Contributions | GET `/contributions/session`, `/contributions/change-requests` ; POST `/contributions/change-requests`, `/contributions/change-requests/character-creations`, `/contributions/characters/:id/photo-drafts` | Utilisateur authentifié non banni ; demandes et brouillons |
| Modération | GET `/moderation/session`, `/moderation/completeness`, `/moderation/change-requests`, `/moderation/change-requests/:id` ; POST leurs `/approve`, `/reject` ; POST `/moderation/characters` ; PATCH `/moderation/characters/:id` | Modérateur ou administrateur ; publication et historique |
| Administration | GET `/admin/session`, `/admin/dashboard`, `/admin/completeness`, `/admin/notion-imports`, `/admin/notion-imports/:id`, `/admin/users/:id/personal-data` | Administrateur ; utilisateurs, tags, journaux, imports, exports |
| Écritures admin | POST `/admin/tags` ; PATCH/DELETE `/admin/tags/:id` ; PATCH `/admin/users/:id/role` ; POST/DELETE `/admin/users/:id/ban` ; DELETE `/admin/users/:id/{sessions,personal-data}`, `/admin/users/:id/identities/:provider` ; POST `/admin/notion-imports/:id/entries/:pageId/{apply,import-photo}` | Administrateur ; modifications journalisées |
| Supervision | GET `/supervision/authorize`, `/internal/metrics` | Administrateur pour Grafana ; token dédié pour les métriques |
| Fichiers | GET/HEAD `/uploads/characters/*` hors préfixe API | Photos validées publiques ; brouillons non servis |

La matrice de refus exécutable est dans
`backend/src/test/authorization-routes.test.ts` : 34 endpoints protégés,
visiteur, banni après connexion, utilisateur et modérateur selon les droits.
Les suites de routes existantes vérifient les chemins autorisés, dont admin.
Les tests utilisent des identifiants modifiés et vérifient le refus avant la
validation des charges utiles ou l'accès à la persistance.

## Constats et corrections

Le tableau suit les constats applicatifs et les protections implémentées dans
le code. L'état et les preuves d'exploitation VPS ne sont pas dupliqués ici ;
ils sont consignés dans l'audit central `platform-ops`.

| ID | Gravité | Preuve / effet | Traitement local et dernier état de production documenté |
| --- | --- | --- | --- |
| AUTH-01 | Critique | Une identité non liée ayant le même email déclenchait une session sur le compte existant, y compris administrateur. L'ancien test masquait le problème en simulant un compte introuvable. | Refus `email_in_use` avant toute récupération de session. Test reproduit rouge avant correction, vert après ; reproduction PostgreSQL. Déployé le 2026-09-09. |
| AUTH-02 | Élevée | Les transactions seules ne sérialisaient pas le premier administrateur, les dissociations ou la suppression du dernier administrateur. | Verrou transactionnel PostgreSQL commun ; tests concurrents réels. Les administrateurs bannis ne comptent plus comme secours ; bannissement du dernier admin refusé. Déployé le 2026-09-09. |
| PHOTO-01 | Élevée | `fetch` suivait les redirections avant de vérifier leur destination. | Vérification de chaque saut avant accès réseau, trois redirections maximum, HTTPS/ports/hôtes bornés, délai global 15 s, annulation des corps trop grands. Tests de destinations internes et de boucles. Déployé le 2026-09-09. |
| WEB-01 | Moyenne | CORS ne constitue pas à lui seul une autorisation d'écriture ; les sous-domaines partagent la notion de site navigateur. | Contrôle exact de l'Origin pour les écritures, défense Fetch Metadata, compatibilité clients non navigateur sans Origin ; tests avec session authentifiée. Déployé le 2026-09-09. |
| AUTH-03 | Moyenne | État de connexion non rattaché explicitement au fournisseur et sans expiration courte. | Fournisseur lié à l'état, expiration 10 min, nettoyage, tests de confusion et d'expiration. Délais OAuth 10 s par requête, redirections réseau refusées. Déployé le 2026-09-09. |
| PRIV-01 | Faible | Absence d'instruction explicite de non-stockage des réponses privées. | `Cache-Control: no-store` sur les espaces authentifiés. Déployé le 2026-09-09. |

## Vérifications effectuées

- Revue statique applicative non intrusive : aucune opération de production
  n'a été effectuée. Les scripts d'administration, services et contrôles VPS
  sont suivis dans l'audit central `platform-ops`.
- Healthcheck de promotion renforcé : `GET /api/health` exécute une lecture
  Sequelize `SELECT 1` bornée à une seconde. Le contrat de succès reste
  inchangé; une erreur ou un délai PostgreSQL répondent seulement
  `503 {"status":"unavailable"}`. Une seule sonde SQL est admise à la fois :
  les requêtes HTTP concurrentes reçoivent `503` sans déclencher de nouveau
  `SELECT 1` bloqué. Les tests couvrent succès, échec, délai et concurrence,
  sans connexion réelle à PostgreSQL.
- Autorisations : les routes d'écriture de contribution exigent une session ;
  les routes de modération exigent `moderator` ou `administrator` ; le routeur
  d'administration applique `administrator` avant toutes ses routes. Le
  chargement de session invalide également une session d'utilisateur banni.
- Sessions et OAuth : cookie `HttpOnly`, `Secure` imposé en production,
  `SameSite` configurable (valeur de référence `lax`), stockage persistant avec
  expiration serveur et suppression à la lecture. La session est régénérée au
  démarrage et à la réussite d'une connexion OAuth ; l'état est lié au
  fournisseur, à l'intention et à une fenêtre de dix minutes.
- Uploads et import distant : les uploads acceptent uniquement JPEG/PNG/WebP,
  sont limités, vérifiés par signature, décodés avec une limite de pixels puis
  réencodés en WebP. Les photos Notion n'acceptent que HTTPS et une liste de
  domaines, contrôlent chaque redirection manuellement, limitent corps et délai
  global. Les appels du scraper Notion sont egalement annules apres 15 s et
  bornent chaque reponse a 5 Mio avant analyse JSON. Les brouillons ne sont pas
  servis par le chemin public.
- Lecture publique : les listes et l'historique valident les filtres et bornent
  `limit` à 100. Le graphe est une lecture complète assumée par le produit ; sa
  croissance doit rester suivie afin d'éviter un coût de réponse excessif.
- Secrets et dépendances : recherche statique sans secret applicatif détecté
  dans les fichiers suivis (hors valeurs de test et exemples) ; `.env`,
  `.secrets` et le stockage sont ignorés par Git. Avec Node `v24.20.0` et npm
  `12.0.2`, `npm audit --package-lock-only --omit=dev` est revenu sans
  vulnérabilité connue pour `backend` et `web-client`. Cette vérification ne
  couvre ni l'historique Git, ni les dépendances de développement, ni les
  secrets réellement présents sur le VPS.
- Le `docker-compose.yml` de développement publie PostgreSQL sur `5432` sans
  adresse de boucle explicite. Ce risque concerne le développement, pas la
  configuration VPS. Le bind local est reporté car le devcontainer accède à
  PostgreSQL via `host.docker.internal`; un réglage dédié est nécessaire pour
  le durcir sans casser cet accès.
- Runtime de référence du dépôt : Node 24.20.0 ; npm 12.0.2.
- `npm audit` backend et frontend : zéro vulnérabilité connue signalée lors
  de la passe du 2026-09-09. Cela ne couvre pas les erreurs métier.
- `scripts/run-all-checks.sh` : contrôles Biome, tests avec seuils de couverture,
  intégrations PostgreSQL et builds backend/frontend passent. Détail de cette
  passe : 367 tests backend, 15 intégrations, 98 tests frontend.
- Couverture backend : statements 73,51 %, branches 61,40 % ; frontend :
  statements 81,45 %, branches 70,42 %. Le seuil du service auth reste à 100 %
  des statements/lignes ; aucun seuil n'a été abaissé.
- Les contrôles de déploiement, sauvegarde, restauration, SSH et systemd sont
  conservés et documentés par `platform-ops`, hors de ce registre applicatif.

## Risques résiduels et suite obligatoire

| Priorité | Action / responsable | Limite ou mesure actuelle |
| --- | --- | --- |
| P1 — frontend/exploitant | Effectuer la recette navigateur des rôles et du blocage inter-origines | Aucun test navigateur réel des fournisseurs OAuth durant cette passe |
| P1 — backend | Poursuivre la revue des imports et erreurs/logs | La matrice de routes et la couverture ne prouvent pas l'absence d'IDOR ou de fuite dans tout le code |
| P2 — backend | Mesurer la contention du verrou commun si les mutations de comptes deviennent fréquentes | Lecture des sessions non verrouillée ; sérialisation limitée aux mutations sensibles |
| Exploitation VPS | Consulter l'audit central platform-ops | Les droits, services, promotion, restauration et durcissement systemd sont suivis dans le dépôt central ; ce fichier ne duplique pas leur statut. |

Le retour au code précédent suppose des migrations compatibles avec l'ancienne
version. Un changement de schéma destructif exige une procédure spécifique.
