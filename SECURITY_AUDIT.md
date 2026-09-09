# Audit de sécurité — étape 17

Date : 2026-09-09. Base examinée : `670d968`. Correctifs applicatifs du commit
`997c560` déployés dans `20260909T134027Z-step17-security-r2`, avec correction
additionnelle du contrôle des timers ; empreintes dans `DEPLOYMENT.md`.

## Décision actuelle

**Correctifs déployés ; audit encore ouvert.** La faille OAuth reproduite dans
les tests est corrigée en production. Le dump récent a été restauré et les
écarts de sauvegarde, permissions et écoute réseau GTA sont corrigés. Les
contrôles HTTP/SSH et les en-têtes CSP du HTML statique passent. La recette
navigateur complète des rôles et la revue complémentaire des imports et erreurs
restent à effectuer. Cette revue ne constitue pas une garantie d'absence de
faille.

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

Le tableau conserve l'état de préparation avant déploiement. Les correctifs
applicatifs et scripts listés sont maintenant en production ; les anciens
dossiers de sauvegardes ont aussi été protégés. Voir le bilan de déploiement
daté dans `DEPLOYMENT.md` pour les preuves et les changements d'exploitation.

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

- Revue statique complémentaire non intrusive du 2026-09-09 : aucun serveur n'a
  été démarré, aucun endpoint de production n'a été appelé et aucune tentative
  d'exploitation, de scan actif ou de mutation n'a été effectuée. L'examen a
  couvert les routes, middlewares, sessions OAuth, imports, photos, fichiers de
  configuration, scripts d'exploitation et tests associés.
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
- Configuration documentée : PostgreSQL et les composants de monitoring sont
  liés à des adresses locales sur le VPS ; l'API GTA est attendue sur
  `127.0.0.1:4000` derrière Caddy. Le `docker-compose.yml` de développement
  publie toutefois PostgreSQL sur `5432` sans adresse de boucle explicite. Ce
  risque est limite au developpement : il n'affecte pas le VPS, ou PostgreSQL
  est bloque publiquement. Le bind local est reporte car le devcontainer accede
  a ce service via `host.docker.internal`; une configuration dediee est
  necessaire pour le durcir sans casser cet acces.
- Runtime local et VPS : Node 24.20.0 ; npm local 12.0.2.
- `npm audit` backend et frontend : zéro vulnérabilité connue signalée lors
  de la passe du 2026-09-09. Cela ne couvre pas les erreurs métier.
- `scripts/run-all-checks.sh` : contrôles Biome, tests avec seuils de couverture,
  intégrations PostgreSQL et builds backend/frontend passent. Détail de cette
  passe : 367 tests backend, 15 intégrations, 98 tests frontend.
- Couverture backend : statements 73,51 %, branches 61,40 % ; frontend :
  statements 81,45 %, branches 70,42 %. Le seuil du service auth reste à 100 %
  des statements/lignes ; aucun seuil n'a été abaissé.
- 11 tests d'exploitation : exports partiels/invalides, permissions, rétention,
  faux succès HTTP, activation et rollback simulés. Inclus dans le runner global.
- HTTP production : accueil, health, session anonyme, liste publique,
  démarrage Google, refus admin et protection de la supervision passent.
- SSH en lecture : backend/Caddy/timers actifs, UFW actif, PostgreSQL local,
  fail2ban SSH présent, rétention journald, espace disque, supervision locale.
  Le test de restauration planifié a réussi le 6 septembre, **sur son chemin
  configuré** ; ce résultat n'atteste pas la restauration du dump récent.
- Le contrôle SSH renforcé échouait avant déploiement sur la fraîcheur du dump
  dans `shared`, les permissions et le bind de l'API. Il passe après correction,
  avec vérification individuelle des timers et le bon service mutualisé.
- Restauration réelle du dump du 2026-09-09 à 13:42:44 UTC : 362 personnages,
  107 relations, 1380 historiques ; index valides et base temporaire supprimée.
  Les empreintes de la release et du dump figurent dans `DEPLOYMENT.md`.
