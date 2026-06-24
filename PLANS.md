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
- Connexion Google OAuth.
- Page profil utilisateur avec nom d'affichage public modifiable, historique de
  contributions et emplacement prevu pour les futurs rattachements SSO.
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
- Parsing Twitch automatise.
- Extraction officielle admin comme dependance obligatoire.
- Interface immersive ou direction visuelle fortement inspiree GTA.
- Application mobile native.
- Upload de photo lors de la creation initiale d'une fiche par utilisateur
  simple. La photo doit etre proposee apres existence de la fiche, via
  modification moderee, afin de limiter le spam.
- Connexion et rattachement multi-SSO au-dela de Google : Discord et Twitch
  sont prevus plus tard comme fournisseurs supplementaires rattachables depuis
  la page profil.
- Etat live Twitch dans les fiches personnage. Cette integration sera traitee
  avec le futur SSO Twitch afin de mutualiser la configuration Twitch, les
  secrets serveur et la gestion des limites d'API.

## Parcours utilisateur

### Visiteur anonyme

1. Ouvre le site.
2. Recherche un personnage ou explore le graphe.
3. Selectionne un noeud.
4. Consulte la fiche detaillee.
5. Suit eventuellement le lien Twitch du streamer.

### Utilisateur connecte

1. Se connecte avec Google.
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
- Echelon entreprise.
- Matricule entreprise.
- Telephone.
- Bloc medias distinct dans le formulaire d'edition, avec streamer existant,
  proposition de nouveau streamer si absent, photo et liens publics.
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

Extension future a prevoir :

- Relation `ancien personnage` ou equivalente pour rattacher plusieurs fiches
  au meme joueur quand la source communautaire le permet, par exemple via le
  champ Notion `V6`.
- D'autres types de relations pourront exister uniquement dans la fiche
  personnage, sans etre affiches dans le graphe public. Le modele devra donc
  distinguer a terme les relations visibles sur le graphe et les relations
  informatives reservees a la fiche.
- Cette distinction doit passer par le modele persistant `character_relationships`
  avec une regle explicite par type : certaines relations sont stockees,
  exposees dans la fiche et deliberement exclues du graphe public.

Les appartenances metier, police, quartier, organisation ou groupe restent des
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
L'utilisateur, le moderateur ou l'administrateur editent la relation du point
de vue du personnage courant : `Parent`, `Enfant`, `Fratrie`, `Couple`.

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
- Moderateur responsable.
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
- Fournisseur : Google au MVP, Discord et Twitch plus tard.
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

Routes a prevoir :

- `GET /api/characters`
- `GET /api/characters/directory`
- `GET /api/characters/:id`
- `GET /api/graph`
- `GET /api/streamers`
- `GET /api/tags`
- `GET /api/history`
- `GET /api/me`
- `PATCH /api/me/profile`
- `GET /api/me/change-requests`
- `GET /api/me/identities`
- `POST /api/contributions/change-requests`
- `POST /api/contributions/change-requests/character-creations`
- `POST /api/contributions/characters/:id/photo-drafts`
- `GET /api/contributions/change-requests`
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
- Le premier administrateur sera promu manuellement en base.

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
  Biome, tests, gestion des variables d'environnement et structure de couches.
- Initialiser `web-client/` avec Vite, React et TypeScript.
- Ajouter une configuration commune minimale : scripts npm, `.env.example`,
  formatage/lint via Biome et documentation de lancement.
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

- `db:ensure`, migrations, seeds, checks Biome, tests et build backend valides.
- La migration initiale evite les ENUM PostgreSQL natifs au profit de colonnes
  texte avec contraintes `CHECK`, pour conserver les valeurs controlees sans
  declencher le warning de depreciation `pg` observe avec Sequelize.
- `DEPLOYMENT.md` documente le runbook initial de mise en production, incluant
  creation de base, migrations, sauvegardes et rollback.

### Etape 3 - API publique de consultation

Statut : terminee le 2026-06-17.

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

Bilan :

- Routes `GET /api/characters`, `GET /api/characters/:id`, `GET /api/tags`,
  `GET /api/graph` et `GET /api/history` ajoutees.
- Recherche et filtres publics valides cote API avec Zod.
- Structure graphe retournee au format exploitable par Cytoscape.js.
- Tests backend ajoutes sur recherche, filtres, fiche, graphe, tags, historique
  et erreurs de validation.
