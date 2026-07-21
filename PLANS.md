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
- Lien partageable vers une fiche personnage, ouvrant directement la vue graphe
  centree sur ce personnage avec sa fiche ouverte.
  L'URL publique utilise un slug lisible stable `prenom-nom`, avec suffixe
  numerote en cas de doublon, plutot qu'un identifiant technique. Ce slug est
  regenere automatiquement si le nom public du personnage change.
- Historique de fiche deplieable avec detail des champs modifies.
- Photo optionnelle de personnage, ajoutee uniquement via modification de fiche
  existante, avec upload securise et recadrage rond pour le graphe.
- Tags et relations typees.
- Import initial depuis Notion communautaire.
- Connexion Google OAuth, Discord OAuth et Twitch OAuth.
- Page profil utilisateur avec nom d'affichage public modifiable, historique de
  contributions et gestion des rattachements SSO.
- Demandes de modification moderees pour les utilisateurs simples.
- Demandes de creation de fiche moderees, declenchees depuis une recherche sans
  resultat satisfaisant pour reduire le risque de doublon.
- Modifications directes par moderateur ou administrateur, avec historique
  obligatoire.
- Roles utilisateur, moderateur, administrateur et utilisateur banni.
- Historique par fiche et historique global.
- Page contact, remerciements et soutien.

Hors MVP :

- Ingestion Discord automatisee.
- Synchronisation exhaustive automatisee des plateformes de streaming.
- Extraction officielle admin comme dependance obligatoire.
- Interface immersive ou direction visuelle fortement inspiree GTA.
- Application mobile native.
- Upload de photo lors de la creation initiale d'une fiche par utilisateur
  simple. La photo doit etre proposee apres existence de la fiche, via
  modification moderee, afin de limiter le spam.

## Parcours utilisateur

### Visiteur anonyme

1. Ouvre le site.
2. Recherche un personnage ou explore le graphe.
3. Selectionne un noeud.
4. Consulte la fiche detaillee.
5. Suit eventuellement le lien Twitch du streamer.

### Utilisateur connecte

1. Se connecte avec Google, Discord ou Twitch.
2. Choisit ou confirme un nom d'affichage public si necessaire.
3. Ouvre une fiche personnage.
4. Propose une correction ou un ajout.
5. Suit l'etat de sa demande depuis son profil.

Le nom d'affichage public est distinct du nom renvoye par Google ou par un
autre fournisseur SSO. L'objectif est de ne pas diffuser publiquement les noms
et prenoms personnels des utilisateurs.

Un moderateur ou administrateur qui modifie une fiche existante applique le
changement directement. Cette action ne cree pas de demande en attente, mais
elle doit produire le meme historique detaille qu'une demande acceptee.
Dans l'interface, cette action doit etre presentee comme `Modifier`, tandis que
les utilisateurs simples voient `Proposer`.

Si la recherche ne trouve aucun resultat satisfaisant, l'utilisateur connecte
peut proposer une nouvelle fiche depuis le panneau de recherche. L'interface
doit d'abord afficher les resultats proches ou l'absence de resultat, puis
presenter l'action de creation comme une demande moderee, pas comme une
publication directe.

L'ajout ou le remplacement d'une photo de personnage est reserve a la
modification d'une fiche existante. L'utilisateur uploade une image, la recadre
dans un masque rond et soumet la photo avec la modification. La photo ne devient
publique qu'apres validation moderateur, sauf modification directe par un
moderateur ou administrateur.

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
- Photo optionnelle, stockee comme fichier controle par le serveur, avec
  metadonnees de cadrage ou rendu final adapte au masque rond du graphe.
- Entreprise.
- Grade.
- Matricule.
- Un ou plusieurs numeros de telephone.
- Bloc medias distinct dans le formulaire d'edition, avec streamer existant,
  proposition de nouveau streamer si absent et liens publics du streamer.
- Streamer associe.
- Reseaux du streamer : Twitch, Kick, YouTube, Instagram, TikTok et Discord.
- Groupe et quartier.
- References vers les anciens personnages.
- Tags.
- Relations.
- Statut de verification.

Tous les champs sauf nom et prenom peuvent etre inconnus ou a verifier.

Le modele de fiche a ete simplifie pour les organisations : tous les metiers,
y compris police, medecine et autres institutions, passent par un trio de
champs facultatifs unifies `Entreprise / Grade / Matricule`. Les anciens
champs dedies type police ou role de groupe ne doivent pas revenir.

### Streamer

- Nom public.
- Lien Twitch.
- Liens Kick, YouTube, Instagram, TikTok et Discord si disponibles.
- Plateforme principale.
- Personnages associes.

### Tag

- Nom.
- Type optionnel : famille, quartier, organisation, entreprise, autre.
- Couleur d'affichage.
- Description optionnelle.

### CharacterRelationship

