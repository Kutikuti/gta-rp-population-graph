# Confidentialité, RGPD et cookies

Ce document sert de base opérationnelle minimale pour la conformité RGPD du
projet dans son périmètre actuel. Il complète la page publique de
confidentialité et le runbook de déploiement.

## Position actuelle

- Le projet est concerné par le RGPD.
- A ce stade, aucune déclaration CNIL préalable classique n'est prévue pour le
  périmètre courant.
- Le projet doit en revanche maintenir une logique d'accountability :
  information des personnes, registre des traitements, durées de conservation,
  sécurité et traitement des demandes.
- Aucun bandeau de consentement cookies n'est prévu actuellement tant que le
  site reste limité :
  - au cookie de session serveur strictement nécessaire à l'authentification ;
  - au `localStorage` de préférences d'interface ;
  - à une mesure serveur sans traceur client tiers.

Toute évolution vers un traceur non strictement nécessaire doit déclencher une
revue RGPD/cookies avant mise en production.

## Registre simplifié des traitements

| Traitement | Finalité | Données traitées | Base légale retenue | Destinataires | Durée cible | Stockage | Mesures de sécurité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentification SSO | Permettre la connexion et le rattachement d'identités Google, Discord et Twitch | email de connexion, identifiant fournisseur, nom fournisseur, avatar fournisseur, dates de première/dernière utilisation | Exécution du service demandé par l'utilisateur | backend, base PostgreSQL, administrateurs en cas de support strictement nécessaire | compte actif ; sinon cible de désactivation à `24` mois d'inactivité puis suppression ou archivage court après revue | PostgreSQL (`users`, `user_identities`) | session serveur, contrôle d'accès, rôles, secrets hors Git |
| Gestion du profil utilisateur | Gérer le nom public, les comptes liés et l'état du compte | nom d'affichage, email, avatar, rôle, statut de bannissement, dernière connexion | Exécution du service ; intérêt légitime pour la sécurité et la modération | backend, base PostgreSQL, administrateurs | compte actif ; sinon cible de désactivation à `24` mois d'inactivité puis suppression ou archivage court après revue | PostgreSQL (`users`, `bans`) | séparation identité privée / profil public, contrôle serveur des autorisations |
| Sessions persistantes | Maintenir la connexion après authentification | identifiant de session, contenu de session, expiration | Strictement nécessaire au service d'authentification | backend, base PostgreSQL | `7` jours maximum, nettoyage périodique horaire | PostgreSQL (`user_sessions`) + cookie navigateur `HttpOnly` | cookie `HttpOnly`, `SameSite`, `Secure` en production, expiration serveur |
| Contributions, modération et historique | Permettre les demandes, validations, refus et traçabilité | snapshots proposés, commentaires de modération, identifiants des acteurs, historiques de changement | Intérêt légitime de qualité des données, sécurité et traçabilité du service | backend, base PostgreSQL, modérateurs et administrateurs | demandes courantes : `24` mois ; historiques et traces d'administration : `12` mois glissants minimum puis revue, avec extension possible si incident, abus ou contentieux | PostgreSQL (`change_requests`, `change_histories`, `admin_actions`) | rôles serveur, journalisation métier, séparation des accès |
| Imports éditoriaux | Préparer, comparer et appliquer des imports de données communautaires avant publication | contenu brut importé, mapping, hash de contenu, état d'application, opérateur d'application | Intérêt légitime de maintien éditorial du répertoire | backend, base PostgreSQL, administrateurs | cible de conservation active : `12` mois après le dernier traitement du lot, puis purge ou archivage court si un besoin d'audit subsiste | PostgreSQL (`notion_import_batches`, `notion_import_entries`) | revue admin avant application, pas de publication automatique |
| Photos de personnages | Afficher des portraits liés aux fiches et traiter les propositions de photo | images temporaires, images validées, métadonnées de cadrage implicites | Intérêt légitime éditorial ; exécution du service de contribution | backend, stockage partagé, modérateurs/admins | propositions en attente `24` h max ; photos validées tant que la fiche les référence | stockage disque sous `shared/storage/uploads` ou équivalent | validation MIME/signature, réencodage contrôlé, noms générés, pas de SVG |
| Supervision et métriques | Suivre la santé technique et un volume approximatif d'usage | métriques HTTP, fingerprint visiteur dérivé de l'IP et du user-agent, métriques métier, journaux système | Intérêt légitime d'exploitation et de sécurité | backend, Prometheus/Grafana, administrateurs | fingerprint visiteur conservé en mémoire jusqu'au redémarrage ; traces et journaux techniques : cible `6` à `12` mois selon la doctrine CNIL, plafonnée aujourd'hui à `30` jours via `journald` | mémoire du process, système de métriques, journaux système | hachage SHA-256 du couple IP + user-agent, accès supervision protégé |
| Sauvegardes | Restaurer le service en cas d'incident | dumps PostgreSQL, uploads photo validés | Intérêt légitime de continuité de service et sécurité | administrateurs du service | PostgreSQL : `7` journalières + `4` hebdomadaires ; uploads : `2` à `4` hebdomadaires | infrastructure de sauvegarde du projet | rotation automatique, accès SSH restreint, stockage hors Git |

