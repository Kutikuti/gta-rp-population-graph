# Web Client Core

- Dossier: `web-client/`; Vite + React + TypeScript, pas Create React App.
- Entree: `src/main.tsx`; composant racine actuel: `src/App.tsx`; tests/setup sous `src/test/`.
- Direction UI: data-app sobre, dense, lisible, dark mode fond noir avec bleu terminal fonctionnel; eviter pages marketing, heros decoratifs et effets gratuits.
- Vue principale MVP: recherche/filtres, graphe interactif, panneau fiche personnage.
- Graphe MVP: Cytoscape.js obligatoire; ne pas developper de moteur maison. Sigma.js + Graphology seulement si volumetrie future tres forte/WebGL prioritaire.
- Etats UX obligatoires: chargement, erreur, vide, aucun resultat, non autorise.
- Moderation/admin: pages pleines dediees avec ergonomie back-office, pas dans le panneau lateral public.
- Desktop prioritaire; mobile doit rester lisible avec graphe adapte ou panneau replie.
- Textes produit/interface en francais.