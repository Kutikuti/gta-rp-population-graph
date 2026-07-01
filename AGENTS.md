# Projet

Ce depot contient un site web d'annuaire et de graphe pour un serveur GTA-RP.
L'objectif est d'aider les spectateurs a retrouver rapidement les personnages,
leurs streamers, leurs groupes d'appartenance et leurs liens narratifs.

Le projet doit rester sobre, lisible et oriente consultation. La difficulte
principale n'est pas l'affichage, mais la qualite et la moderation des donnees.
Pendant tout le developpement, la priorite numero 1 est la securite du serveur
et la prevention des intrusions.

# Architecture cible

## Backend

- Dossier cible : `backend/`.
- API Express en TypeScript.
- ORM Sequelize.
- Base de donnees PostgreSQL.
- API REST en JSON.
- Authentification en place : Google OAuth, Discord OAuth et Twitch OAuth pour
  les utilisateurs connectes.
- Les routes publiques doivent rester accessibles anonymement en lecture.
- Les routes de contribution, moderation et administration doivent etre
  protegees par authentification et roles.

Modeles metier attendus :

- `Character`
- `Streamer`
- `Tag`
- `CharacterRelationship`
- `ChangeRequest`
- `ChangeHistory`
- `User`
- `Role`
- `Ban`
- `UserIdentity` ou equivalent futur pour lier plusieurs fournisseurs SSO a un
  meme compte utilisateur.

## Frontend

- Dossier cible : `web-client/`.
- Client React avec Vite et TypeScript.
- Create React App ne doit pas etre utilise pour ce nouveau projet, car il est
  deprecie. L'autre application en CRA peut servir de reference React, mais pas
  de reference d'outillage.
- Interface de type data-app : dense, sobre, efficace.
- Vue principale : recherche et filtres, graphe interactif, panneau de fiche.
- Le graphe doit permettre selection, zoom/pan, regroupement visuel et mise en
  evidence des resultats de recherche.
- Le graphe MVP doit utiliser `Cytoscape.js`. Ne pas developper un moteur de
  graphe maison.
- Si la volumetrie devient tres forte, reevaluer `Sigma.js` avec `Graphology`
  comme alternative orientee WebGL.
- Eviter les pages marketing ou les effets purement decoratifs.

# Donnees

La source initiale privilegiee est la page Notion communautaire Flashback
Whitelist V6. Elle doit etre traitee comme une source communautaire a verifier,
pas comme une source officielle parfaite.

Principes :

- L'import Notion se fait personnage par personnage : il n'y a pas d'export CSV
  disponible comme source fiable.
- Conserver les donnees brutes importees et produire un rapport de mapping avant
  publication.
- Ne pas presenter une donnee incertaine comme certaine.
- Prevoir un statut ou indicateur de verification quand l'information est
  importee ou communautaire.
- Garder un historique des modifications validees.
- Le suivi des imports Notion doit rester exploitable en administration :
  tri stable des fiches importees, recherche par nom et distinction claire
  entre fiches deja appliquees et restant a traiter.
- Privilegier un flux de contribution modere plutot que l'ecriture directe par
  les utilisateurs simples.
- Ne pas exposer publiquement les noms et prenoms fournis par les fournisseurs
  OAuth. Les utilisateurs doivent pouvoir choisir un nom d'affichage public
  distinct de leur identite SSO.
- Les extractions admin futures ne doivent pas bloquer le MVP.
- Les relations documentees concernent uniquement les personnages et le RP, pas
  les relations reelles entre streamers.
- Le champ Notion `V6`, lorsqu'il est present, doit etre considere comme une
  piste de rattachement vers les anciens personnages du meme joueur. Ce besoin
  pourra conduire a ajouter un type de relation dedie, distinct des relations
  familiales affichees dans le graphe public.
- Lors de l'import Notion, les liens publics doivent conserver l'URL cible
  reelle du lien et pas seulement son texte visible.
- L'application d'une fiche Notion ne doit pas etre bloquee uniquement parce
  qu'une relation cible une autre fiche Notion pas encore appliquee ; ces
  relations doivent pouvoir se completer ensuite sans creer de doublon
  symetrique.