Les relations concernent strictement les personnages au sein du RP. Ne pas
modeliser ni afficher les relations reelles entre streamers.

Relations principales visibles par defaut dans le graphe :

- Parent.
- Enfant.
- Fratrie.
- Couple.

Relations secondaires visibles dans la fiche et masquees par defaut dans le
graphe :

- Ancien personnage.
- Ex-partenaire.
- Oncle.
- Tante.

La distinction passe par le modele persistant `character_relationships`, avec
une regle explicite de visibilite par type. Tous les types geres restent
saisissables dans la fiche et activables dans les preferences du graphe.

Les appartenances entreprise, quartier ou groupe restent des
champs de fiche ou des tags. Elles ne sont pas des relations du graphe public
MVP, afin de garder le graphe centre sur les liens narratifs forts.

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
couple et fratrie sont symetriques pour l'affichage, meme si elles sont
stockees une seule fois.

Dans l'edition d'une fiche, les parentes RP sont gerees dans un bloc dedie.
Tous les types principaux et secondaires peuvent etre saisis du point de vue du
personnage courant.

### ChangeRequest

- Utilisateur createur.
- Type de demande : modification d'une fiche existante ou creation d'une
  nouvelle fiche.
- Personnage concerne pour une modification ; nul tant que la creation d'une
  nouvelle fiche n'est pas acceptee.
- Snapshot complet de la fiche proposee.
- Contexte de recherche ayant mene a une demande de creation, afin d'aider les
  moderateurs a detecter les doublons.
- Difference calculee champ par champ a l'acceptation.
- Statut : en attente, acceptee, refusee.
- Commentaire moderateur obligatoire en cas de refus.
- Dates de creation et de resolution.

### ChangeHistory

- Personnage concerne.
- Liste des modifications appliquees champ par champ.
- Anciennes valeurs.
- Nouvelles valeurs.
- Acteur responsable de l'application du changement.
- Date de validation.

### User

- Identite interne.
- Email de contact issu du fournisseur SSO, non affiche publiquement.
- Nom d'affichage public choisi par l'utilisateur.
- Role et bannissement eventuel.
- Date de premiere connexion et derniere connexion.
- Indicateur demandant de choisir un nom public lorsque le profil vient d'etre
  cree ou lorsque le nom public est encore derive du fournisseur SSO.

### UserIdentity

- Utilisateur rattache.
- Fournisseur : Google, Discord ou Twitch.
- Identifiant fournisseur.
- Email ou nom renvoye par le fournisseur, conserve pour l'authentification mais
  non affiche publiquement.
- Dates de liaison et derniere utilisation.

## Architecture cible

### Backend

- `backend/` : API Express TypeScript.
- Sequelize pour les modeles et migrations.
- PostgreSQL pour la persistance.
- Validation des entrees cote API.
- Rate limit sur les demandes de modification.
- Gestion centralisee des erreurs.
- Separation des routes publiques, authentifiees, moderation et administration.
- Uploads images traites par des routes authentifiees dediees, avec limite de
  taille, rate limit specifique, validation forte, reencodage serveur et
  stockage hors des chemins fournis par l'utilisateur.

Familles de routes en place :

- consultation publique sous `/api/characters`, `/api/graph`, `/api/tags` et
  `/api/history` ;
- authentification sous `/api/auth` et profil sous `/api/profile` ;
- contribution sous `/api/contributions` ;
- moderation sous `/api/moderation` ;
- administration et imports Notion sous `/api/admin` ;
- supervision protegee sous `/api/supervision` et `/api/internal`.

### Frontend

- `web-client/` : application React avec Vite et TypeScript.
- Create React App est ecarte car deprecie. L'autre application CRA peut servir
  de reference React, mais pas de reference d'outillage pour ce nouveau projet.
- Vue principale en trois zones : barre de recherche/filtres, graphe, panneau
  fiche.
- Navigation secondaire vers historique, moderation, administration et contact.
- Page profil utilisateur dediee : modification du nom d'affichage public,
  liste des demandes et changements de l'utilisateur, fournisseurs SSO lies ou
  disponibles.
- Workflow photo personnage : upload, previsualisation, cadrage sous masque
  rond, zoom/deplacement, soumission avec la modification.
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
  sociaux, anciens personnages, organisation, relations et photos.
- Rapport des champs manquants ou ambigus.
- Rapport des relations detectees et des relations impossibles a relier
  automatiquement.
- Validation humaine avant publication des donnees importees.
- Vue d'administration dediee pour suivre les batches importes avec tri stable
  par nom, recherche textuelle et filtres sur l'etat d'application
  `a faire` / `appliquee`, afin de suivre les imports restants.

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
  l'exploration publique tout en restant dans le meme systeme visuel.
