import type { PublicCharacterDetail, PublicHistoryEntry } from "../api";
import { lifeStatusLabels, relationLabels, verificationLabels } from "../constants";
import { compactValue, formatDate, socialEntries } from "../utils/format";

type CharacterSheetProps = {
  character: PublicCharacterDetail;
  history: PublicHistoryEntry[];
  onContribute: () => void;
};

export function CharacterSheet({ character, history, onContribute }: CharacterSheetProps) {
  const links = socialEntries(character.socialLinks ?? character.streamer?.socialLinks);
  const relationships = [...character.relationships.outgoing, ...character.relationships.incoming];

  return (
    <article className="character-sheet">
      <div className="sheet-header">
        <div>
          <p className="eyebrow">Fiche personnage</p>
          <h2>{character.fullName}</h2>
          <p>{character.nickname ? `Alias ${character.nickname}` : "Aucun surnom renseigné"}</p>
        </div>
        <button type="button" className="ghost-button" onClick={onContribute}>
          Proposer
        </button>
      </div>

      <dl className="metric-grid">
        <div>
          <dt>Statut</dt>
          <dd>{lifeStatusLabels[character.lifeStatus]}</dd>
        </div>
        <div>
          <dt>Téléphone</dt>
          <dd>{compactValue(character.phoneNumber)}</dd>
        </div>
        <div>
          <dt>Streamer</dt>
          <dd>{compactValue(character.streamer?.publicName)}</dd>
        </div>
        <div>
          <dt>Naissance</dt>
          <dd>{formatDate(character.birthDate)}</dd>
        </div>
      </dl>

      <section className="sheet-section">
        <h3>Organisation</h3>
        <div className="info-list">
          <span>Entreprise : {compactValue(character.businessName)}</span>
          <span>Échelon : {compactValue(character.businessRank)}</span>
          <span>Matricule entreprise : {compactValue(character.businessBadgeNumber)}</span>
          <span>Groupe : {compactValue(character.groupName)}</span>
          <span>Rôle : {compactValue(character.groupRole)}</span>
          <span>Quartier : {compactValue(character.district)}</span>
          <span>Police : {compactValue(character.policeRank ?? character.policeBadgeNumber)}</span>
        </div>
      </section>

      <section className="sheet-section">
        <h3>Tags</h3>
        <div className="tag-list">
          {character.tags.length ? (
            character.tags.map((tag) => (
              <span key={tag.id} className="tag-pill" style={{ borderColor: tag.colorHex }}>
                {tag.name}
              </span>
            ))
          ) : (
            <span className="muted-text">Aucun tag.</span>
          )}
        </div>
      </section>

      <section className="sheet-section">
        <h3>Relations RP</h3>
        <div className="relationship-list">
          {relationships.length ? (
            relationships.map((relationship) => (
              <div
                key={`${relationship.id}-${relationship.relatedCharacter.id}`}
                className="relationship-row"
              >
                <span>{relationship.relatedCharacter.fullName}</span>
                <small>
                  {relationLabels[relationship.type] ?? relationship.type} · {relationship.label}
                </small>
              </div>
            ))
          ) : (
            <span className="muted-text">Aucune relation documentée.</span>
          )}
        </div>
      </section>

      <section className="sheet-section">
        <h3>Réseaux</h3>
        <div className="link-list">
          {links.length ? (
            links.map(([platform, url]) => (
              <a href={url} key={platform} target="_blank" rel="noreferrer">
                {platform}
              </a>
            ))
          ) : (
            <span className="muted-text">Aucun lien public.</span>
          )}
        </div>
      </section>

      <section className="sheet-section">
        <h3>Vérification</h3>
        <span className={`verification-chip verification-${character.verificationStatus}`}>
          {verificationLabels[character.verificationStatus]}
        </span>
      </section>

      <section className="sheet-section">
        <h3>Historique</h3>
        {history.length ? (
          history.map((entry) => (
            <div key={entry.id} className="history-row">
              <span>{formatDate(entry.createdAt)}</span>
              <small>{Object.keys(entry.changes).length} champ modifié</small>
            </div>
          ))
        ) : (
          <span className="muted-text">Aucun historique public.</span>
        )}
      </section>
    </article>
  );
}
