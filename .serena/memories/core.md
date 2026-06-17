# Core

- Projet: annuaire + graphe GTA-RP pour consultation publique des personnages, streamers, groupes/tags et relations narratives RP.
- Priorite permanente: securite serveur et moderation des donnees avant richesse d'affichage.
- Source initiale privilegiee: page Notion communautaire Flashback Whitelist V6; toujours traiter comme communautaire/a verifier, jamais comme source officielle parfaite.
- MVP: consultation anonyme, recherche/filtres, fiche personnage, graphe interactif, tags, demandes de modification connectees, validation/refus moderation, roles, bannissement, historique, pages contact/remerciements/soutien.
- Relations a modeliser: strictement entre personnages RP; ne pas modeliser/afficher les relations reelles entre streamers.
- Architecture: backend Express TS dans `backend/`, frontend Vite React TS dans `web-client/`, PostgreSQL via Sequelize.
- Etat projet durable a ce jour: socle backend/frontend initialise; modele Sequelize + migrations/seeds termines; API publique de consultation demarree avec routes characters/tags/graph/history.
- Lire `mem:backend/core` pour l'organisation API/DB et les invariants backend.
- Lire `mem:web-client/core` pour l'organisation de l'app React et les contraintes UI.
- Lire `mem:tech_stack` pour versions/outillage.
- Lire `mem:conventions` avant de modifier produit, securite, donnees ou interface.
- Lire `mem:suggested_commands` pour lancer dev/checks locaux.
- Lire `mem:task_completion` avant de rendre une modification de code.