- Les pages moderation et administration doivent etre des pages pleines dediees
  avec une ergonomie back-office, pas des vues integrees au panneau lateral des
  fiches personnages.
- Priorite : lisibilite, recherche, comparaison et navigation rapide.
- Le graphe est un outil, pas une illustration.
- Eviter les heros marketing, les cartes decoratives et les effets visuels
  gratuits.
- Desktop prioritaire, mobile lisible avec graphe adapte ou panneau replie.

### Design public graphe-first

- L'arrivee visiteur doit mettre le graphe au premier plan : il occupe
  l'essentiel du viewport et reste le centre de gravite de l'interface.
- Le panneau de recherche et filtres est replie par defaut. Il reste accessible
  par une icone ou un bouton compact, puis s'ouvre en panneau plus large quand
  l'utilisateur veut rechercher ou filtrer.
- La fiche personnage est masquee par defaut. Elle apparait uniquement apres
  selection d'un noeud et doit pouvoir etre refermee pour revenir a un graphe
  grand format.
- La selection doit etre evidente par le style du noeud, de ses relations et
  par le contenu de la fiche. Eviter les libelles redondants comme
  `Selection : ...` dans une barre de supervision publique.
- Retirer de l'exploration publique les statistiques globales du type nombre
  de personnages, tags ou liens. Les reserver aux vues moderation et
  administration.
- Eviter les en-tetes de panneau non necessaires comme `Graphe narratif` ou
  `Vue complete` quand ils ne servent pas une action utilisateur directe.

## Securite et moderation

- Priorite absolue du projet : proteger le serveur contre les intrusions et les
  abus.
- Lecture publique uniquement pour les visiteurs anonymes.
- Connexion obligatoire pour proposer une modification.
- Un utilisateur banni ne peut plus creer de demande.
- Les changements proposes par des utilisateurs simples passent par validation
  moderateur. Les changements effectues par moderateur ou administrateur sont
  appliques directement mais doivent etre journalises.
- Les actions moderateur et administrateur doivent etre journalisees.
- Rate limit sur les demandes pour limiter le spam.
- Rate limit specifique sur les uploads de photos pour limiter le spam disque
  et les attaques par fichiers volumineux.
- Les donnees importees ou incertaines doivent etre marquees comme a verifier.
- Validation stricte des entrees cote serveur, autorisations verifiees sur
  chaque route sensible et absence de confiance implicite dans le frontend.
- Upload photo : taille maximale MVP fixee a 2 Mo par fichier ; formats
  acceptes JPEG, PNG et WebP uniquement ; validation
  par magic bytes et decode image ; refus des SVG ; suppression EXIF ;
  reencodage serveur vers un format controle ; noms de fichiers generes ;
  stockage temporaire avant moderation ; nettoyage des fichiers orphelins.
- Secrets et variables sensibles hors Git, configuration par variables
  d'environnement.
- Les moderateurs peuvent modifier directement une fiche, mais cette action doit
  creer le meme type d'historique detaille qu'une demande acceptee.
- Le premier compte reel cree sur une base sans utilisateur devient
  automatiquement administrateur ; les suivants recoivent le role utilisateur.

## Qualite de developpement

- Standards modernes : TypeScript strict, architecture lisible, composants
  reutilisables, validation des donnees, erreurs centralisees et tests
  proportionnes au risque.
- Faire des points reguliers sur l'etat du code : dette technique, besoins de
  refactor, risques securite, tests manquants et complexite accumulee.
- Pour les nouveaux developpements, ranger le code dans des fichiers dedies
  des que la lisibilite ou la reprise future le justifie : composants, hooks,
  services, constantes, utilitaires ou modules metier. Eviter les fichiers
  fourre-tout, tout en gardant les abstractions proportionnees au besoin.
- Prioriser les refactors qui reduisent un risque securite, clarifient les
  permissions ou simplifient la moderation.
- La validation globale mesure la couverture V8 sur tous les fichiers source
  TypeScript. Les seuils de non-regression partent des baselines du 2026-07-11 :
  backend `66 %` de lignes et frontend `78 %`, avec des seuils renforces sur les
  mutations et le service de demandes, l'upload photo, la moderation frontend
  et sa liste de demandes, les sessions persistantes, les clients OAuth Google,
  Discord et Twitch, le service d'authentification et ses rattachements SSO,
  les routes de contribution, le formulaire complet d'edition de personnage et
  la gestion administrative des tags, ainsi que les preferences et le cycle de
  vie Cytoscape du graphe. Une suite d'integration PostgreSQL isolee valide
  aussi les migrations, contraintes et rollbacks transactionnels contre le
  moteur reel. Elle exerce directement les invariants administratifs sensibles :
  protection du dernier administrateur, tags encore utilises, revocation de
  sessions, deliaison d'identites SSO, anonymisation et journal d'audit.

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

Statut : terminee le 2026-06-16.

