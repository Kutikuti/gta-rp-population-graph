import {
  type CharacterSnapshot,
  type LifeStatus,
  type PublicCharacterReference,
  type PublicStreamer,
  resolveApiAssetUrl,
  type VerificationStatus
} from "../api";
import {
  editableRelationTypes,
  lifeStatusLabels,
  relationLabels,
  verificationLabels
} from "../constants";
import { CharacterPhotoUpload } from "./CharacterPhotoUpload";

type CharacterSnapshotFormProps = {
  snapshot: CharacterSnapshot;
  characterOptions: PublicCharacterReference[];
  currentCharacterId: string | null;
  streamers: PublicStreamer[];
  submitLabel: string;
  isSubmitting: boolean;
  canUploadPhoto: boolean;
  isPhotoUploading: boolean;
  onCancel: () => void;
  onChange: (snapshot: CharacterSnapshot) => void;
  onPhotoUpload: (image: Blob) => Promise<void>;
  onSubmit: () => void;
};

const textValue = (value: string | null) => value ?? "";

const nullableValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const socialPlatforms = [
  ["twitch", "Twitch"],
  ["kick", "Kick"],
  ["youtube", "YouTube"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"]
] as const;

const fieldGroups: Array<{
  title: string;
  fields: Array<{
    key: keyof CharacterSnapshot;
    label: string;
    type?: "date" | "text";
  }>;
}> = [
  {
    title: "Identité",
    fields: [
      { key: "firstName", label: "Prénom" },
      { key: "lastName", label: "Nom" },
      { key: "nickname", label: "Surnom" },
      { key: "birthDate", label: "Date de naissance", type: "date" }
    ]
  }
];

export function CharacterSnapshotForm({
  snapshot,
  characterOptions,
  currentCharacterId,
  streamers,
  submitLabel,
  isSubmitting,
  canUploadPhoto,
  isPhotoUploading,
  onCancel,
  onChange,
  onPhotoUpload,
  onSubmit
}: CharacterSnapshotFormProps) {
  const updateText = (key: keyof CharacterSnapshot, value: string) => {
    onChange({
      ...snapshot,
      [key]: key === "firstName" || key === "lastName" ? value : nullableValue(value)
    });
  };

  const availableCharacterOptions = characterOptions.filter(
    (character) => character.id !== currentCharacterId
  );
  const relationshipType = (value: string) => value as (typeof editableRelationTypes)[number];

  return (
    <form
      className="snapshot-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {fieldGroups.map((group) => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          <div className={`form-grid${group.title === "Organisation" ? " organization-grid" : ""}`}>
            {group.fields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input
                  type={field.type ?? "text"}
                  value={textValue(snapshot[field.key] as string | null)}
                  onChange={(event) => {
                    updateText(field.key, event.target.value);
                  }}
                  required={field.key === "firstName" || field.key === "lastName"}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend>Statuts</legend>
        <div className="form-grid">
          <label>
            <span>Statut vital</span>
            <select
              value={snapshot.lifeStatus}
              onChange={(event) => {
                onChange({ ...snapshot, lifeStatus: event.target.value as LifeStatus });
              }}
            >
              {Object.entries(lifeStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date décès ou départ</span>
            <input
              type="date"
              value={textValue(snapshot.deathOrDepartureDate)}
              onChange={(event) => {
                onChange({ ...snapshot, deathOrDepartureDate: nullableValue(event.target.value) });
              }}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Organisation</legend>
        <div className="form-grid organization-grid">
          <label>
            <span>Entreprise</span>
            <input
              type="text"
              value={textValue(snapshot.companyName)}
              onChange={(event) => {
                updateText("companyName", event.target.value);
              }}
            />
          </label>
          <label>
            <span>Grade</span>
            <input
              type="text"
              value={textValue(snapshot.companyRank)}
              onChange={(event) => {
                updateText("companyRank", event.target.value);
              }}
            />
          </label>
          <label>
            <span>Matricule</span>
            <input
              type="text"
              value={textValue(snapshot.companyBadgeNumber)}
              onChange={(event) => {
                updateText("companyBadgeNumber", event.target.value);
              }}
            />
          </label>
          <label>
            <span>Groupe</span>
            <input
              type="text"
              value={textValue(snapshot.groupName)}
              onChange={(event) => {
                updateText("groupName", event.target.value);
              }}
            />
          </label>
          <label>
            <span>Quartier</span>
            <input
              type="text"
              value={textValue(snapshot.district)}
              onChange={(event) => {
                updateText("district", event.target.value);
              }}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact</legend>
        <div className="form-grid">
          <label>
            <span>Téléphone</span>
            <input
              type="text"
              value={textValue(snapshot.phoneNumber)}
              onChange={(event) => {
                updateText("phoneNumber", event.target.value);
              }}
            />
          </label>
        </div>
      </fieldset>

            <fieldset>
        <legend>Parentés RP</legend>
        <div className="relationship-draft-list">
          {snapshot.relationships.map((relationship, index) => (
            <div
              key={`${relationship.type}-${relationship.characterId}`}
              className="relationship-draft-row"
            >
              <label>
                <span>Lien</span>
                <select
                  value={relationship.type}
                  onChange={(event) => {
                    const nextRelationships = snapshot.relationships.map((current, currentIndex) =>
                      currentIndex === index
                        ? {
                            ...current,
                            type: relationshipType(event.target.value)
                          }
                        : current
                    );

                    onChange({ ...snapshot, relationships: nextRelationships });
                  }}
                >
                  {editableRelationTypes.map((value) => (
                    <option key={value} value={value}>
                      {relationLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Personnage</span>
                <select
                  value={relationship.characterId}
                  onChange={(event) => {
                    const nextRelationships = snapshot.relationships.map((current, currentIndex) =>
                      currentIndex === index
                        ? {
                            ...current,
                            characterId: event.target.value
                          }
                        : current
                    );

                    onChange({ ...snapshot, relationships: nextRelationships });
                  }}
                >
                  <option value="">Sélectionner</option>
                  {availableCharacterOptions.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ghost-button compact-action"
                onClick={() => {
                  onChange({
                    ...snapshot,
                    relationships: snapshot.relationships.filter(
                      (_relationship, currentIndex) => currentIndex !== index
                    )
                  });
                }}
              >
                Retirer
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              const defaultCharacterId = availableCharacterOptions[0]?.id ?? "";

              if (!defaultCharacterId) {
                return;
              }

              onChange({
                ...snapshot,
                relationships: [
                  ...snapshot.relationships,
                  {
                    characterId: defaultCharacterId,
                    type: "parent"
                  }
                ]
              });
            }}
            disabled={!availableCharacterOptions.length}
          >
            Ajouter un lien
          </button>
        </div>
      </fieldset>

      {canUploadPhoto ? (
        <fieldset>
          <legend>Photo</legend>
          <div className="form-grid">
            <div className="photo-field-wrapper">
              <CharacterPhotoUpload
                currentPhotoUrl={
                  snapshot.photoUrl?.startsWith("pending-photo:")
                    ? null
                    : resolveApiAssetUrl(snapshot.photoUrl)
                }
                isUploading={isPhotoUploading}
                mode={submitLabel.includes("Appliquer") ? "direct" : "request"}
                onUpload={onPhotoUpload}
              />
            </div>
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend>Médias</legend>
        <div className="form-grid">
          <label>
            <span>Streamer existant</span>
            <select
              value={snapshot.streamerId ?? ""}
              onChange={(event) => {
                const nextStreamerId = nullableValue(event.target.value);
                onChange({
                  ...snapshot,
                  streamerId: nextStreamerId,
                  streamerName: nextStreamerId ? null : snapshot.streamerName
                });
              }}
            >
              <option value="">Aucun streamer</option>
              {streamers.map((streamer) => (
                <option key={streamer.id} value={streamer.id}>
                  {streamer.publicName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Nouveau streamer</span>
            <input
              type="text"
              value={textValue(snapshot.streamerName)}
              placeholder="À créer si absent"
              onChange={(event) => {
                onChange({
                  ...snapshot,
                  streamerId: null,
                  streamerName: nullableValue(event.target.value)
                });
              }}
            />
          </label>
          {socialPlatforms.map(([platform, label]) => (
            <label key={platform}>
              <span>{label}</span>
              <input
                type="text"
                value={textValue(snapshot.socialLinks?.[platform] ?? null)}
                placeholder={`Lien ${label}`}
                onChange={(event) => {
                  const nextValue = nullableValue(event.target.value);
                  const nextLinks = {
                    ...(snapshot.socialLinks ?? {})
                  };

                  if (nextValue) {
                    nextLinks[platform] = nextValue;
                  } else {
                    delete nextLinks[platform];
                  }

                  onChange({
                    ...snapshot,
                    socialLinks: Object.keys(nextLinks).length ? nextLinks : null
                  });
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Note de source</legend>
          <label>
            <span>Vérification</span>
            <select
              value={snapshot.verificationStatus}
              onChange={(event) => {
                onChange({
                  ...snapshot,
                  verificationStatus: event.target.value as VerificationStatus
                });
              }}
            >
              {Object.entries(verificationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        <label className="wide-field">
          <span>Note de source</span>
          <textarea
            value={textValue(snapshot.sourceNote)}
            onChange={(event) => {
              onChange({ ...snapshot, sourceNote: nullableValue(event.target.value) });
            }}
            rows={4}
          />
        </label>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="ghost-button primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Envoi..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
