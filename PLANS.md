# Plan MVP - Annuaire Graphe GTA-RP

## Resume

Construire un MVP public sobre, oriente consultation, qui permet aux spectateurs
de retrouver les personnages d'un serveur GTA-RP via un graphe interactif, des
fiches detaillees, une recherche filtrable et un systeme de demandes de
modification moderees.

Le MVP s'appuie sur une base PostgreSQL alimentee initialement depuis la page
Notion communautaire, puis maintenue par contributions utilisateur validees par
des moderateurs.

## Objectifs produit

- Permettre a un visiteur anonyme d'explorer les personnages sans compte.
- Mettre en avant les liens narratifs entre personnages via un graphe.
- Donner acces a une fiche claire pour chaque personnage.
- Permettre a la communaute de proposer des corrections sans ecriture directe.
- Donner aux moderateurs un flux simple pour valider ou refuser les changements.
- Garder une trace publique des modifications validees.

## Perimetre MVP

Inclus :

- Vue principale avec graphe interactif.
- Recherche et filtres persistants.
- Fiche personnage.
- Tags et relations typees.
- Import initial depuis Notion communautaire.
- Connexion Google OAuth.
- Demandes de modification moderees.
- Roles utilisateur, moderateur, administrateur et utilisateur banni.
- Historique par fiche et historique global.
- Page contact, remerciements et soutien.

Hors MVP :

- Ingestion Discord automatisee.
- Parsing Twitch automatise.
- Extraction officielle admin comme dependance obligatoire.
- Interface immersive ou direction visuelle fortement inspiree GTA.
- Application mobile native.

## Parcours utilisateur

### Visiteur anonyme

1. Ouvre le site.
2. Recherche un personnage ou explore le graphe.
3. Selectionne un noeud.
4. Consulte la fiche detaillee.
5. Suit eventuellement le lien Twitch du streamer.

### Utilisateur connecte

1. Se connecte avec Google.
2. Ouvre une fiche personnage.
3. Propose une correction ou un ajout.
4. Suit l'etat de sa demande.

### Moderateur

1. Consulte la file des demandes.
2. Compare les donnees actuelles et les donnees proposees.
3. Accepte ou refuse avec commentaire.
4. Declenche la creation d'un historique en cas d'acceptation.

### Administrateur

1. Gere les roles.
2. Ajoute ou retire des moderateurs.
3. Bannit les utilisateurs abusifs.
4. Gere les tags structurants.

## Donnees principales

### Character

Informations attendues :

- Nom et prenom, seuls champs obligatoires.
- Surnom.
- Date de naissance.
- Statut vital : vivant, decede, parti, inconnu.
- Date de deces ou de depart si applicable.
- Photo.
- Entreprise.
- Echelon entreprise.
- Matricule entreprise.
- Telephone.
- Streamer associe.
- Reseaux du streamer ou du personnage : Twitch, Kick, YouTube, Instagram,
  TikTok.
- Groupe, role et quartier.
- Mort RP.
- Grade police et matricule police.
- Anciens personnages V1, V2, V3, V4 et V5.
- Tags.
- Relations.
- Statut de verification.

Tous les champs sauf nom et prenom peuvent etre inconnus ou a verifier.

### Streamer

- Nom public.
- Lien Twitch.
- Liens Kick, YouTube, Instagram et TikTok si disponibles.
- Plateforme principale si besoin futur.
- Personnages associes.

### Tag

- Nom.
- Type optionnel : famille, quartier, organisation, entreprise, autre.
- Couleur d'affichage.
- Description.

### CharacterRelationship

Les relations concernent strictement les personnages au sein du RP. Ne pas
modeliser ni afficher les relations reelles entre streamers.

Relations typees :

- Parent.
- Enfant.
- Fratrie.
- Couple.
- Ex.
- Oncle/tante.
- Neveu/niece.
- Groupe.
- Quartier.
- Entreprise.
- Police.
- Autre.

Chaque relation doit pouvoir porter :

- Un personnage source.
- Un personnage cible.
- Un type controle.
- Une direction : directionnelle ou symetrique.
- Un libelle d'affichage.
- Une description optionnelle.
- Une source : Notion, moderation, contribution, autre.
- Un statut de verification : verifie, communautaire, importe, a verifier,
  conteste.

Les relations familiales asymetriques sont directionnelles. Les relations de
couple, ex et fratrie sont symetriques pour l'affichage, meme si elles sont
stockees une seule fois.

### ChangeRequest

- Utilisateur createur.
- Personnage concerne.
- Snapshot complet de la fiche proposee.
- Difference calculee champ par champ a l'acceptation.
- Statut : en attente, acceptee, refusee.
- Commentaire moderateur obligatoire en cas de refus.
- Dates de creation et de resolution.

