# Conventions

- Lire `AGENTS.md`, `PLANS.md` et les fichiers concernes avant toute modification; verifier `git status` pour ne pas ecraser les changements utilisateur.
- Garder les changements limites a la demande en cours; mettre a jour `PLANS.md` si une decision produit/technique change.
- Langue des textes produit: francais.
- Donnees: conserver la distinction verifie/communautaire/importe/a verifier/conteste; ne pas presenter une donnee incertaine comme certaine.
- Moderation: privilegier les demandes moderees plutot que l'ecriture directe; toute acceptation doit produire historique detaille.
- Securite: validation serveur stricte, autorisations cote serveur, moindre privilege, protection injection SQL/XSS/CSRF si applicable, rate limit, pas de secrets Git.
- Routes sensibles: verifier auth, role, bannissement et payload a chaque action modifiante.
- Backend: separation claire routes/services/db; erreurs centralisees; Zod pour validation d'entrees API/env.
- DB: respecter les valeurs controlees et contraintes existantes; relations RP uniquement entre personnages.
- Frontend: interface compacte/scannable, tokens et conventions coherents, pas de marketing/decoratif; moderation/admin en pages dediees.
- Commentaires: seulement pour logique metier non evidente.
- Eviter abstractions prematurees; refactoriser progressivement quand securite, permissions ou moderation deviennent confuses.