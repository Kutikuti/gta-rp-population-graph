import type { PublicCharacterDetail, PublicHistoryEntry } from "../api";
import { lifeStatusLabels, relationLabels, verificationLabels } from "../constants";
import { compactValue, formatDate, socialEntries } from "../utils/format";

type CharacterSheetProps = {
  character: PublicCharacterDetail;
  history: PublicHistoryEntry[];
};

export function CharacterSheet({ character, history }: CharacterSheetProps) {
  const links = socialEntries(character.socialLinks ?? character.streamer?.socialLinks);
  const relationships = [...character.relationships.outgoing, ...character.relationships.incoming];

  return (
    <article className="character-sheet">
      <div className="sheet-header">
        <div>
          <p className="eyebrow">Fiche personnage</p>
          <h2>{character.fullName}</h2>
          <p>{character.nickname ? `Alias ${character.nickname}` : "Aucun surnom renseigne"}</p>
        </div>
        <span className={`verification-chip verification-${character.verificationStatus}`}>
          {verificationLabels[character.verificationStatus]}
        </span>
      </div>

      <dl className="metric-grid">
        <div>
          <dt>Statut</dt>
          <dd>{lifeStatusLabels[character.lifeStatus]}</dd>
        </div>
        <div>
          <dt>Telephone</dt>
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
          <span>Echelon : {compactValue(character.businessRank)}</span>
          <span>Matricule entreprise : {compactValue(character.businessBadgeNumber)}</span>
          <span>Groupe : {compactValue(character.groupName)}</span>
          <span>Role : {compactValue(character.groupRole)}</span>
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
              <div key={`${relationship.id}-${relationship.relatedCharacter.id}`} className="relationship-row">
                <span>{relationship.relatedCharacter.fullName}</span>
                <small>
                  {relationLabels[relationship.type] ?? relationship.type} · {relationship.label}
                </small>
              </div>
            ))
          ) : (
            <span className="muted-text">Aucune relation documentee.</span>
          )}
        </div>
      </section>

      <section className="sheet-section">
        <h3>Reseaux</h3>
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
        <h3>Historique</h3>
        {history.length ? (
          history.map((entry) => (
            <div key={entry.id} className="history-row">
              <span>{formatDate(entry.createdAt)}</span>
              <small>{Object.keys(entry.changes).length} champ modifie</small>
            </div>
          ))
        ) : (
          <span className="muted-text">Aucun historique public.</span>
        )}
      </section>
    </article>
  );
}