- Backend Express TypeScript et frontend React/Vite initialises avec TypeScript
  strict, Biome, Vitest et gestion des variables d'environnement.
- Socle de securite backend en place : Helmet, CORS explicite, rate limits et
  gestion centralisee des erreurs.
- Scripts de developpement, checks, tests et builds documentes et fonctionnels.

### Etape 2 - Modele de donnees et base PostgreSQL

Statut : terminee le 2026-06-16.

- Schema PostgreSQL et modeles Sequelize principaux en place, avec migration
  initiale consolidee pour repartir sur une base neuve.
- Valeurs metier controlees par colonnes texte et contraintes `CHECK`, sans ENUM
  PostgreSQL natif.
- Commandes de creation, migration, reset avec ou sans seeds et runbook de base
  documentes.

### Etape 3 - API publique de consultation

Statut : terminee le 2026-06-17.

- Routes publiques de lecture disponibles pour les personnages, tags, graphe
  et historique.
- Recherche et filtres valides avec Zod, sans route publique d'ecriture.
- Reponse graphe structuree pour Cytoscape.js et couverte par les tests backend.

### Etape 4 - Interface publique et graphe

Statut : terminee le 2026-06-18.

- Experience publique graphe-first connectee a l'API, avec recherche repliee,
  filtres, selection, zoom/pan et mise en evidence des correspondances.
- Fiche personnage masquee avant selection, refermable et partageable par slug
  public lisible.
- Noeuds circulaires avec photo sans initiales superposees, ou initiales en
  fallback.
- Etats de chargement, erreur, vide et aucun resultat traites.

### Etape 5 - Authentification et autorisations

Statut : terminee le 2026-06-18.

- Authentification OAuth, sessions serveur par cookie `HttpOnly` et controles de
  roles centralises cote backend.
- Utilisateurs bannis bloques sur les routes protegees.
- Premier compte reel automatiquement administrateur sur une base vide.

### Etape 6 - Contribution et moderation

Statut : terminee le 2026-06-20.

- Demandes de creation et de modification avec snapshots valides, comparaison,
  acceptation ou refus commente et historique detaille.
- Utilisateurs simples soumis a moderation ; moderateurs et administrateurs
  appliquent directement leurs modifications avec historique.
- Pages pleines de contribution et moderation separees du panneau public.
- Doublons exacts nom/prenom bloques lors des creations.

### Etape 7 - Profil utilisateur et photos securisees

Statut : terminee le 2026-06-22.

- Identite SSO privee separee du nom d'affichage public choisi par
  l'utilisateur.
- Profil complet avec contributions, comptes lies et export personnel.
- Upload photo limite aux modifications de fiches existantes, avec recadrage,
  validation MIME/signature, reencodage WebP, suppression des metadonnees et
  moderation.
- Nettoyage periodique des brouillons photo par timer `systemd`.

### Etape 8 - Administration

Statut : terminee le 2026-06-22.

- Gestion protegee des utilisateurs, roles, bannissements et tags.
- Actions sensibles journalisees dans `admin_actions`.
- Suppression des tags utilises et retrait du dernier administrateur bloques.
- Erreurs metier admin traduites en messages frontend exploitables.

### Etape 9 - Import Notion

Statut : terminee le 2026-06-27.

- Scraping rejouable avec stockage brut, mapping et rapport sans publication
  automatique.
- Revue admin par fiche avec recherche, tri, suivi applique/non applique,
  application controlee et import photo securise apres application.
- Relations, streamers et liens publics mappes sans doublons symetriques ni
  perte des URL cibles Notion.
- Fixtures et tests couvrant le scraper, les mappings, les statuts de replay et
  les routes d'administration.

### Etape 10 - Durcissement qualite et securite

Statut : terminee le 2026-06-27.

- Sessions persistantes PostgreSQL avec expiration et nettoyage.
- Erreurs HTTP metier, validations et autorisations harmonisees.
- Services d'administration, changement de fiches et import Notion decoupes en
  modules plus lisibles.
- Scraper Notion renforce contre les erreurs transitoires `429`, `5xx` et
  reseau, avec couverture ciblee des chemins sensibles.

### Etape 11 - Preparation deploiement

Statut : terminee le 2026-07-01.

- Production sur `gta-rp.f1prediction.fr` avec Caddy, backend `systemd` et
  PostgreSQL Docker non expose publiquement.
- OAuth, uploads, import Notion et parcours metier principaux valides derriere
  proxy avec cookies `Secure`.
- VPS durci avec `ufw`, `fail2ban`, retention `journald` et maintenance systeme
  documentee.
- Sauvegardes PostgreSQL et uploads automatisees avec rotation, plus scripts de
  verification et de recuperation locale.
- Supervision Prometheus/Grafana deployee avec metriques systeme, application,
  donnees metier, stockage et sauvegardes.