# Fonctionnalites MVP

- Consultation anonyme des personnages.
- Recherche par nom, prenom, surnom, un ou plusieurs numeros de telephone,
  entreprise, grade, matricule,
  streamer, tag et statut vital.
- Fiche personnage detaillee.
- URL partageable vers une fiche precise, ouvrant la vue publique avec le
  graphe centre sur le personnage et sa fiche ouverte.
  Cette URL publique doit utiliser un slug lisible stable de type
  `prenom-nom`, avec suffixe numerote en cas de doublon, plutot qu'un UUID.
  Si le prenom ou le nom d'une fiche change, ce slug doit etre regenere pour
  rester coherent avec la fiche publique.
- Relations typees strictement RP entre personnages et limitees au noyau
  familial/couple : parent, enfant, fratrie, couple.
- Les appartenances metier, police, quartier ou groupe restent des champs de
  fiche ou des tags, pas des relations du graphe public. Les metiers et
  fonctions doivent converger vers un bloc unifie `entreprise / grade /
  matricule`, y compris pour la police, la medecine ou toute autre
  organisation.
- A moyen terme, certaines relations supplementaires pourront exister sans etre
  affichees dans le graphe public, uniquement dans la fiche personnage. Le
  modele de relations doit donc pouvoir evoluer au-dela des seules relations
  visibles sur le graphe.
- Cette evolution est desormais attendue dans `character_relationships` lui-meme
  avec une regle explicite par type : visible dans la fiche, et visible ou non
  dans le graphe public selon la nature de la relation.
- Tags administrables.
- Demandes de modification par utilisateur connecte simple.
- Demandes de creation de fiche par utilisateur connecte, proposees depuis la
  recherche quand aucun resultat satisfaisant n'est trouve, et validees par
  moderation avant publication afin de limiter les doublons.
- Photo optionnelle de personnage, proposee uniquement dans une modification de
  fiche existante. La creation de fiche ne doit pas permettre l'upload de photo
  afin de limiter le spam et le stockage inutile.
- Les modifications effectuees par un moderateur ou un administrateur sont
  appliquees directement cote serveur et doivent toujours creer un historique.
- Page profil utilisateur permettant de modifier son nom d'affichage public,
  consulter ses contributions et gerer ses rattachements SSO.
- Validation ou refus par moderateur.
- Roles utilisateur, moderateur, administrateur et utilisateur banni.
- Page globale d'historique.
- Page contact, remerciements et soutien.

# Environnement

- Developpement local sur Windows avec WSL Ubuntu.
- Production cible sur VPS Hetzner Ubuntu deja utilise pour un autre site.
- Prevoir que plusieurs noms de domaine puissent pointer vers le meme serveur.
- Ne pas supposer que Node.js est installe dans WSL ; verifier avant de lancer
  des commandes npm cote Ubuntu.

# Commandes utiles

Les commandes de base existent deja :

- Installation backend : `cd backend && npm install`
- Installation frontend : `cd web-client && npm install`
- Tests backend : `cd backend && npm test`
- Tests frontend : `cd web-client && npm test`
- Developpement backend : `cd backend && npm run dev`
- Developpement frontend : `cd web-client && npm run dev`

# Deploiement

Le deploiement initial sur VPS est deja amorce sur
`gta-rp.f1prediction.fr` avec :

- API Node.js geree par un service `systemd`.
- PostgreSQL local via Docker, non expose publiquement.
- Frontend servi en statique derriere Caddy.
- Caddy responsable du reverse proxy, du TLS automatique et de la coexistence
  avec le site historique.
- Variables d'environnement separees hors Git.

Le runbook detaille et l'etat reel du VPS doivent etre maintenus dans
`DEPLOYMENT.md`.

# Style

- Langue des textes produit : francais.
- Interface : sobre, utilitaire, lisible, non marketing.
- Direction visuelle MVP : dark mode, fond noir, accents bleu "terminal" pour
  les noeuds, liens, panneaux lateraux, contours et etats actifs.