- Validation faite sur base PostgreSQL seedee : personnages, tags, graphe,
  historique, filtres texte/UUID et erreurs de validation repondent comme
  attendu.
- Aucune route publique d'ecriture n'est exposee ; les checks Biome, tests et
  build backend passent apres correction du filtrage texte/UUID.

### Etape 4 - Interface publique et graphe

Statut : terminée le 2026-06-18.

- Construire la vue principale dark mode : recherche/filtres, graphe
  Cytoscape.js, panneau lateral de fiche.
- Implementer selection, zoom/pan, survol, mise en evidence des resultats et
  filtres persistants.
- Construire la fiche personnage avec informations, reseaux, relations, tags,
  statut de verification et historique.
- Ajouter les états chargement, erreur, vide et aucun résultat.

Point de controle :

- Le parcours visiteur anonyme est utilisable de bout en bout.
- Le graphe reste lisible sur desktop. Le mobile doit rester utilisable, mais
  le focus principal du MVP public est l'expérience PC.
- Le style dark terminal bleu est cohérent et moderne.

Bilan intermediaire :

- Vue publique connectée à l'API réelle avec recherche, filtres persistants,
  graphe Cytoscape.js et panneau de fiche.
- Sélection, zoom/pan natif Cytoscape.js, survol et mise en évidence des
  résultats de recherche implémentés. Les résultats sont portés par le graphe :
  les correspondances sont mises en évidence, les non-correspondances sont
  atténuées, et le panneau de recherche affiche seulement un texte de synthèse
  avec le nombre de résultats, sans liste détaillée.
- Fiche personnage avec informations principales, streamer, tags, relations,
  réseaux, statut de vérification et historique public.
- États chargement, erreur, vide et aucun résultat ajoutés ; tests, checks Biome et
  build frontend passent.
- Refonte graphe-first engagée : le graphe occupe le viewport, la recherche est
  repliée par défaut, la fiche est masquée avant sélection et refermable, les
  statistiques publiques et libellés de supervision du graphe ont été retirés.
- Les nœuds personnages sont circulaires avec initiales quand aucune photo
  n'est renseignee. Quand une photo validee existe, elle remplace les initiales
  dans le noeud du graphe.
- La sélection d'un nœud est réversible par un second clic, sans recadrer le
  graphe à la désélection. Le layout du graphe ne se relance plus lors des
  changements de recherche.
- Les relations du graphe public sont limitées au noyau parent, enfant,
  fratrie et couple ; les appartenances métier, police, quartier ou groupe
  restent des champs de fiche ou des tags.
- La recherche du graphe utilise un endpoint dédié `/api/characters/matches`
  qui renvoie tous les IDs correspondants, sans dépendre du `limit=100` de la
  future liste paginée.
- Les champs de recherche déclenchent les correspondances avec un debounce de
  300 ms côté frontend pour éviter une requête API à chaque caractère.
- `App.tsx` reste à surveiller sur sa taille : extraire la logique de recherche
  ou de chargement si l'étape 5 ou 6 alourdit encore le composant.

Clôture :

- Validation visuelle PC jugée satisfaisante pour le MVP actuel.
- L'accessibilité clavier de navigation dans les résultats reste une amélioration
  future, non bloquante à ce stade.
- La volumétrie de `/api/characters/matches` reste un point de vigilance
  technique informatif, pas un blocage de clôture.

### Etape 5 - Authentification et autorisations

Statut : terminée le 2026-06-18.

- Ajouter Google OAuth cote backend.
- Utiliser une session serveur avec cookie `HttpOnly` pour l'application web,
  plutot qu'un jeton sensible stocke cote frontend.
- Implementer les roles utilisateur, moderateur, administrateur et banni.
- Proteger toutes les routes sensibles cote serveur, sans confiance implicite
  dans le frontend.
- Prevoir la promotion manuelle du premier administrateur en base.

Plan propose :

- Ajouter la configuration d'authentification dans l'environnement backend :
  variables Google OAuth, secret de session, URL de callback et liste d'origines
  autorisees.
- Installer et brancher la session Express avec cookie `HttpOnly`, `SameSite`
  et configuration `secure` selon l'environnement.
