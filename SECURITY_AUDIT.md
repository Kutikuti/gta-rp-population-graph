# Audit de sécurité — étape 17

Date : 2026-09-09. Base examinée : `670d968`, avec correctifs locaux de cette
passe. Consulter `git diff` pour les modifications non encore publiées.

## Décision actuelle

**Ouverture reportée.** Les validations locales passent, mais les corrections
ne sont pas encore déployées. Une faille OAuth critique a été reproduite dans
les tests. Les contrôles du VPS révèlent aussi un décalage entre sauvegarde et
restauration. Cette revue ne constitue pas une garantie d'absence de faille.

## Périmètre et frontières de confiance

Le navigateur et toutes les données communautaires sont non fiables. L'API
valide les entrées et les droits ; PostgreSQL conserve identités, demandes et
historique. Les photos passent par décodage/réencodage avant exposition. Notion
et les fournisseurs OAuth sont des services externes. Caddy termine TLS et
transmet à l'API locale. Grafana est protégé par une autorisation administrateur.
Le VPS et son runtime sont mutualisés avec F1 ; aucune modification de F1 n'a
été effectuée.

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

| ID | Gravité | Preuve / effet | Traitement local et état production |
| --- | --- | --- | --- |
| AUTH-01 | Critique | Une identité non liée ayant le même email déclenchait une session sur le compte existant, y compris administrateur. L'ancien test masquait le problème en simulant un compte introuvable. | Refus `email_in_use` avant toute récupération de session. Test reproduit rouge avant correction, vert après ; reproduction PostgreSQL. **À déployer.** |
| AUTH-02 | Élevée | Les transactions seules ne sérialisaient pas le premier administrateur, les dissociations ou la suppression du dernier administrateur. | Verrou transactionnel PostgreSQL commun ; tests concurrents réels. Les administrateurs bannis ne comptent plus comme secours ; bannissement du dernier admin refusé. À déployer. |
| PHOTO-01 | Élevée | `fetch` suivait les redirections avant de vérifier leur destination. | Vérification de chaque saut avant accès réseau, trois redirections maximum, HTTPS/ports/hôtes bornés, délai global 15 s, annulation des corps trop grands. Tests de destinations internes et de boucles. À déployer. |
| OPS-01 | Élevée | Les dumps du 9 septembre sont sous `releases/shared/backups`, mais le contrôle de restauration lit `shared/backups` contenant des dumps de juin/juillet. | Résolution du chemin de release corrigée ; test du lien `current` ; contrôle de fraîcheur 36 h dans le répertoire réellement restauré. À appliquer et faire suivre d'une restauration récente. |
| OPS-02 | Élevée | Dumps observés en mode 0644 ; des exports partiels pouvaient être publiés comme sauvegardes finales. | Répertoires 0700, fichiers 0600, verrou d'exécution, fichier temporaire, vérification `pg_restore --list`/`tar -tzf`, publication atomique puis rétention. Les archives existantes restent à protéger. |
| WEB-01 | Moyenne | CORS ne constitue pas à lui seul une autorisation d'écriture ; les sous-domaines partagent la notion de site navigateur. | Contrôle exact de l'Origin pour les écritures, défense Fetch Metadata, compatibilité clients non navigateur sans Origin ; tests avec session authentifiée. À déployer. |
| AUTH-03 | Moyenne | État de connexion non rattaché explicitement au fournisseur et sans expiration courte. | Fournisseur lié à l'état, expiration 10 min, nettoyage, tests de confusion et d'expiration. Délais OAuth 10 s par requête, redirections réseau refusées. À déployer. |
| OPS-03 | Moyenne | API en écoute sur `*:4000`, derrière le pare-feu mais accessible depuis les autres services locaux. | Écoute production sur `127.0.0.1:4000`, cohérente avec Caddy ; contrôle SSH explicite. À déployer. |
| OPS-04 | Moyenne | Activation mutualisée vérifiant seulement systemd, sans santé HTTP ni retour automatique. | Script GTA dédié de bascule atomique et retour sur échec systemd/HTTP ; tests de simulation. Ne modifie pas la base ni F1. À utiliser lors de la prochaine release. |
| OPS-05 | Moyenne | Smoke checks avec fichiers `/tmp` prévisibles, interpolation shell de l'URL et mauvais traitement des HTTP 401/403. | Répertoire temporaire privé, paramètres cités, délais réseau, code HTTP explicite ; tests d'échec réseau et d'exposition de Grafana. Chemin monitoring corrigé. |
| PRIV-01 | Faible | Absence d'instruction explicite de non-stockage des réponses privées. | `Cache-Control: no-store` sur les espaces authentifiés. À déployer. |

