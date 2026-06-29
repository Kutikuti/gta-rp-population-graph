import type {
  CharacterSnapshot,
  PublicCharacterDetail,
  PublicHistoryEntry,
  PublicRelationship
} from "../api";
import { resolveApiAssetUrl } from "../api";
import {
  characterSnapshotFieldLabels,
  lifeStatusLabels,
  relationLabels,
  verificationLabels
} from "../constants";
import { formatCharacterSnapshotValue } from "../utils/characterDraftFormat";
import { compactValue, formatDate, socialEntries } from "../utils/format";

type CharacterSheetProps = {
  canEditDirectly: boolean;
  character: PublicCharacterDetail;
  history: PublicHistoryEntry[];
  onContribute: () => void;
  onShare: () => void;
};

type HistoryChange = {
  old: unknown;
  new: unknown;
};

const isKnownSnapshotField = (field: string): field is keyof CharacterSnapshot =>
  field in characterSnapshotFieldLabels;

const isHistoryChange = (value: unknown): value is HistoryChange =>
  Boolean(
    value &&
      typeof value === "object" &&
      "old" in value &&
      "new" in value &&
      Object.keys(value).every((key) => key === "old" || key === "new")
  );

const relationshipNameMap = (relationships: PublicRelationship[]) =>
  new Map(
    relationships.map(
      (relationship) =>
        [relationship.relatedCharacter.id, relationship.relatedCharacter.fullName] as const
    )
  );

export function CharacterSheet({
  canEditDirectly,
  character,
  history,
  onContribute,
  onShare
}: CharacterSheetProps) {
  const links = socialEntries(character.socialLinks ?? character.streamer?.socialLinks);
  const relationships = [...character.relationships.outgoing, ...character.relationships.incoming];
  const photoUrl = resolveApiAssetUrl(character.photoUrl);
  const charactersById = relationshipNameMap(relationships);
  const streamersById = character.streamer
    ? new Map([[character.streamer.id, character.streamer.publicName]])
    : undefined;

  return (
    <article className="character-sheet">
      <div className="sheet-header">
        <div className="sheet-identity">
          {photoUrl ? <img src={photoUrl} alt="" className="sheet-photo" /> : null}
          <div>
            <p className="eyebrow">Fiche personnage</p>
            <h2>{character.fullName}</h2>
            <p>{character.nickname ? `Alias ${character.nickname}` : "Aucun surnom renseigné"}</p>
          </div>
        </div>
        <div className="sheet-header-actions">
          <button type="button" className="ghost-button" onClick={onShare}>
            Copier le lien
          </button>
          <button type="button" className="ghost-button" onClick={onContribute}>
            {canEditDirectly ? "Modifier" : "Proposer"}
          </button>
        </div>
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
                <span>{platform}</span>
                {platform === "twitch" && character.twitchLiveStatus === "live" ? (
                  <span className="stream-live-indicator" title="En direct">
                    <span className="stream-live-dot" aria-hidden="true" />
                    <span className="sr-only">En direct</span>
                  </span>
                ) : null}
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
          history.map((entry) => {
            const changes = Object.entries(entry.changes).filter(
              (change): change is [string, HistoryChange] => isHistoryChange(change[1])
            );

            return (
              <details key={entry.id} className="history-row">
                <summary>
                  <span>{formatDate(entry.createdAt)}</span>
                  <small>{Object.keys(entry.changes).length} champ modifié</small>
                </summary>
                {changes.length ? (
                  <div className="history-change-list">
                    {changes.map(([field, change]) => (
                      <div key={field} className="history-change-row">
                        <strong>
                          {isKnownSnapshotField(field)
                            ? characterSnapshotFieldLabels[field]
                            : field}
                        </strong>
                        <span>
                          {isKnownSnapshotField(field)
                            ? formatCharacterSnapshotValue(field, change.old, {
                                streamersById,
                                charactersById
                              })
                            : String(change.old ?? "Non renseigné")}
                        </span>
                        <span>
                          {isKnownSnapshotField(field)
                            ? formatCharacterSnapshotValue(field, change.new, {
                                streamersById,
                                charactersById
                              })
                            : String(change.new ?? "Non renseigné")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="muted-text">Détail indisponible.</span>
                )}
              </details>
            );
          })
        ) : (
          <span className="muted-text">Aucun historique public.</span>
        )}
      </section>
    </article>
  );
}