- Integrer Google OAuth cote backend avec creation ou recuperation de
  l'utilisateur local, rattachement du role par defaut `user` et refus explicite
  des comptes bannis.
- Exposer les routes d'authentification minimales pour le frontend public :
  `GET /auth/session`, `GET /auth/google`, `GET /auth/google/callback`,
  `POST /auth/logout`.
- Ajouter un middleware serveur central pour lire l'utilisateur courant, verifier
  l'authentification, le role minimal et le bannissement.
- Appliquer ce middleware sur les futures routes de contribution, moderation et
  administration, meme si leurs pages arrivent plus tard.
- Ajouter les tests backend sur session, login, logout, refus d'utilisateur
  banni et controle de role.
- Documenter le flux d'authentification MVP et la procedure de promotion
  manuelle du premier administrateur.

Bilan intermediaire :

- Session Express backend ajoutee avec cookie `HttpOnly`, nom configurable et
  mode `secure` reserve a la production pour rester compatible avec le
  developpement local.
- Flux Google OAuth backend pose : demarrage `/api/auth/google`, callback
  `/api/auth/google/callback`, session courante `/api/auth/session`, logout
  `/api/auth/logout`.
- Integration utilisateur locale en base preparee autour de `User`, `Role` et
  `Ban`, avec creation ou mise a jour de l'utilisateur a partir de l'identite
  Google.
- Middleware backend de lecture de session, utilisateur courant, verification
  d'authentification et controle de role prepare pour les futures routes
  protegees.
- Premiers espaces backend proteges ajoutes pour valider les autorisations :
  `/api/contributions/session`, `/api/moderation/session` et
  `/api/admin/session`, avec controle respectif utilisateur connecte,
  moderateur ou administrateur.
- Tests backend ajoutes sur session anonyme, demarrage OAuth, callback valide,
  refus de callback invalide, utilisateur banni, logout et controle de role.
- Frontend branche sur la session : bouton `Connexion Google`, affichage du
  compte connecte, deconnexion et feedback apres redirection OAuth.
- Documentation locale ajoutee pour le flux de connexion, et procedure de
  promotion du premier administrateur documentee dans le runbook de deploiement.

Vigilances restantes :

- Promouvoir le premier administrateur reel quand les pages admin deviennent
  utiles.
- Verifier les espaces proteges avec de vrais comptes de role different lorsque
  les ecrans contribution, moderation et administration existeront.

Point de controle :

- Un utilisateur connecte est identifie correctement.
- Les roles sont verifies par le backend.
- Un utilisateur banni ne peut pas contribuer.

### Etape 6 - Contribution et moderation

Statut : terminee le 2026-06-20.

- Implementer les demandes de modification sur snapshot complet de fiche.
- Implementer les demandes de creation de fiche depuis une recherche sans
  resultat satisfaisant, avec stockage du contexte de recherche et passage par
  la meme file de moderation.
- Calculer le diff champ par champ a l'acceptation.
- Creer l'historique detaille pour chaque demande acceptee.
- Construire les pages pleines de moderation : liste, detail, comparaison,
  acceptation et refus avec commentaire obligatoire.
- Permettre aux moderateurs d'editer directement une fiche tout en creant le
  meme historique detaille.

Bilan final :

- Service backend de demandes de modification ajoute avec validation stricte du
  snapshot de fiche `Character`, calcul de diff champ par champ, approbation en
  transaction Sequelize, refus avec commentaire et edition directe moderateur.
- Routes protegees ajoutees : creation et suivi utilisateur sous
  `/api/contributions/change-requests`, file de moderation, detail,
  acceptation, refus et edition directe sous `/api/moderation`.
- Les snapshots acceptent uniquement une allowlist de champs de fiche. Les
  champs serveur, roles, historiques, relations et tags ne sont pas modifiables
  via ce flux.
- Frontend ajoute : page contribution depuis une fiche selectionnee, page pleine
  de moderation separee du panneau public, comparaison des champs modifies,
  acceptation, refus commente obligatoire et formulaire d'edition directe.
- Les modifications de fiche existante faites par moderateur ou administrateur
  depuis le formulaire de contribution sont appliquees directement avec
  historique, sans passer par une demande en attente.
- La fiche personnage affiche un bouton adapte au role : `Proposer` pour les
  utilisateurs simples, `Modifier` pour moderateur ou administrateur.
