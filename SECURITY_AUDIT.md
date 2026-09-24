# Audit de sécurité applicatif GTA-RP

État du code revu le 2026-09-24. Ce document couvre les contrôles applicatifs
du dépôt GTA uniquement. Les procédures et preuves de sécurité VPS, réseau,
services, sauvegardes et supervision restent centralisées dans
[`platform-ops`](https://github.com/Kutikuti/platform-ops) ; elles ne sont pas
auditées ni dupliquées ici.

## Résultats de ce lot

- Import Notion : les noms de personnages, tags et streamers sont recherchés
  avec des motifs `ILIKE` échappés puis validés par égalité insensible à la
  casse. `%`, `_` et `\` ne peuvent donc plus associer une fiche ou un tag
  voisin. Le blocage des personnages ambigus et des relations non résolues est
  conservé.
- Erreurs HTTP : les erreurs internes renvoient toujours un message générique.
  Les journaux n'incluent que catégorie, code SQLSTATE numérique s'il existe,
  méthode, modèle de route et statut ; message, pile, requête SQL, paramètres,
  jetons, URL et corps ne sont pas journalisés.
- Autorisations : la revue des routes et services admin, modération, profil,
  export, identités, sessions, contributions et imports Notion n'a confirmé
  aucun contournement supplémentaire nécessitant un correctif dans ce lot.
  Les routes admin/modération appliquent les rôles côté serveur ; le middleware
  invalide une session bannie ; l'export du profil et la dissociation d'identité
  sont liés à l'utilisateur de session. Les actions visant l'identifiant d'un
  autre compte sont admin-only et leurs tests refusent les rôles inférieurs.
- Migrations : `migrations.env` est chargé par un schéma SQL dédié ; les
  secrets de session/OAuth et la validation runtime ne sont pas requis. Les
  commandes `pending` et `executed` ne déclenchent aucune migration.
- PostgreSQL de développement : aucun port hôte n'est publié. Le service et le
  devcontainer partagent le réseau Docker privé `gta-rp-dev`; Compose exige le
  mot de passe défini localement dans `backend/.env` et ne fournit plus de mot
  de passe par défaut.

## Périmètre et limites

La revue statique a couvert les routeurs `admin`, `moderation`, `profile`,
`contributions`, `auth`, `supervision` et les routes publiques, ainsi que les
services d'accès utilisateur, d'export, de sessions et d'import Notion. Les
tests backend comprennent une matrice de refus des endpoints sensibles pour
visiteur anonyme, utilisateur banni, utilisateur simple et modérateur, plus
des tests ciblés d'export personnel, d'identités et de rôles. Cette couverture
ne prouve pas l'absence d'IDOR ou de fuite dans tout le code.

Restent ouverts :

- recette navigateur humaine des rôles, des fournisseurs OAuth réels et du
  blocage inter-origines ; les tests OAuth utilisent des fournisseurs simulés ;
- mesure de contention du verrou transactionnel commun si les mutations de
  comptes deviennent fréquentes ;
- vérification réelle de l'accès PostgreSQL via le réseau privé Docker après
  reconstruction du devcontainer : Docker n'est pas disponible dans
  l'environnement de cette passe, donc le contrat Compose/devcontainer est
  couvert par un test de configuration, pas par un démarrage de conteneurs ;
- validation des unités, secrets, pare-feu, sauvegardes, accès et services sur
  l'environnement hébergé par `platform-ops` avant toute promotion.

Aucun déploiement, accès ni changement VPS n'a été effectué dans ce lot.
