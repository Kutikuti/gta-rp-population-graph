const PROJECT_REPOSITORY_URL = "https://github.com/Kutikuti/gta-rp-population-graph";
const CONTACT_EMAIL = "julien.j.rechaussat@gmail.com";
const DISCORD_USERNAME = "jeiwel";

export function PublicInfoView() {
  return (
    <section className="full-page-view public-info-view" aria-labelledby="public-info-title">
      <div className="full-page-header public-info-header">
        <div>
          <p className="eyebrow">Informations publiques</p>
          <h2 id="public-info-title">A propos du projet</h2>
          <p className="muted-text">
            Un annuaire narratif et un graphe de personnages pour aider les spectateurs a suivre les
            liens RP et retrouver rapidement les informations utiles.
          </p>
        </div>
      </div>

      <div className="public-info-layout">
        <section className="work-panel public-info-panel">
          <h3>Concept</h3>
          <p>
            GTA-RP Population Graph regroupe des fiches publiques, les rattachements de streamers et
            les relations RP entre personnages dans une interface de consultation rapide.
          </p>
          <p>
            Cette instance concerne actuellement <strong>Flashback WL</strong>, mais le projet peut
            etre adapte a d&apos;autres serveurs GTA RP avec le meme socle technique.
          </p>
        </section>

        <section className="work-panel public-info-panel">
          <h3>Moderation</h3>
          <p>
            Le site depend d&apos;une moderation active pour verifier les fiches, suivre les imports
            et garder des donnees propres. Si tu veux aider sur cette partie, contacte-moi.
          </p>
          <div className="public-info-link-list">
            <a className="ghost-button" href={`mailto:${CONTACT_EMAIL}`}>
              Me contacter par mail
            </a>
            <span className="ghost-button public-info-static-chip">Discord : {DISCORD_USERNAME}</span>
          </div>
        </section>

        <section className="work-panel public-info-panel">
          <h3>Projet libre</h3>
          <p>
            Le depot est public. Tu peux consulter l&apos;implementation, la reutiliser ou
            l&apos;adapter pour un autre serveur en gardant la meme logique de moderation et de
            graphe.
          </p>
          <a
            className="ghost-button"
            href={PROJECT_REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le depot GitHub
          </a>
        </section>

        <section className="work-panel public-info-panel">
          <h3>Liens et contact</h3>
          <dl className="public-info-contact-list">
            <div>
              <dt>Mail</dt>
              <dd>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </dd>
            </div>
            <div>
              <dt>Discord</dt>
              <dd>{DISCORD_USERNAME}</dd>
            </div>
            <div>
              <dt>Depot</dt>
              <dd>
                <a href={PROJECT_REPOSITORY_URL} target="_blank" rel="noreferrer">
                  {PROJECT_REPOSITORY_URL}
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