### ChangeHistory

- Personnage concerne.
- Liste des modifications appliquees champ par champ.
- Anciennes valeurs.
- Nouvelles valeurs.
- Moderateur responsable.
- Date de validation.

## Architecture cible

### Backend

- `backend/` : API Express TypeScript.
- Sequelize pour les modeles et migrations.
- PostgreSQL pour la persistance.
- Validation des entrees cote API.
- Rate limit sur les demandes de modification.
- Gestion centralisee des erreurs.
- Separation des routes publiques, authentifiees, moderation et administration.

Routes a prevoir :

- `GET /api/characters`
- `GET /api/characters/:id`
- `GET /api/graph`
- `GET /api/tags`
- `GET /api/history`
- `POST /api/change-requests`
- `GET /api/me/change-requests`
- `GET /api/moderation/change-requests`
- `POST /api/moderation/change-requests/:id/approve`
- `POST /api/moderation/change-requests/:id/reject`
- `POST /api/admin/tags`
- `PATCH /api/admin/tags/:id`
- `DELETE /api/admin/tags/:id`
- `PATCH /api/admin/users/:id/role`
- `POST /api/admin/users/:id/ban`

### Frontend

- `web-client/` : application React avec Vite et TypeScript.
- Create React App est ecarte car deprecie. L'autre application CRA peut servir
  de reference React, mais pas de reference d'outillage pour ce nouveau projet.
- Vue principale en trois zones : barre de recherche/filtres, graphe, panneau
  fiche.
- Navigation secondaire vers historique, moderation, administration et contact.
- Utiliser une bibliotheque existante pour le graphe plutot qu'un moteur maison.
- Etats obligatoires : chargement, erreur, vide, aucun resultat, non autorise.

### Choix graphe

- Choix MVP : `Cytoscape.js`.
- Justification : librairie specialisee dans les graphes/reseaux interactifs,
  avec zoom/pan, selection, evenements, styles par donnees, layouts
  automatiques, extensions, filtres et support des graphes groupes/compound.
- Besoins couverts : recherche avec mise en evidence, selection d'un
  personnage, relations typees, regroupements par famille/tag, filtrage
  dynamique, statut de verification et evolution vers des vues de voisinage.
- Alternative future : `Sigma.js` avec `Graphology` si le graphe atteint une
  volumetrie tres importante et que le rendu WebGL devient prioritaire.
- Alternatives ecartees pour le MVP : `React Flow` trop oriente editeur de
  workflows, `D3` trop bas niveau, `vis-network` moins flexible pour une app
  React durable, `GoJS` et `yFiles` trop orientes solutions commerciales.

### Import Notion

- Script d'import dans `backend/`.
- Import page par page, personnage par personnage, car aucun export CSV fiable
  n'est disponible.
- Stockage des donnees brutes dans une table temporaire ou structure
  intermediaire.
- Mapping explicite vers les champs `Character`, `Streamer`, `Tag`, reseaux
  sociaux, anciens personnages, police, relations et photos.
- Rapport des champs manquants ou ambigus.
- Rapport des relations detectees et des relations impossibles a relier
  automatiquement.
- Validation humaine avant publication des donnees importees.

## Design

- Direction : sobre data-app.
- Style visuel initial : dark mode avec fond noir, panneaux bleu sombre,
  contours et accents bleu "terminal".
- Le graphe doit utiliser des noeuds et liens bleus, avec variations de bleu
  pour les etats selectionne, survole, filtre, relation et verification.
- Garder une ambiance terminal/data, mais lisible : contrastes nets, textes
  clairs, panneaux lateraux structurants, pas d'effet neon excessif.
- Maintenir une coherence moderne sur toute l'application : tokens partages,
  composants reutilisables, typographie stable et conventions d'interaction
  uniformes.
- Les pages moderation et administration peuvent legerement contraster avec
  l'exploration publique, a confirmer apres les premiers jets d'ecran.
- Les pages moderation et administration doivent etre des pages pleines dediees
  avec une ergonomie back-office, pas des vues integrees au panneau lateral des
  fiches personnages.
- Priorite : lisibilite, recherche, comparaison et navigation rapide.
- Le graphe est un outil, pas une illustration.
- Eviter les heros marketing, les cartes decoratives et les effets visuels
  gratuits.
- Desktop prioritaire, mobile lisible avec graphe adapte ou panneau replie.

## Securite et moderation

- Priorite absolue du projet : proteger le serveur contre les intrusions et les
  abus.