- L'historique de fiche est deplieable et affiche les champs modifies avec
  libelles lisibles et anciennes/nouvelles valeurs.
- La navigation des vues pleines a ete simplifiee : le retour au graphe passe
  par la topbar globale, sans bouton `Retour au graphe` duplique dans le
  contenu.
- Creation de fiche ajoutee au flux de contribution : depuis une recherche sans
  resultat, un utilisateur connecte peut proposer une fiche candidate, stockee
  comme demande de creation et publiee uniquement apres validation moderateur.
  Le backend bloque les doublons exacts nom/prenom et conserve le contexte de
  recherche pour aider la moderation.

Points reportes ou a surveiller :

- Les tags ne sont pas encore modifiables par ce flux. Ils restent hors
  perimetre de cette etape et devront etre ajoutes avec des validations dediees
  pour eviter les incoherences et les suppressions implicites.
- Les doublons exacts nom/prenom sont bloques cote serveur pour les creations,
  mais les doublons approximatifs restent a traiter par l'interface et par la
  moderation jusqu'a l'ajout d'une recherche de similarite plus fine.
- Ajouter des tests d'integration service contre base quand l'environnement de
  test pourra ecrire les fichiers temporaires Vitest/Vite.

Point de controle :

- Le workflow contribution -> moderation -> historique fonctionne.
- Les refus demandent un commentaire.
- Les pages moderation sont separees du panneau lateral public.
- Les modifications de fiches existantes faites par moderateur ou
  administrateur sont appliquees directement avec historique.
- Les creations de fiches restent moderees et ne publient rien sans validation.

### Etape 7 - Profil utilisateur et photos securisees

Statut : terminee le 2026-06-22.

- Ajouter ou ajuster le modele utilisateur pour distinguer l'identite SSO du
  nom d'affichage public.
- Proposer le choix du nom d'affichage public a la premiere connexion lorsque le
  compte vient d'etre cree ou que le nom public est encore derive du SSO.
- Construire une page profil pleine dediee permettant de modifier le nom
  d'affichage public.
- Afficher dans le profil la liste des demandes et changements effectues par
  l'utilisateur.
- Preparer la structure de rattachement multi-SSO sans implementer encore
  Discord ni Twitch.
- Ajouter le workflow photo personnage uniquement depuis une modification de
  fiche existante : upload, recadrage rond, previsualisation et soumission.
- Securiser fortement l'upload : taille maximale, formats autorises, validation
  par signature, reencodage serveur, suppression EXIF, stockage temporaire,
  nettoyage des fichiers orphelins, rate limit specifique et tests de refus.
- Integrer la photo validee dans la fiche et dans les noeuds du graphe avec un
  cadrage rond stable.

Point de controle :

- Aucun nom/prenom issu d'un fournisseur SSO n'est expose publiquement par
  defaut.
- Un utilisateur peut changer son nom d'affichage public depuis son profil.
- Les photos ne peuvent pas etre proposees pendant la creation d'une fiche.
- Une photo proposee par un utilisateur simple n'est publique qu'apres
  validation moderateur.
- Les fichiers invalides, trop volumineux, SVG ou non-images sont rejetes cote
  serveur.

Bilan final :

- Le backend ne synchronise plus le nom d'affichage public depuis Google a
  chaque connexion. Les nouveaux comptes recoivent un pseudonyme local et
  doivent choisir explicitement leur nom public.
- Une migration ajoute `display_name_chosen_at` et pseudonymise les comptes
  existants qui n'ont pas encore de nom public confirme.
- Une route protegee `/api/profile` permet de lire le profil et de modifier le
  nom public avec validation serveur.
- Le frontend ajoute une page pleine Profil, accessible depuis la topbar,
  ouverte automatiquement quand l'utilisateur doit choisir son nom public.
- Le profil affiche les demandes de contribution de l'utilisateur et prepare
  l'emplacement des futurs rattachements SSO Google, Discord et Twitch.
- L'etat live Twitch reste volontairement reporte a l'etape future dediee aux
  SSO multiples et aux integrations de plateformes.
- Le workflow photo de fiche existante est ajoute : recadrage rond cote
  frontend, upload temporaire authentifie, validation MIME/signature, decodage
  et reencodage WebP via `sharp`, stockage interne temporaire puis promotion en
  fichier public uniquement apres validation moderateur ou modification directe.
