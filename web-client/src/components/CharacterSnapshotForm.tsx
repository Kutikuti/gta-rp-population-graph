import {
  type CharacterSnapshot,
  type LifeStatus,
  type PublicCharacterReference,
  type PublicStreamer,
  resolveApiAssetUrl,
  type VerificationStatus
} from "../api";
import { lifeStatusLabels, verificationLabels } from "../constants";
import { CharacterPhotoUpload } from "./CharacterPhotoUpload";
import { CharacterSnapshotFormMedia } from "./CharacterSnapshotFormMedia";
import { PhoneNumbersFieldset, RelationshipsFieldset } from "./CharacterSnapshotFormRelations";

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
  return value.length ? value : null;
};

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
  const updateSnapshot = (changes: Partial<CharacterSnapshot>) => {
    onChange({ ...snapshot, ...changes });
  };

  const updateText = (key: keyof CharacterSnapshot, value: string) => {
    updateSnapshot({
      [key]: key === "firstName" || key === "lastName" ? value : nullableValue(value)
    } as Partial<CharacterSnapshot>);
  };

  const updatePhoneNumbers = (phoneNumbers: string[]) => {
    updateSnapshot({ phoneNumbers });
  };
  const updateRelationships = (relationships: CharacterSnapshot["relationships"]) => {
    updateSnapshot({ relationships });
  };
  const isDirectPhotoMode = submitLabel.includes("Appliquer");

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
                updateSnapshot({ lifeStatus: event.target.value as LifeStatus });
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
                updateSnapshot({ deathOrDepartureDate: nullableValue(event.target.value) });
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

      <PhoneNumbersFieldset phoneNumbers={snapshot.phoneNumbers} onChange={updatePhoneNumbers} />

      <RelationshipsFieldset
        relationships={snapshot.relationships}
        characterOptions={characterOptions}
        currentCharacterId={currentCharacterId}
        onChange={updateRelationships}
      />

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
                mode={isDirectPhotoMode ? "direct" : "request"}
                onUpload={onPhotoUpload}
              />
            </div>
          </div>
        </fieldset>
      ) : null}

      <CharacterSnapshotFormMedia
        snapshot={snapshot}
        streamers={streamers}
        onChange={updateSnapshot}
      />

      <fieldset>
        <legend>Note de source</legend>
        <label>
          <span>Vérification</span>
          <select
            value={snapshot.verificationStatus}
            onChange={(event) => {
              updateSnapshot({
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
              updateSnapshot({ sourceNote: nullableValue(event.target.value) });
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