- `DEPLOYMENT.md` reste la source de verite operationnelle detaillee.

### Etape 12 - SSO multiples et integrations plateformes

Statut : terminee le 2026-06-30.

- `UserIdentity` centralise les comptes Google, Discord et Twitch sans fusion
  implicite par email.
- Connexion, rattachement, dissociation et collisions d'identite geres avec
  protection du dernier moyen de connexion.
- Profil equipe d'actions SSO explicites et entree de connexion multi-fournisseur.
- Etat live Twitch calcule avec cache court et degradation silencieuse en cas
  d'indisponibilite de l'API.

### Etape 13 - Ameliorations fonctionnelles et ergonomie avancee

Statut : terminee le 2026-07-10. Lots A a G termines.

- Lot A : fiche et formulaire reorganises, organisation unifiee, photo corrigee
  et multi-telephone pris en charge de bout en bout.
- Lot B : relations principales et secondaires unifiees dans le modele,
  l'edition, la fiche publique, les preferences et l'import Notion.
- Lot C : vue de completude disponible en moderation et administration avec
  recherche, tri, filtres simples et actions vers les fiches. Le workflow
  collectif avance n'est pas retenu pour le moment.
- Lot D : preferences locales du graphe, affichage des personnages decedes,
  choix des relations, filtre Twitch live et dispositions `Entreprise`,
  `Famille`, `Groupe` et `Libre`.
- Lot E : `Streamer` source de verite unique pour les liens publics, partage
  entre plusieurs personnages, creation differee et import Notion coherent.
- Lot F : pages publiques information/contact et confidentialite accessibles
  depuis le graphe, sans integration Buy Me a Coffee dans le produit.
- Lot G : cadrage RGPD, registre et politique de confidentialite, export
  personnel, revocation des sessions, dissociation SSO et anonymisation admin.

### Etape 14 - Migration vers TypeScript 7 et npm 12

Statut : terminee le 2026-07-20.

Ces deux montees de version majeures doivent rester une passe technique dediee.
Elles ne doivent pas etre melangees a un lot fonctionnel afin de pouvoir
distinguer les regressions d'outillage des changements produit.

Plan propose :

1. Auditer les notes de migration TypeScript 7 et npm 12, ainsi que la
   compatibilite de Vite, Vitest, `tsx`, Sequelize, Express et des definitions
   `@types` utilisees.
2. Mettre a jour TypeScript simultanement dans `backend/` et `web-client/`, sans
   passer les definitions Node en version 26 tant que l'execution reste sur
   Node.js 24 LTS.
3. Passer le devcontainer a npm 12 et verifier explicitement les nouvelles
   politiques d'installation, la configuration `allowScripts`, les lockfiles
   et les installations natives de `sharp` et `esbuild`.
4. Revoir les deux configurations TypeScript et n'activer de nouvelles options
   strictes que lorsqu'elles correspondent a une decision explicite du projet.
5. Corriger les incompatibilites de compilation sans affaiblir le typage, sans
   contourner les erreurs avec des casts generiques ni masquer des diagnostics.
6. Verifier `npm install` et `npm ci`, puis les scripts de developpement,
   migrations, imports Notion, builds de production et tests backend/frontend
   avec la nouvelle chaine d'outillage.
7. Executer `scripts/run-all-checks.sh`, puis documenter les adaptations et les
   eventuels points de vigilance avant de considerer l'etape terminee.

Point de controle :

- Les builds backend et frontend passent sous TypeScript 7.
- Les installations reproductibles et les scripts autorises fonctionnent sous
  npm 12 sans relacher les protections du devcontainer.
- Tous les checks et tests existants restent verts.
- Node.js 24.18 LTS reste la version d'execution cible tant qu'une migration
  Node distincte n'a pas ete decidee et validee.
- Aucun changement fonctionnel ou de schema de donnees n'est introduit par
  cette etape technique.

Resultat :

- TypeScript `7.0.2` est configure dans les deux applications et les lockfiles
  ont ete regeneres avec npm `12.0.1`.
- Les installations propres, `sharp`, `esbuild`, Vite, les 205 tests backend,
  les 8 tests d'integration PostgreSQL, les 77 tests frontend, les checks Biome
  et les builds backend/frontend sont valides localement.
- Le devcontainer reconstruit utilise Node.js `24.18.0` et npm `12.0.1`.
- Le prefixe VPS isole `/opt/node-gta-rp` pointe vers `/opt/node-v24.18.0`,
  avec npm `12.0.1`.
- Les builds backend/frontend, le controle des migrations en attente, le
  redemarrage du backend et les smoke tests publics/SSH de production sont
  valides sur le VPS.
- L'ancien dossier `/opt/node-v24.16.0` a ete supprime apres verification que le
  service backend tourne sur `/opt/node-v24.18.0/bin/node`.