- Dans le graphe public, une photo validee remplace les initiales du noeud :
  les initiales ne sont affichees que pour les personnages sans photo.
- Les creations de fiche ne peuvent toujours pas porter de photo, afin de
  limiter le spam de stockage.
- Le nettoyage des photos temporaires orphelines est gere par un job dedie
  `npm run photo:cleanup`, prevu pour etre lance periodiquement par PM2 avec
  `cron_restart`.
- Des tests backend couvrent maintenant les principaux refus d'upload photo :
  SVG, signature invalide, MIME incoherent, image illisible et payload trop
  volumineux. Un test frontend verrouille aussi le comportement du graphe :
  photo presente => aucune initiale affichee dans le noeud.

### Etape 8 - Administration

Statut : terminee le 2026-06-22.

- Construire les pages pleines d'administration.
- Ajouter gestion des tags : creation, modification, suppression controlee.
- Ajouter gestion des roles : promotion, retrait, bannissement.
- Journaliser les actions sensibles.
- Ajouter tests backend sur permissions, bannissements et actions admin.

Plan propose :

- Backend administration :
  - ajouter un service admin dedie pour centraliser les changements de tags,
    roles et bannissements ;
  - exposer les routes protegees administrateur sous `/api/admin` :
    `GET /users`, `PATCH /users/:id/role`, `POST /users/:id/ban`,
    `DELETE /users/:id/ban`, `POST /tags`, `PATCH /tags/:id` et
    `DELETE /tags/:id` ;
  - valider toutes les charges utiles avec Zod et refuser explicitement les
    roles, types de tags ou couleurs invalides ;
  - empecher les actions dangereuses evidentes, par exemple supprimer un tag
    encore rattache a des personnages sans strategie claire, ou retirer le
    dernier administrateur actif.
- Journalisation :
  - creer un journal d'actions administratives distinct des historiques de
    fiches personnage ;
  - enregistrer l'acteur, la cible, le type d'action, les anciennes/nouvelles
    valeurs utiles et la date ;
  - relier les actions directes de moderation ou d'administration au profil de
    l'utilisateur concerne quand c'est pertinent, afin de corriger le manque
    identifie a la fin de l'etape 7.
- Frontend administration :
  - ajouter une page pleine `Administration`, accessible uniquement aux
    administrateurs via la navigation globale ;
  - separer les vues en sections compactes : utilisateurs, roles/bannissements,
    tags et journal ;
  - conserver le style data-app sobre, sans bouton redondant de retour au
    graphe dans le contenu ;
  - afficher les erreurs d'autorisation ou de validation sans exposer de detail
    technique.
- Tests et securite :
  - tester les refus utilisateur simple/moderateur sur toutes les routes admin ;
  - tester promotion, retrogradation, bannissement, levee de bannissement et
    blocage du dernier administrateur ;
  - tester creation, modification et suppression controlee des tags ;
  - verifier que chaque action sensible produit une entree de journal.

Point de controle :

- Les actions admin sont impossibles sans role administrateur.
- Les changements structurants sont traces.
- Les suppressions dangereuses sont controlees ou bloquees si elles cassent des
  donnees existantes.
- Le profil utilisateur reste centre sur l'identite publique, les comptes lies
  et les demandes envoyees, sans y dupliquer le journal global
  d'administration.

Bilan final :

- Socle backend ajoute : service administration, routes protegees sous
  `/api/admin`, gestion des tags, changement de role, bannissement, levee de
  bannissement et tableau de bord admin.
- Une table `admin_actions` est ajoutee pour journaliser les actions sensibles
  avec acteur, cible, type d'action et details des changements.
- Les suppressions de tags utilises sont bloquees et le retrait du dernier
  administrateur est refuse.
- Le frontend ajoute une page pleine `Administration`, visible depuis la
  navigation globale uniquement pour les administrateurs, avec sections
  utilisateurs, tags et journal.
- Les erreurs admin cote frontend distinguent maintenant les cas courants de
  validation, tag encore utilise, dernier administrateur et cible introuvable,
  au lieu d'un message generique unique.