- Lecture publique uniquement pour les visiteurs anonymes.
- Connexion obligatoire pour proposer une modification.
- Un utilisateur banni ne peut plus creer de demande.
- Les changements de donnees publiques passent par validation moderateur.
- Les actions moderateur et administrateur doivent etre journalisees.
- Rate limit sur les demandes pour limiter le spam.
- Les donnees importees ou incertaines doivent etre marquees comme a verifier.
- Validation stricte des entrees cote serveur, autorisations verifiees sur
  chaque route sensible et absence de confiance implicite dans le frontend.
- Secrets et variables sensibles hors Git, configuration par variables
  d'environnement.
- Les moderateurs peuvent modifier directement une fiche, mais cette action doit
  creer le meme type d'historique detaille qu'une demande acceptee.
- Le premier administrateur sera promu manuellement en base.

## Qualite de developpement

- Standards modernes : TypeScript strict, architecture lisible, composants
  reutilisables, validation des donnees, erreurs centralisees et tests
  proportionnes au risque.
- Faire des points reguliers sur l'etat du code : dette technique, besoins de
  refactor, risques securite, tests manquants et complexite accumulee.
- Prioriser les refactors qui reduisent un risque securite, clarifient les
  permissions ou simplifient la moderation.

## Tests attendus

Backend :

- Recherche et filtres.
- Permissions par role.
- Creation de demande.
- Validation et refus.
- Creation d'historique.
- Bannissement.
- Rate limit.
- Import Notion avec donnees d'exemple.

Frontend :

- Affichage de la vue graphe.
- Recherche et mise en evidence.
- Selection d'un personnage.
- Fiche detaillee.
- Etats vide, chargement et erreur.
- Acces moderation/admin selon role.
- Responsive desktop/mobile.

## Feuille de route de developpement

### Etape 1 - Socle projet

Statut : terminée le 2026-06-16.

- Initialiser `backend/` en Express TypeScript avec configuration stricte,
  lint, tests, gestion des variables d'environnement et structure de couches.
- Initialiser `web-client/` avec Vite, React et TypeScript.
- Ajouter une configuration commune minimale : scripts npm, `.env.example`,
  formatage, lint et documentation de lancement.
- Mettre en place une premiere politique de securite backend : Helmet, CORS
  explicite, rate limit de base, gestion centralisee des erreurs.

Point de controle :

- Le backend demarre.
- Le frontend demarre.
- Les tests et checks de base passent.
- Aucun secret n'est versionne.

### Etape 2 - Modele de donnees et base PostgreSQL

Statut : terminée le 2026-06-16.

- Configurer Sequelize, PostgreSQL, migrations et connexion par variables
  d'environnement.
- Creer les modeles principaux : `Character`, `Streamer`, `Tag`,
  `CharacterRelationship`, `User`, `Ban`, `ChangeRequest`, `ChangeHistory`.
- Modeliser les reseaux sociaux, anciens personnages, police, statut de
  verification et relations strictement RP.
- Ajouter des seeds realistes pour developper sans attendre l'import Notion.

Point de controle :

- Les migrations creent une base propre.
- Les seeds produisent un graphe exploitable.
- Les contraintes de base evitent les donnees incoherentes les plus evidentes.

Bilan :

- `db:ensure`, migrations, seeds, lint, tests et build backend valides.
- La migration initiale evite les ENUM PostgreSQL natifs au profit de colonnes
  texte avec contraintes `CHECK`, pour conserver les valeurs controlees sans
  declencher le warning de depreciation `pg` observe avec Sequelize.
- `DEPLOYMENT.md` documente le runbook initial de mise en production, incluant
  creation de base, migrations, sauvegardes et rollback.

### Etape 3 - API publique de consultation

Statut : en cours, socle public implemente le 2026-06-16.

- Implementer les routes publiques de lecture : personnages, fiche detaillee,
  tags, graphe, historique public.
- Ajouter recherche et filtres cote API.
- Retourner une structure de graphe adaptee a Cytoscape.js : noeuds, liens,
  types, statuts, tags et metadonnees utiles au rendu.
- Ajouter tests backend sur recherche, filtres, lecture de fiche et donnees de
  graphe.

Point de controle :

- Un visiteur anonyme peut consulter toutes les donnees publiques.
- Aucune route publique ne permet de modifier les donnees.
- Les performances restent correctes sur les seeds.

Bilan intermediaire :

- Routes `GET /api/characters`, `GET /api/characters/:id`, `GET /api/tags`,
  `GET /api/graph` et `GET /api/history` ajoutees.
- Recherche et filtres publics valides cote API avec Zod.
- Structure graphe retournee au format exploitable par Cytoscape.js.
- Tests backend ajoutes sur recherche, filtres, fiche, graphe, tags, historique
  et erreurs de validation.

### Etape 4 - Interface publique et graphe