### Etape 15 - Refactor et nettoyage transversal

Statut : en cours depuis le 2026-07-20.

Cette etape restructure le code existant sans changement fonctionnel, visuel ou
de schema. La generalisation a d'autres serveurs et sources d'import est
volontairement reportee a l'etape 17 afin de ne pas melanger nettoyage interne
et nouvelles abstractions produit.

Plan propose, par ordre de priorite :

1. Stabiliser une baseline reproductible apres l'etape 14 : commit dedie,
   installations propres, checks, tests, couvertures, integration PostgreSQL et
   builds. Ajouter des tests de caracterisation avant tout deplacement de logique
   insuffisamment couverte.
2. Installer les garde-fous de structure : detection des fichiers, exports et
   dependances inutilises avec `Knip`, controle des cycles et des frontieres de
   couches, puis revue obligatoire des modules de production depassant environ
   400 lignes. Les migrations, fichiers generes et grosses fixtures restent des
   exceptions explicites.
3. Centraliser les contrats partages dans un package independant de React,
   Express et Sequelize : DTO publics, enums, erreurs API et snapshots. Etudier
   puis adopter npm workspaces uniquement si les installations et le deploiement
   VPS restent simples et reproductibles.
4. Decouper le backend par domaine : un fichier par modele Sequelize,
   initialisation et associations separees, administration repartie entre
   utilisateurs, RGPD, tags et dashboard, service public separe entre requetes,
   graphe, historique et serializers, puis routes alignees sur ces domaines.
   La migration initiale reste autonome et n'est pas decoupee pour une simple
   contrainte de taille.
5. Decouper le frontend : remplacer le fichier API central par des modules HTTP,
   public, authentification, profil, moderation, administration et Notion ;
   extraire les sections et la gestion d'etat du formulaire personnage ; reduire
   les orchestrateurs `App`, profil et administration sans modifier leurs
   parcours.
6. Exploiter progressivement les controles utiles de TypeScript 7 :
   `verbatimModuleSyntax`, `exactOptionalPropertyTypes`,
   `noUncheckedSideEffectImports`, `noPropertyAccessFromIndexSignature` et
   `erasableSyntaxOnly`. Utiliser `satisfies`, les unions discriminees et les
   structures `readonly` lorsque cela clarifie effectivement les contrats.
7. Supprimer le code et les dependances devenus inutiles, verifier les frontieres
   public/prive et les autorisations, adapter les tests extraits, puis executer
   la validation globale sans baisse des seuils de couverture.

Point de controle :

- Aucun changement fonctionnel, visuel, d'API publique ou de schema n'est
  introduit par le refactor.
- Les modules ont une responsabilite identifiable ; tout gros fichier restant
  dispose d'une justification claire plutot que d'un decoupage artificiel.
- Aucun export, fichier ou paquet inutilise et aucun nouveau cycle de dependance
  ne subsiste.
- Les contrats frontend/backend ne divergent plus silencieusement.
- Tous les checks, tests, integrations et builds restent verts.

Avancement :

- Baseline du 2026-07-20 verte avec `scripts/run-all-checks.sh` : 214 tests
  backend, 8 tests d'integration PostgreSQL, 83 tests frontend, couvertures et
  builds backend/frontend valides.
- Un script d'audit structurel `scripts/audit-structure.sh` permet de lancer
  Knip en mode rapport et Madge en detection de cycles sans ajouter de
  dependance au repo pour l'instant.
- Premier audit structurel : aucun cycle backend ou frontend detecte. Knip
  remonte des exports inutilises ou trop largement exposes, notamment dans les
  modeles Sequelize, `web-client/src/api.ts`, `backend/src/services/admin.ts`
  et plusieurs helpers internes.
- Premiere passe de nettoyage : les exports internes evidents ont ete rendus
  prives, le code mort confirme par TypeScript a ete supprime et les reexports
  inutiles ont ete retires. Knip ne remonte plus d'export inutilise backend ou
  frontend, et Madge ne detecte toujours aucun cycle.
- Les modeles Sequelize ont ete decoupes par domaine : classes, initialisation
  et associations sont separees entre identite, personnages, imports Notion,
  demandes de changement et helpers partages. `backend/src/db/models/index.ts`
  reste le point d'entree compatible et ne fait plus que coordonner
  l'initialisation et le registry.
- La gestion administrative des tags a ete extraite de
  `backend/src/services/admin.ts` vers un service dedie, tout en conservant la
  facade `AdminService` utilisee par les routes.
- Les actions administratives utilisateur ont ete sorties de la facade
  principale et reparties entre services dedies : export RGPD, sessions et
  identites, droits d'acces, bans et tags.
- Des tests de caracterisation ciblent les services admin extraits afin que la
  couverture globale reste stable apres refactor. La validation globale
  `scripts/run-all-checks.sh` reste verte apres cette salve.