- Des tests de routes admin et un test frontend de navigation administration
  sont ajoutes. Le passage de verification a ete confirme une fois l'execution
  des tests complete relancee hors sandbox lecture seule.

### Etape 9 - Import Notion

- Creer un importeur page par page pour la source Notion communautaire.
- Stocker les donnees brutes importees.
- Permettre de relancer l'import pendant que la source Notion continue
  d'evoluer, en mettant a jour les donnees brutes et les rapports sans publier
  automatiquement.
- Mapper les champs vers personnages, reseaux, police, anciens personnages,
  tags, relations et photos.
- Produire un rapport avant insertion : champs reconnus, champs manquants,
  relations detectees, relations ambigues.
- Ajouter des tests avec exemples figes.

Plan propose :

- Socle de stockage import :
  - ajouter une table de lots d'import Notion pour tracer la source, la date,
    l'etat du lot, le rapport global et l'utilisateur qui valide plus tard ;
  - ajouter une table d'entrees brutes par page/personnage, avec URL ou
    identifiant source stable Notion, contenu brut JSON/texte, hash de contenu,
    date de derniere observation, statut de mapping et erreurs detectees ;
  - conserver l'historique des versions importees ou, a minima, le dernier hash
    valide avec les anciens/nouveaux contenus utiles au rapport de diff ;
  - ne jamais ecrire directement dans `characters`, `streamers`, `tags` ou
    `character_relationships` pendant la collecte ou le mapping.
- Importeur Notion :
  - commencer par un import manuel a partir de contenus exportes ou colles en
    exemples figes, afin de confirmer la structure reelle avant d'ajouter une
    dependance API Notion ;
  - ajouter une commande de scraping de la page publique Notion qui recupere
    l'URL source, parcourt les sous-pages accessibles et produit directement
    les entrees brutes du rapport, car aucun export CSV fiable n'est disponible ;
  - isoler le parseur dans un service dedie, sans logique de publication ;
  - rendre la collecte rejouable et idempotente : une page deja importee est
    mise a jour si son hash change, ignoree si elle est identique, et marquee
    comme absente si elle n'apparait plus dans une source complete ;
  - conserver le contenu brut complet pour permettre une relecture humaine et
    un remapping sans reperdre la source.
- Mapping :
  - produire un `Character` candidat avec `dataSource: "notion"` et
    `verificationStatus: "imported"` ou `"to_check"` selon la confiance du
    champ ;
  - mapper separement les streamers, liens publics, champs police,
    anciens personnages, tags et relations RP autorisees ;
  - traiter explicitement le champ Notion `V6` comme un candidat pour les
    anciens personnages et, plus tard, comme source potentielle d'une relation
    dediee `ancien personnage` non affichee dans le graphe public ;
  - absorber aussi les champs relationnels Notion specifiques comme
    `Couple relation`, `Est oncle/tante`, `Ex/Exs relation`, `Oncle relation`
    et `Tante relation` en relations informatives hors graphe, ainsi que
    `Père relation`, `Mère relation`, `Est parent` et les variantes
    `Frères/Soeurs` quand elles correspondent a des relations deja connues ;
  - persister ces relations informatives dans `character_relationships` avec
    une regle explicite `visible en fiche, pas dans le graphe` afin d'eviter
    une logique parallele entre import Notion et modele metier ;
  - classer les relations non resolues ou ambigues dans le rapport au lieu de
    creer des liens incertains ;
  - ignorer ou signaler explicitement les donnees hors perimetre MVP, en
    particulier les relations non RP ou non limitees au noyau familial/couple.
- Rapport avant publication :
  - generer un rapport lisible listant champs reconnus, champs inconnus,
    champs manquants, doublons probables, tags a creer, streamers a rattacher,
    relations resolues et relations ambigues ;
  - afficher par defaut un resume terminal compact, avec option JSON complete
    pour debug, afin d'eviter de noyer les centaines de fiches importees ;
  - ajouter une commande de previsualisation du dernier lot importee sous forme
    de tableau de candidats personnages, sans publication publique ;
  - separer les entrees nouvelles, modifiees, inchangees, supprimees ou
    absentes de la source, afin de suivre l'actualisation continue du Notion
    pendant la preparation du site ;
  - afficher clairement les erreurs de parsing et les decisions de mapping
    automatiques, sans les masquer derriere un succes global ;
  - prevoir une commande backend qui produit le rapport sans mutation des
    donnees publiques.