## Vérifications effectuées

- Runtime local et VPS : Node 24.20.0 ; npm local 12.0.2.
- `npm audit` backend et frontend : zéro vulnérabilité connue signalée lors
  de la passe du 2026-09-09. Cela ne couvre pas les erreurs métier.
- `scripts/run-all-checks.sh` : contrôles Biome, tests avec seuils de couverture,
  intégrations PostgreSQL et builds backend/frontend passent. Détail de cette
  passe : 367 tests backend, 15 intégrations, 98 tests frontend.
- Couverture backend : statements 73,51 %, branches 61,40 % ; frontend :
  statements 81,45 %, branches 70,42 %. Le seuil du service auth reste à 100 %
  des statements/lignes ; aucun seuil n'a été abaissé.
- 10 tests d'exploitation : exports partiels/invalides, permissions, rétention,
  faux succès HTTP, activation et rollback simulés. Inclus dans le runner global.
- HTTP production : accueil, health, session anonyme, liste publique,
  démarrage Google, refus admin et protection de la supervision passent.
- SSH en lecture : backend/Caddy/timers actifs, UFW actif, PostgreSQL local,
  fail2ban SSH présent, rétention journald, espace disque, supervision locale.
  Le test de restauration planifié a réussi le 6 septembre, **sur son chemin
  configuré** ; ce résultat n'atteste pas la restauration du dump récent.
- Le contrôle SSH renforcé échoue comme attendu sur la fraîcheur du dump dans
  `shared`, les permissions des sauvegardes et le bind de l'API. Ces échecs
  correspondent à l'état actuellement déployé, pas à des tests ignorés.

## Risques résiduels et suite obligatoire

| Priorité | Action / responsable | Limite ou mesure actuelle |
| --- | --- | --- |
| P0 — exploitant GTA | Déployer les correctifs AUTH-01/AUTH-02/PHOTO-01 ; refaire les parcours OAuth et les smoke tests | Correctifs uniquement locaux ; ouverture non validée |
| P0 — exploitant GTA | Produire un dump récent dans `shared`, protéger les anciens dossiers, restaurer ce dump dans une base éphémère puis vérifier tables et données | Ne pas supprimer les anciens dumps avant cette validation ; `pg_restore --list` n'est pas une restauration |
| P1 — exploitant plateforme | Revoir le port 5000 F1 autorisé publiquement par UFW et le compte d'exécution partagé `codex-deploy` | Hors périmètre de modification GTA ; l'API F1 n'a pas été modifiée. Le compte backend possède encore releases et configuration |
| P1 — frontend/exploitant | Revue CSP et en-têtes du HTML Caddy, recette navigateur des rôles et du blocage inter-origines | Helmet protège les réponses Express ; le HTML statique vient de Caddy. Aucun test navigateur réel des fournisseurs OAuth durant cette passe |
| P1 — sécurité | Exécuter le protocole Strix isolé, reproduire ses résultats, poursuivre la revue des imports et erreurs/logs | Recherche Strix faite, scan non exécuté ; voir `STRIX.md`. La matrice de routes et la couverture ne prouvent pas l'absence d'IDOR ou de fuite dans tout le code |
| P2 — backend | Mesurer la contention du verrou commun si les mutations de comptes deviennent fréquentes | Lecture des sessions non verrouillée ; sérialisation limitée aux mutations sensibles |

Le retour de release suppose des migrations compatibles avec l'ancienne
version. Un changement de schéma destructif exige une procédure spécifique.
La validation finale doit identifier la release effectivement déployée, le dump
récent effectivement restauré et le résultat des parcours authentifiés.