## Cookies et stockages côté navigateur

### Cookie de session

- Usage : authentification et maintien de session.
- Nature : strictement nécessaire.
- Mode de pose : côté serveur.
- Mesures : `HttpOnly`, `SameSite`, `Secure` en production si activé.
- Conséquence actuelle : pas de bandeau de consentement dédié pour ce cookie
  tant qu'aucun autre traceur non exempté n'est ajouté.

### LocalStorage

- Usage : mémorisation des filtres et des préférences d'affichage du graphe.
- Données stockées : préférences d'interface uniquement.
- Portée : locale au navigateur.
- Conséquence actuelle : information utilisateur requise, mais pas de bannière
  de consentement spécifique dans le périmètre actuel.

### Traceurs tiers

- Aucun script publicitaire ou analytics tiers côté client n'est prévu dans
  l'état actuel du projet.
- Toute future intégration de mesure d'audience client, A/B test, heatmap,
  replay, publicité, pixel social ou SDK tiers doit déclencher :
  1. une revue RGPD ;
  2. une revue cookies/traceurs ;
  3. une décision explicite sur la nécessité d'un mécanisme de consentement.

## Durées de conservation et écarts connus

### Durées alignées avec l'implémentation actuelle

- Sessions serveur : `7` jours (`SESSION_TTL_HOURS=168` par défaut).
- Nettoyage des sessions expirées : périodique, intervalle par défaut `60`
  minutes.
- Propositions de photo en attente : suppression automatique après `24` heures
  (`PHOTO_DRAFT_MAX_AGE_HOURS=24`).
- Journaux système sur le VPS : rétention plafonnée à `30` jours maximum et
  taille limitée via `journald`.
- Sauvegardes PostgreSQL : `7` journalières + `4` hebdomadaires.
- Sauvegardes uploads : `2` à `4` hebdomadaires selon la volumétrie.

### Politique cible à resserrer

- Comptes utilisateur et identités SSO liées :
  - conservation en base active tant que le compte est utilisé ;
  - cible de désactivation après `24` mois d'inactivité ;
  - suppression ou archivage court après revue, si aucun besoin de sécurité,
    de modération ou de défense en justice ne justifie une conservation plus
    longue.
- Demandes de modification et créations non appliquées :
  - cible de conservation active `24` mois pour garder un contexte de
    modération exploitable ;
  - au-delà, purge ou archivage court selon le besoin réel.
- Historiques de changement et journaux d'administration :
  - cible de conservation glissante `12` mois ;
  - extension possible au cas par cas en cas d'incident, d'abus, de litige ou
    d'enquête interne documentée.
- Imports éditoriaux :
  - cible de conservation `12` mois après le dernier traitement utile d'un lot
    (import, comparaison, application ou rejet) ;
  - réévaluation ensuite selon l'intérêt d'audit résiduel.

### Ecarts restant à suivre