- Les contrats et serializers publics ont ete extraits de
  `backend/src/services/public-data.ts` vers un module dedie afin de separer la
  serialisation des requetes Sequelize publiques. Les checks, tests et builds
  backend/frontend restent verts ; les tests d'integration PostgreSQL exigent
  toujours une base joignable dans l'environnement courant.
- La construction du graphe public a ete extraite vers un service dedie afin de
  separer la generation Cytoscape, la deduplication des relations et les
  requetes de consultation de fiches.
- Le fichier frontend `web-client/src/api.ts` a ete allege en separant les
  contrats TypeScript (`api-types.ts`) et la couche HTTP commune
  (`api-client.ts`), tout en conservant la facade d'exports existante pour les
  composants.
- Le formulaire d'edition de fiche a ete allege en extrayant les blocs
  `Contact` / `Relations` et `Medias` vers des composants dedies. Les tests
  couvrent les champs restants du formulaire parent ainsi que les composants
  extraits, sans baisse des seuils de couverture.
- La vue d'exploration publique a ete extraite de `web-client/src/App.tsx` vers
  `ExploreView`, afin de separer la composition recherche/graphe/fiche de
  l'orchestration globale des vues.
- La page profil a ete decoupee en sections dediees pour l'identite publique,
  les comptes lies/export RGPD et les demandes utilisateur. Des tests dedies
  couvrent ces sections en complement des parcours `App`.
- La page administration a ete allegee en extrayant la logique de chargement,
  actions utilisateur, tags, export RGPD et rafraichissement dans
  `useAdminViewState`. `AdminView` redevient une composition de panneaux avec
  les controles d'acces visibles.
- La vue de contribution a ete legerement clarifiee en extrayant le panneau
  lateral `Mes demandes`, sans deplacer le flux metier de soumission ni l'upload
  photo.
- Le warning d'integration PostgreSQL lie a `pg@9` reste un point de vigilance
  connu, sans regression bloquante actuelle.

### Etape 16 - Finalisation UX de l'application et du graphe

Statut : planifiee apres les stabilisations fonctionnelles et techniques des
etapes 13 a 15.

Cette etape regroupe les finitions visuelles et ergonomiques qui ne doivent pas
ralentir les derniers lots fonctionnels. Elle ne doit pas modifier le contrat
metier ni introduire de nouveau schema de donnees.

Plan propose :

1. Realiser un audit UX transversal sur ordinateur et mobile : navigation,
   hierarchie visuelle, alignements, densite, formulaires, tableaux, panneaux,
   modales, chargements, etats vides, erreurs et confirmations.
2. Finaliser l'UX du graphe : lisibilite des presets `Entreprise`, `Famille`,
   `Groupe` et `Libre`, separation des grappes, chevauchements, labels,
   centrage sur une fiche partagee, zoom initial et comportement responsive.
3. Harmoniser les panneaux publics autour du graphe : recherche, filtres,
   preferences d'affichage et fiche personnage, avec des actions compactes et
   coherentes qui preservent au maximum la surface du graphe.
4. Revoir les parcours profil, contribution, moderation, administration et
   import Notion afin d'unifier les espacements, controles, messages et actions
   principales sans reduire la densite utile de ces interfaces.
5. Effectuer une passe d'accessibilite : navigation clavier, focus visible,
   libelles accessibles des boutons icones, contrastes, tailles de cibles et
   comportement lorsque les animations sont reduites.
6. Ajouter les tests frontend pertinents et une validation visuelle avec des
   captures Playwright sur plusieurs tailles d'ecran, en portant une attention
   particuliere aux debordements et aux chevauchements.
7. Executer la validation complete backend/frontend et documenter les choix UX
   stabilises avant de clore l'etape.

Point de controle :

- Le graphe reste l'element principal de la premiere vue publique.
- Les dispositions du graphe sont lisibles avec une volumetrie proche de la
  production, sur ordinateur comme sur mobile.
- Aucun panneau, formulaire ou message ne provoque de debordement horizontal ou
  de chevauchement incoherent.
- Les parcours publics et authentifies restent fonctionnels au clavier et
  conservent des contrastes suffisants.
- Tous les checks, tests et builds existants restent verts.

### Etape 17 - Declinaison par serveur et sources d'import

Statut : planifiee en dernier, apres le refactor transversal et la finalisation
UX.

Cette etape rend le projet reutilisable par d'autres communautes GTA-RP sans
introduire une architecture multi-tenant. Chaque deploiement reste une instance
autonome configuree pour un serveur donne ; Flashback devient un profil et un
adaptateur fournis par le projet, pas une hypothese du coeur applicatif.

Plan propose :

1. Definir une configuration d'instance publique et typee : identifiant, nom du
   serveur, marque, contact, depot, liens et preferences initiales. La servir par
   l'API sans exposer de secret et retirer les valeurs compilees en dur du client.