- Utiliser le bleu comme couleur fonctionnelle principale, avec des contrastes
  suffisants pour la lecture et sans transformer l'interface en effet neon
  illisible.
- Le style doit rester moderne et coherent sur toute l'application : memes
  tokens, memes typographies, memes espacements et memes conventions
  d'interaction.
- Les pages moderation et administration peuvent avoir un contraste visuel leger
  avec la partie publique, mais doivent rester dans le meme systeme de design.
- Les espaces moderation et administration sont des pages pleines dediees, pas
  des contenus places dans le panneau lateral des fiches personnages.
- Partie publique : l'ecran d'arrivee doit etre centre sur le graphe. Le graphe
  occupe l'essentiel de l'espace disponible ; la recherche est repliee par
  defaut derriere une icone ou un bouton compact, et la fiche personnage n'est
  pas visible tant qu'aucun noeud n'a ete selectionne.
- Une fois ouverte par selection d'un noeud, la fiche personnage doit pouvoir
  etre refermee pour redonner l'espace au graphe. La selection doit etre
  evidente directement dans le graphe et dans la fiche, sans barre de statut
  textuelle redondante.
- Le bouton d'action d'une fiche personnage doit indiquer le comportement reel :
  `Proposer` pour un utilisateur simple, `Modifier` pour un moderateur ou un
  administrateur dont la modification est appliquee directement.
- Dans l'edition d'une fiche, les champs doivent etre regroupes avec clarte :
  bloc identite, statuts, organisation, contact, photo, medias, parentes RP
  et note de source. La verification reste proche de la note de source plutot
  que melangee au bloc `Statuts`.
- Le bloc organisation d'une fiche personnage repose sur trois champs
  facultatifs et unifies pour tous les metiers : `Entreprise`, `Grade` et
  `Matricule`, auxquels s'ajoutent `Groupe` et `Quartier`. Ne pas reintroduire
  de champs dedies type police ou role de groupe qui feraient doublon.
- Les parentes RP doivent etre editables depuis la fiche via un bloc dedie,
  avec les types controles `parent`, `enfant`, `fratrie`, `couple`.
- Le bloc medias doit permettre soit de rattacher un streamer existant, soit de
  proposer un nouveau streamer par son nom public, ainsi que d'editer les liens
  publics associes. Ce bloc pourra aussi accueillir un lien Discord public pour
  un streamer quand ce besoin sera implemente.
- Une fiche personnage peut contenir plusieurs numeros de telephone. L'edition,
  l'affichage public, la moderation et les differences d'historique doivent
  rester lisibles avec cette structure.
- La photo d'un personnage est affichee dans un masque rond, notamment dans les
  noeuds du graphe. L'interface d'upload doit permettre de recadrer une image
  carree ou quasi-carree en deplacant/zoomant l'image sous un masque rond avant
  envoi ou validation.
- Quand une photo validee existe pour un personnage, le noeud du graphe affiche
  la photo seule, sans initiales superposees. Les initiales servent uniquement
  de fallback pour les personnages sans photo.
- Les vues pleines contribution, moderation et administration utilisent la
  navigation globale en haut a droite pour revenir au graphe. Ne pas ajouter de
  bouton `Retour au graphe` redondant dans leur contenu.
- L'historique affiche dans une fiche personnage doit pouvoir etre deplie pour
  consulter le detail des champs modifies.
- Ne pas afficher de statistiques publiques de type nombre de personnages,
  tags ou liens dans l'exploration publique. Ces informations sont reservees
  aux espaces moderation ou administration.
- Eviter les bandeaux et libelles de supervision dans la vue publique, par
  exemple `Graphe narratif`, `Selection : ...` ou `Vue complete`, sauf besoin
  d'accessibilite discret. L'interface publique doit laisser le graphe porter
  l'experience.
- Favoriser des composants compacts et scannables.
- Ne pas utiliser de donnees personnelles reelles sans source et justification.
- Eviter les abstractions prematurees ; suivre les besoins du MVP.
- Ajouter des commentaires seulement quand ils aident a comprendre une logique
  metier non evidente.