- Construire la vue principale dark mode : recherche/filtres, graphe
  Cytoscape.js, panneau lateral de fiche.
- Implementer selection, zoom/pan, survol, mise en evidence des resultats et
  filtres persistants.
- Construire la fiche personnage avec informations, reseaux, relations, tags,
  statut de verification et historique.
- Ajouter les etats chargement, erreur, vide et aucun resultat.

Point de controle :

- Le parcours visiteur anonyme est utilisable de bout en bout.
- Le graphe reste lisible sur desktop et acceptable sur mobile.
- Le style dark terminal bleu est coherent et moderne.

### Etape 5 - Authentification et autorisations

- Ajouter Google OAuth cote backend.
- Utiliser une session serveur avec cookie `HttpOnly` pour l'application web,
  plutot qu'un jeton sensible stocke cote frontend.
- Implementer les roles utilisateur, moderateur, administrateur et banni.
- Proteger toutes les routes sensibles cote serveur, sans confiance implicite
  dans le frontend.
- Prevoir la promotion manuelle du premier administrateur en base.

Point de controle :

- Un utilisateur connecte est identifie correctement.
- Les roles sont verifies par le backend.
- Un utilisateur banni ne peut pas contribuer.

### Etape 6 - Contribution et moderation

- Implementer les demandes de modification sur snapshot complet de fiche.
- Calculer le diff champ par champ a l'acceptation.
- Creer l'historique detaille pour chaque demande acceptee.
- Construire les pages pleines de moderation : liste, detail, comparaison,
  acceptation et refus avec commentaire obligatoire.
- Permettre aux moderateurs d'editer directement une fiche tout en creant le
  meme historique detaille.

Point de controle :

- Le workflow contribution -> moderation -> historique fonctionne.
- Les refus demandent un commentaire.
- Les pages moderation sont separees du panneau lateral public.

### Etape 7 - Administration

- Construire les pages pleines d'administration.
- Ajouter gestion des tags : creation, modification, suppression controlee.
- Ajouter gestion des roles : promotion, retrait, bannissement.
- Journaliser les actions sensibles.
- Ajouter tests backend sur permissions, bannissements et actions admin.

Point de controle :

- Les actions admin sont impossibles sans role administrateur.
- Les changements structurants sont traces.
- Les suppressions dangereuses sont controlees ou bloquees si elles cassent des
  donnees existantes.

### Etape 8 - Import Notion

- Creer un importeur page par page pour la source Notion communautaire.
- Stocker les donnees brutes importees.
- Mapper les champs vers personnages, reseaux, police, anciens personnages,
  tags, relations et photos.
- Produire un rapport avant insertion : champs reconnus, champs manquants,
  relations detectees, relations ambigues.
- Ajouter des tests avec exemples figes.

Point de controle :

- L'import ne publie rien sans validation humaine.
- Les donnees incertaines sont marquees a verifier.
- Les erreurs de parsing sont visibles et non silencieuses.

### Etape 9 - Durcissement qualite et securite

- Revue des validations d'entree, autorisations, rate limits, logs et gestion
  d'erreurs.
- Revue des risques XSS, injection SQL, fuite de secrets, enumeration abusive
  et abus de formulaires.
- Ajouter ou renforcer les tests sur les zones sensibles.
- Faire un point de refactor : duplication, complexite, permissions, structure
  frontend et lisibilite des services backend.

Point de controle :

- Les risques residuels sont listes.
- Les refactors necessaires avant mise en ligne sont identifies ou faits.
- Les checks automatises passent.

### Etape 10 - Preparation deploiement

- Documenter la configuration de production : variables, PostgreSQL, Nginx,
  TLS, processus Node.js et build frontend.
- Prevoir logs, sauvegardes base de donnees, firewall, fail2ban ou equivalent.
- Verifier la capacite du VPS Hetzner avant ouverture publique.
- Preparer une procedure de restauration de base et de rollback applicatif.

Point de controle :

- Le site peut etre deploye sans secret en dur.
- Les sauvegardes sont planifiees avant exposition publique.
- Le serveur est durci avant trafic public.

## Hypotheses

- La page Notion communautaire est la source initiale, mais son accessibilite et
  sa structure devront etre confirmees par tests de parsing.
- Google OAuth suffit pour le MVP.
- Le frontend demarre avec Vite, React et TypeScript.
- Le developpement utilise Node.js `24.16.0` ou plus recent, en restant sur la
  branche LTS plutot que sur la branche Current.
- Discord, Twitch et extraction admin sont des evolutions futures.
- Le VPS Hetzner pourra heberger le backend, le frontend, PostgreSQL et Nginx,
  sous reserve de verification de charge au moment du deploiement.
