import { CONTACT_EMAIL, DISCORD_USERNAME, PROJECT_REPOSITORY_URL } from "./public-static-content";

type PrivacyViewProps = {
  onOpenInfo: () => void;
};

export function PrivacyView({ onOpenInfo }: PrivacyViewProps) {
  return (
    <section className="full-page-view public-info-view" aria-labelledby="privacy-title">
      <div className="full-page-header public-info-header">
        <div>
          <p className="eyebrow">Confidentialité</p>
          <h2 id="privacy-title">Données personnelles et cookies</h2>
          <p className="muted-text">
            Cette page résume les données traitées par le site, leur usage, leur durée de
            conservation et la manière d&apos;exercer tes droits.
          </p>
        </div>
        <div className="public-info-top-actions">
          <button type="button" className="ghost-button" onClick={onOpenInfo}>
            À propos du projet
          </button>
        </div>
      </div>

      <div className="public-info-layout">
        <section className="work-panel public-info-panel">
          <h3>Données traitées</h3>
          <p>
            Le site traite des données de compte (email de connexion, identités SSO, nom
            d&apos;affichage, avatar), des données de contribution et de modération, ainsi que les
            contenus nécessaires au fonctionnement des fiches personnage et des photos de
            personnages.
          </p>
          <p>
            Les données publiques d&apos;une fiche personnage ne recouvrent pas forcément des
            données d&apos;utilisateur. Les identités SSO restent privées et séparées du profil
            public.
          </p>
        </section>

        <section className="work-panel public-info-panel">
          <h3>Cookies et stockage local</h3>
          <p>
            Le site utilise un cookie de session serveur strictement nécessaire à
            l&apos;authentification lorsque tu te connectes. Il utilise aussi le stockage local du
            navigateur pour mémoriser les filtres de recherche et les préférences d&apos;affichage
            du graphe.
          </p>
          <p>
            Aucun traceur publicitaire ni outil analytics tiers côté client n&apos;est déployé à ce
            jour. En conséquence, aucun bandeau de consentement n&apos;est affiché actuellement.
          </p>
        </section>

        <section className="work-panel public-info-panel">
          <h3>Durées de conservation</h3>
          <ul className="public-info-list">
            <li>Sessions persistantes : 7 jours maximum, avec nettoyage périodique.</li>
            <li>
              Photos de personnages en attente : 24 heures maximum avant suppression automatique.
            </li>
            <li>
              Sauvegardes : 7 sauvegardes PostgreSQL journalières, 4 hebdomadaires, et 2 à 4
              archives hebdomadaires pour les uploads.
            </li>
            <li>
              Comptes, identités liées, historiques et demandes : conservation tant que le service
              en a besoin pour l&apos;authentification, la modération et la traçabilité, avec revue
              documentaire régulière.
            </li>
          </ul>
        </section>

        <section className="work-panel public-info-panel">
          <h3>Droits et contact</h3>
          <p>
            Tu peux demander l&apos;accès, la rectification ou la suppression des données qui te
            concernent, sous réserve des obligations de sécurité, d&apos;historique et de
            modération.
          </p>
          <p>
            L&apos;email de connexion n&apos;est affiché que dans ton profil authentifié. Les
            métriques de visite sont calculées côté serveur à partir de données techniques
            pseudonymisées et ne déposent pas de traceur tiers dans le navigateur.
          </p>
          <div className="public-info-link-list">
            <a className="ghost-button" href={`mailto:${CONTACT_EMAIL}`}>
              Contacter le responsable
            </a>
            <span className="ghost-button public-info-static-chip">
              Discord : {DISCORD_USERNAME}
            </span>
            <a
              className="ghost-button"
              href={PROJECT_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
            >
              Consulter le dépôt
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