2. Deplacer les valeurs Flashback dans un profil d'instance selectionne par la
   configuration, y compris l'URL Notion par defaut. Parametrer aussi les scripts
   d'exploitation, le domaine et la supervision sans perdre le runbook reel du
   deploiement actuel.
3. Separer le scraper Notion generique du mapping Flashback V6 et introduire un
   contrat d'adaptateur de source couvrant collecte, mapping, rapport et
   application.
4. Implementer l'adaptateur Flashback V6 avec les alias, relations et statuts
   existants, tout en conservant le stockage brut, la validation humaine et les
   protections contre les doublons dans le coeur commun.
5. Ajouter un profil fictif et un adaptateur minimal de test prouvant qu'une
   instance peut demarrer, afficher son identite et importer des donnees sans
   aucune dependance implicite a Flashback.
6. Documenter la creation d'une nouvelle instance et valider installation,
   configuration, import, tests, build et deploiement sur les deux profils.

Point de controle :

- Le coeur metier ne contient plus de valeur ou de branche specifique a
  Flashback ; ces choix sont concentres dans son profil ou son adaptateur.
- Ajouter un serveur ou une source ne demande pas de modifier les services et
  composants generiques.
- Les secrets restent exclusivement cote serveur et hors Git.
- L'instance Flashback conserve exactement son comportement actuel.
- Tous les checks, tests, integrations et builds restent verts.

## Ameliorations possibles

Ces sujets sont volontairement hors des etapes actuellement planifiees. Ils ne
bloquent ni la cloture des etapes 1 a 13 ni les travaux planifies des etapes 14
a 17.

### Moderation et qualite des donnees

- Ajouter dans la vue de completude un statut `en cours de traitement`, des
  filtres experts et une orchestration collective du rattrapage si le volume ou
  le nombre de moderateurs le justifie.
- Detecter les doublons de personnages par similarite, en complement du blocage
  exact nom/prenom deja applique a la creation.
- Permettre eventuellement aux contributions de proposer des changements de
  tags, avec des validations dediees pour eviter les suppressions implicites.
- Introduire un type persistant explicite pour le champ Notion ambigu
  `Est oncle/tante` uniquement si un besoin metier fiable permet de choisir la
  direction et le type corrects.

### Performance et graphe

- Surveiller la volumetrie de `/api/characters/matches` et paginer ou indexer
  davantage si les donnees ou le trafic augmentent fortement.
- Reevaluer `Sigma.js` avec `Graphology` uniquement si Cytoscape.js devient une
  limite mesurable sur des graphes proches de la volumetrie de production.

### Import Notion et robustesse technique

- Etendre, si necessaire, les tests d'integration PostgreSQL maintenant en place
  au pipeline image reel et aux parcours transactionnels qui presenteront un
  risque metier mesurable.
- Surveiller les changements externes de structure, d'URL d'image et de
  politique de rate-limit Notion ; conserver les erreurs visibles et le
  workflow de validation humaine.
- Poursuivre le decoupage des services Notion ou la mutualisation des erreurs
  frontend uniquement si ces zones recommencent a grossir.
- Surveiller l'avertissement de compatibilite `pg` emis par le rollback de la
  migration initiale dans l'implementation interne Sequelize de `dropTable`,
  avant toute future montee majeure vers `pg` 9.

### Exploitation et conservation

- Ajouter une cible de sauvegarde distante hors VPS lorsque le stockage externe
  retenu sera disponible ; utiliser entre-temps le script de recuperation
  locale documente dans `DEPLOYMENT.md`.
- Ajouter une configuration Caddy multi-domaines uniquement si un second
  domaine public devient necessaire.
- Ajouter un alerting externe email ou Discord sur les signaux critiques de la
  supervision lorsque le canal operationnel sera choisi.
- Automatiser, apres validation des regles de conservation, la purge des comptes
  inactifs, demandes anciennes, historiques d'administration et imports
  editoriaux. Les durees cibles restent documentees dans `PRIVACY.md` et
  `DEPLOYMENT.md`.

## Hypotheses et contraintes persistantes

- La page Notion communautaire reste une source externe non officielle dont la
  structure, l'accessibilite et les limites peuvent changer sans preavis.
- Google, Discord et Twitch restent dependants de leurs services OAuth et de
  leurs limites d'API respectives.
- Le developpement et la production restent sur Node.js `24.18.0` LTS tant
  qu'une migration Node distincte n'a pas ete decidee.
- Le deploiement GTA-RP partage le VPS avec `f1prediction.fr` et ne doit pas
  perturber ses ports, services ou configuration Caddy.
- Toute nouvelle collecte de donnees personnelles ou ajout de traceur client
  doit declencher une nouvelle revue RGPD et cookies.