- Validation humaine :
  - garder la publication hors automatisme pour cette etape : le rapport sert a
    preparer une validation humaine et une future interface ou commande
    d'application controlee ;
  - si une insertion controlee est ajoutee dans l'etape, elle doit creer les
    historiques necessaires et appliquer les memes contraintes de slug, tags,
    streamers et relations que les flux moderes existants.
- Tests et securite :
  - ajouter des fixtures Notion anonymisees et figees dans les tests, sans
    donnees personnelles reelles non justifiees ;
  - tester le parsing nominal, les champs inconnus, les relations ambigues, les
    doublons de nom, les statuts de verification et l'absence de publication
    automatique ;
  - refuser les photos distantes ou fichiers importes non controles dans le
    premier jet ; les photos Notion doivent etre seulement referencees dans le
    rapport tant que le pipeline photo securise n'est pas explicitement branche.

Point de controle :

- L'import ne publie rien sans validation humaine.
- Les donnees incertaines sont marquees a verifier.
- Les erreurs de parsing sont visibles et non silencieuses.

### Etape 10 - Durcissement qualite et securite

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

### Etape 11 - Preparation deploiement

- Documenter la configuration de production : variables, PostgreSQL, Nginx,
  TLS, processus Node.js et build frontend.
- Prevoir logs, sauvegardes base de donnees, firewall, fail2ban ou equivalent.
- Verifier la capacite du VPS Hetzner avant ouverture publique.
- Preparer une procedure de restauration de base et de rollback applicatif.

Point de controle :

- Le site peut etre deploye sans secret en dur.
- Les sauvegardes sont planifiees avant exposition publique.
- Le serveur est durci avant trafic public.

### Etape 12 - SSO multiples et integrations plateformes

- Generaliser le modele `UserIdentity` pour rattacher plusieurs fournisseurs a
  un meme compte utilisateur : Google, Discord et Twitch.
- Permettre a un utilisateur de connecter ou de dissocier un fournisseur depuis
  son profil, sans exposer publiquement les noms, prenoms, emails ou handles
  renvoyes par ces fournisseurs.
- Gerer les collisions de compte avec prudence : refus ou validation explicite
  lorsqu'une identite fournisseur est deja rattachee ailleurs, sans fusion
  automatique risquee.
- Ajouter les variables d'environnement, secrets serveur, callbacks OAuth et
  tests pour chaque fournisseur, avec une documentation de deploiement dediee.
- Maintenir les controles existants de role, bannissement et session serveur
  quel que soit le fournisseur utilise pour se connecter.
- Ajouter l'etat live Twitch dans cette etape, en s'appuyant sur la
  configuration Twitch serveur deja necessaire au SSO.
- Exposer l'etat live Twitch par le backend avec cache court et degradation
  silencieuse si Twitch est indisponible.
- Afficher l'etat live uniquement dans le bouton/lien Twitch de la fiche
  personnage, avec un rond rouge lorsque le stream est en cours. Aucun indicateur
  n'est affiche si la chaine est hors ligne ou si l'etat est inconnu.

Point de controle :

- Un compte peut etre retrouve via plusieurs fournisseurs sans creer de doublon
  involontaire.
- Les donnees personnelles SSO restent privees et separees du nom d'affichage
  public.
- Les secrets Discord et Twitch ne sont jamais envoyes au frontend.
- L'etat live Twitch ne degrade pas l'affichage des fiches en cas d'erreur ou
  de limite API.

## Hypotheses

- La page Notion communautaire est la source initiale, mais son accessibilite et
  sa structure devront etre confirmees par tests de parsing.
- Google OAuth suffit pour le MVP.
- Le frontend demarre avec Vite, React et TypeScript.
- Le developpement utilise Node.js `24.16.0` ou plus recent, en restant sur la
  branche LTS plutot que sur la branche Current.
- Discord, Twitch, l'etat live Twitch et extraction admin sont des evolutions
  futures. Les evolutions SSO et live Twitch sont regroupees dans l'etape 12
  pour eviter une integration API Twitch partielle et redondante.
- Le VPS Hetzner pourra heberger le backend, le frontend, PostgreSQL et Nginx,
  sous reserve de verification de charge au moment du deploiement.