- Revue VPS complémentaire en lecture seule du 2026-09-09 : la release active
  est `20260909T151730Z-notion-response-bound`, l'API et PostgreSQL sont liés à
  `127.0.0.1`, et Prometheus, Grafana, node-exporter et blackbox-exporter ne
  sont aussi exposés que localement. Caddy 2.11.4 valide sa configuration ; le
  certificat Let's Encrypt de `gta-rp.f1prediction.fr` expire le 2026-11-27.
  Les secrets n'ont pas été lus : `backend.env` est en `0600` sous un dossier
  `0700`, et les clés SSH de déploiement sont en `0700`/`0600`.
- Le backend exécute effectivement `/opt/node-v24.20.0/bin/node`. En revanche,
  appeler `/opt/node-apps/bin/npm` sans placer ce dossier en tête de `PATH`
  résout le Node système 18 via son shebang ; le service et le runbook utilisent
  déjà le `PATH` correct, qui doit rester obligatoire dans les procédures.
- Aucun brouillon d'upload temporaire n'était présent. Les photos validées sont
  volontairement lisibles localement pour être servies publiquement ; les
  journaux Notion et les rapports de déploiement existants sont en `0644` et
  doivent être rendus privés s'ils peuvent contenir des données importées ou des
  détails de sécurité.

## Risques résiduels et suite obligatoire

| Priorité | Action / responsable | Limite ou mesure actuelle |
| --- | --- | --- |
| Traité — exploitant GTA | Déployer les correctifs AUTH-01/AUTH-02/PHOTO-01 et exécuter les smoke tests | Déployé ; redirections OAuth et cookies vérifiés. La connexion complète avec comptes réels reste une recette manuelle |
| Traité — exploitant GTA | Produire un dump récent dans `shared`, protéger les anciens dossiers et restaurer le dump | Restauration réelle avec contrôles de données et suppression de la base éphémère effectuée |
| P1 — exploitant plateforme | Revoir le port 5000 F1 autorisé publiquement par UFW et le compte d'exécution partagé `codex-deploy` | Hors périmètre de modification GTA ; l'API F1 n'a pas été modifiée. Le compte backend possède encore releases et configuration |
| P1 — exploitant plateforme | Durcir SSH après vérification d'un accès de secours par clé | `PermitRootLogin yes`, `PasswordAuthentication yes`, `X11Forwarding yes` et `AllowTcpForwarding yes` sont actifs. Fail2ban et les permissions de clés sont corrects, mais ce réglage expose le VPS entier ; ne pas le modifier sans confirmer les clés administrateur et les besoins de tunnel |
| Traité — exploitant GTA | Déployer la CSP et les en-têtes du HTML Caddy documentés | Configuration Caddy validée puis rechargée le 2026-09-09 ; contrôle HTTPS public positif pour CSP, HSTS, `nosniff`, anti-frame, referrer et permissions policy |
| P1 — frontend/exploitant | Effectuer la recette navigateur des rôles et du blocage inter-origines | Aucun test navigateur réel des fournisseurs OAuth durant cette passe |
| P1 — backend | Poursuivre la revue des imports et erreurs/logs | La matrice de routes et la couverture ne prouvent pas l'absence d'IDOR ou de fuite dans tout le code |
| P2 — backend | Mesurer la contention du verrou commun si les mutations de comptes deviennent fréquentes | Lecture des sessions non verrouillée ; sérialisation limitée aux mutations sensibles |
| P2 — exploitant GTA | Durcir l'unité backend après test de démarrage | Service non-root avec `NoNewPrivileges`, `PrivateTmp` et système de fichiers protégé, mais sans `UMask`, `ProtectHome`, filtre d'appels système ni bornage IP. Les appels OAuth/Notion exigent un accès réseau ; le profil doit être testé avant activation |
| P2 — exploitant GTA | Passer les journaux et rapports de déploiement GTA en privé | Les fichiers existants sont en `0644`. Évaluer leur contenu et les lecteurs nécessaires avant un `0700`/`0600` afin de ne pas gêner l'exploitation |

Le retour de release suppose des migrations compatibles avec l'ancienne
version. Un changement de schéma destructif exige une procédure spécifique.
La validation finale doit identifier la release effectivement déployée, le dump
récent effectivement restauré et le résultat des parcours authentifiés.
