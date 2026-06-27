import type {
  ChangeDiff,
  ChangeRequestSummary,
  CharacterSnapshot,
  PublicCharacterReference,
  PublicStreamer
} from "../api";
import { characterSnapshotFieldLabels } from "../constants";
import { formatCharacterSnapshotValue } from "../utils/characterDraftFormat";
import { CharacterSnapshotForm } from "./CharacterSnapshotForm";
import type { SnapshotDiffRow } from "./moderation-shared";
import { LoadingBlock } from "./StateBlock";

type ModerationDetailPanelProps = {
  characterNames: Map<string, string>;
  characterOptions: PublicCharacterReference[];
  editSnapshot: CharacterSnapshot | null;
  feedback: string | null;
  isDetailLoading: boolean;
  isSubmitting: boolean;
  lastChanges: ChangeDiff | null;
  rejectComment: string;
  selectedRequest: ChangeRequestSummary | null;
  streamerNames: Map<string, string>;
  streamers: PublicStreamer[];
  visibleDiff: SnapshotDiffRow[];
  onApprove: () => void;
  onChangeEditSnapshot: (snapshot: CharacterSnapshot) => void;
  onReject: () => void;
  onRejectCommentChange: (value: string) => void;
  onResetEditSnapshot: () => void;
  onSubmitDirectEdit: () => void;
};

export function ModerationDetailPanel({
  characterNames,
  characterOptions,
  editSnapshot,
  feedback,
  isDetailLoading,
  isSubmitting,
  lastChanges,
  rejectComment,
  selectedRequest,
  streamerNames,
  streamers,
  visibleDiff,
  onApprove,
  onChangeEditSnapshot,
  onReject,
  onRejectCommentChange,
  onResetEditSnapshot,
  onSubmitDirectEdit
}: ModerationDetailPanelProps) {
  const isCreationRequest = selectedRequest?.requestType === "create";

  return (
    <div className="work-panel moderation-detail-panel">
      {feedback ? <p className="inline-feedback success-text">{feedback}</p> : null}
      {lastChanges ? (
        <p className="inline-feedback">
          {Object.keys(lastChanges).length} champ modifié dans l'historique.
        </p>
      ) : null}
      {isDetailLoading ? <LoadingBlock label="Chargement du détail..." /> : null}
      {!isDetailLoading && selectedRequest ? (
        <>
          <div className="detail-heading">
            <div>
              <h3>
                {selectedRequest.characterName ??
                  (isCreationRequest ? "Nouvelle fiche" : "Personnage supprimé")}
              </h3>
              <span className="request-kind-label">
                {isCreationRequest
                  ? "Demande de création de fiche"
                  : "Demande de modification de fiche"}
              </span>
              <span className="muted-text">
                Proposé par {selectedRequest.userDisplayName ?? "utilisateur inconnu"}
              </span>
            </div>
          </div>

          <section className="diff-panel">
            <h3>{isCreationRequest ? "Fiche candidate" : "Comparaison"}</h3>
            {visibleDiff.length ? (
              visibleDiff.map((change) => (
                <div
                  key={change.field}
                  className={`diff-row ${isCreationRequest ? "is-creation" : ""}`}
                >
                  <strong>{characterSnapshotFieldLabels[change.field]}</strong>
                  {!isCreationRequest ? (
                    <span>
                      {formatCharacterSnapshotValue(change.field, change.oldValue, {
                        streamersById: streamerNames,
                        charactersById: characterNames
                      })}
                    </span>
                  ) : null}
                  <span>
                    {formatCharacterSnapshotValue(change.field, change.newValue, {
                      streamersById: streamerNames,
                      charactersById: characterNames
                    })}
                  </span>
                </div>
              ))
            ) : (
              <span className="muted-text">Aucun écart détecté avec la fiche actuelle.</span>
            )}
          </section>

          <div className="moderation-actions">
            <button
              type="button"
              className="ghost-button primary-action"
              disabled={isSubmitting}
              onClick={onApprove}
            >
              Accepter
            </button>
            <label>
              <span>Commentaire de refus</span>
              <textarea
                rows={3}
                value={rejectComment}
                onChange={(event) => {
                  onRejectCommentChange(event.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="ghost-button danger-action"
              disabled={isSubmitting || !rejectComment.trim()}
              onClick={onReject}
            >
              Refuser
            </button>
          </div>

          {editSnapshot && selectedRequest.requestType === "update" ? (
            <section className="direct-edit-panel">
              <h3>Édition directe modérateur</h3>
              <CharacterSnapshotForm
                snapshot={editSnapshot}
                characterOptions={characterOptions}
                currentCharacterId={selectedRequest.characterId}
                streamers={streamers}
                submitLabel="Appliquer directement"
                isSubmitting={isSubmitting}
                canUploadPhoto={false}
                isPhotoUploading={false}
                onCancel={onResetEditSnapshot}
                onChange={onChangeEditSnapshot}
                onPhotoUpload={async () => undefined}
                onSubmit={onSubmitDirectEdit}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