# Qualite et securite

- Developper selon des standards modernes : TypeScript strict, validation des
  entrees, separation claire des couches, gestion explicite des erreurs,
  conventions de nommage coherentes et tests adaptes au risque.
- Garder la securite comme priorite absolue : authentification robuste,
  autorisations cote serveur, principe du moindre privilege, protection contre
  injection SQL, XSS, CSRF si applicable, abus de rate limit et fuite de secrets.
- Ne jamais faire confiance aux donnees envoyees par le frontend, meme pour les
  utilisateurs moderateurs ou administrateurs.
- Les uploads de photos sont une surface d'attaque majeure. Toute image doit
  etre limitee en taille, validee cote serveur par type MIME et signature de
  fichier, decodee avec une librairie maintenue, reencodee dans un format
  controle, depouillee de ses metadonnees, stockee avec un nom genere et jamais
  servie depuis un chemin fourni par l'utilisateur. Refuser les SVG, fichiers
  polyglottes, archives et contenus executables.
- Les photos proposees par des utilisateurs simples restent non publiques tant
  qu'une moderation ne les a pas validees. Les moderateurs et administrateurs
  peuvent appliquer une photo directement, avec historique.
- Toute route qui modifie des donnees doit verifier explicitement
  l'authentification, le role, le bannissement eventuel et la validite de la
  charge utile.
- Les secrets, tokens OAuth, chaines de connexion et cles API doivent rester
  hors Git et passer par variables d'environnement.
- Prevoir des points reguliers d'etat du code : dette technique, zones a
  refactoriser, risques securite, tests manquants et complexite inutile.
- Pour tout nouveau developpement, eviter d'empiler toute la logique dans un
  seul fichier. Decouper des le depart en modules, composants, hooks, services
  ou utilitaires clairs quand cela aide la reprise future du code, sans creer
  d'abstraction prematuree.
- Refactoriser progressivement quand une zone devient confuse, avant qu'elle ne
  bloque les evolutions ou fragilise la securite.

# Avant chaque modification

- Lire `AGENTS.md`, `PLANS.md` et le fichier concerne.
- Pour toute vraie tache de developpement, initialiser Serena au debut de la
  session si cela n'a pas encore ete fait via `initial_instructions`.
- Pour l'exploration du code TypeScript backend/frontend, privilegier Serena
  avant les lectures shell brutes : activer le projet si necessaire, puis
  utiliser en priorite les outils semantiques et les memoires pertinentes.
- Reserver `rg`, `sed` et les lectures shell directes surtout aux fichiers non
  code, a la documentation, a la configuration, aux logs, a `git status`, a la
  recherche large, ou lorsque Serena n'a pas l'outil adapte.
- Pour les modifications fines dans un gros fichier, utiliser Serena si l'outil
  disponible aide reellement ; sinon utiliser `apply_patch`.
- Si Serena n'est pas utilisee pour une tache de code, l'indiquer explicitement
  dans un update avec la raison.
- Dans les updates de travail, indiquer clairement le statut d'usage de Serena,
  par exemple `Usage Serena : oui, pour reperer les symboles et limiter les
  lectures completes` ou `Usage Serena : non, car tache purement doc/config`.
- Verifier l'etat Git pour ne pas ecraser des changements utilisateur.
- Comprendre si la modification touche le produit, les donnees, la securite ou
  seulement la presentation.
- Identifier les risques securite de la modification avant d'ecrire le code.
- Pour toute fonctionnalite importante, mettre a jour ou consulter `PLANS.md`
  avant d'implementer.

# Apres modification

- Lancer les tests pertinents quand ils existent.
- Signaler clairement les tests non lances et pourquoi.
- Signaler les risques residuels, besoins de refactor ou tests manquants quand
  ils existent.
- Mettre a jour `PLANS.md` si la decision produit ou technique change.
- Garder les changements limites a la demande en cours.

# Plans

Le plan produit et technique vivant du projet est dans `PLANS.md`. Toute
implementation substantielle doit rester coherente avec ce document ou le mettre
a jour explicitement.