- Pas de purge automatique aujourd'hui pour :
  - les comptes inactifs ;
  - les identités SSO liées ;
  - les demandes de changement ;
  - les historiques de changement ;
  - les journaux d'administration ;
  - les imports éditoriaux.
- Le projet documente donc pour l'instant une durée cible et une règle de
  révision, pas encore une suppression automatisée sur chacun de ces flux.
- La conservation de ces données repose aujourd'hui sur un besoin de
  traçabilité, de sécurité et de modération, mais devra être réévaluée si le
  volume, la sensibilité ou le cadre légal évoluent.

## Données publiques vs privées

### Données publiques

- fiches personnages publiées ;
- relations RP publiées ;
- photos de personnages validées ;
- historique public lié aux fiches si exposé par le produit.

### Données privées

- emails de connexion ;
- identifiants fournisseurs SSO ;
- dates d'usage des identités liées ;
- données de session ;
- contenus de modération non publics ;
- imports bruts et journaux d'administration ;
- métriques techniques et journaux système.

Le frontend affiche actuellement l'email de connexion uniquement dans le profil
de l'utilisateur authentifié concerné. Cet affichage est acceptable dans le
périmètre actuel tant qu'il reste privé et sans exposition publique.

## Procédure minimale de traitement des demandes RGPD

Le point de contact actuel est :

- email : `julien.j.rechaussat@gmail.com`
- contact Discord informel : `jeiwel`

### 1. Demande d'accès

- Vérifier l'identité du demandeur via le compte authentifié ou un échange
  direct.
- Un premier outillage produit existe désormais :
  - l'utilisateur connecté peut consulter un export synthétique de son compte
    et de ses identités liées depuis son profil ;
  - l'administration dispose d'une vue de support ciblée depuis le panneau
    utilisateurs pour préparer une réponse manuelle.
- Exporter au minimum :
  - compte utilisateur ;
  - identités liées ;
  - demandes envoyées ;
  - traces de modération liées si communicables ;
  - données publiques explicitement rattachées au compte si nécessaire.

### 2. Demande de rectification

- Corriger en priorité :
  - nom d'affichage public ;
  - rattachements SSO erronés ;
  - informations de compte ;
  - éventuellement contributions ou métadonnées si une erreur technique est
    démontrée.

### 3. Demande de suppression

- Peuvent être supprimés ou dissociés rapidement :
  - le compte utilisateur via anonymisation contrôlée si aucune contrainte ne
    s'y oppose : suppression des moyens de connexion, révocation des sessions
    et remplacement des données identifiantes directes ;
  - les identités SSO liées, désormais dissociables depuis le panneau
    d'administration RGPD avec protection du dernier moyen de connexion ;
  - les sessions actives, désormais révocables depuis le panneau
    d'administration RGPD ;
  - les brouillons photo temporaires restants ;
  - certaines contributions non encore intégrées si cela reste cohérent.
- Peuvent nécessiter une conservation partielle :
  - historiques de changement ;
  - journaux d'administration ;
  - données nécessaires à la sécurité, à la lutte contre l'abus ou à la
    traçabilité éditoriale.
- L'anonymisation d'un compte conserve la ligne technique utilisateur afin de
  préserver les références d'historique et de modération, mais retire les
  éléments de connexion et les données directement identifiantes.
- Quand une conservation partielle est maintenue, elle doit rester motivée,
  limitée et revue périodiquement plutôt que reconduite sans échéance.

### 4. Demande d'opposition

- Examiner au cas par cas selon la base légale du traitement.
- En pratique, l'opposition est surtout pertinente pour les traitements
  accessoires ou futurs ; le service n'intègre pas aujourd'hui de publicité ni
  d'analytics client tiers.

## Références

- CNIL — Cookies et autres traceurs :
  https://www.cnil.fr/fr/cookies-et-autres-traceurs
- CNIL — Règles applicables aux cookies :
  https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles
- CNIL — Cookies : ce que dit la loi :
  https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies
- CNIL — Déclarer un fichier / formalités depuis le RGPD :
  https://www.cnil.fr/fr/services-en-ligne/declarer-un-fichier
