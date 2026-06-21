import {
  type CharacterSnapshot,
  type LifeStatus,
  resolveApiAssetUrl,
  type VerificationStatus
} from "../api";
import { lifeStatusLabels, verificationLabels } from "../constants";
import { CharacterPhotoUpload } from "./CharacterPhotoUpload";

type CharacterSnapshotFormProps = {
  snapshot: CharacterSnapshot;
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
  },
  {
    title: "Organisation",
    fields: [
      { key: "businessName", label: "Entreprise" },
      { key: "businessRank", label: "Échelon entreprise" },
      { key: "businessBadgeNumber", label: "Matricule entreprise" },
      { key: "groupName", label: "Groupe" },
      { key: "groupRole", label: "Rôle groupe" },
      { key: "district", label: "Quartier" }
    ]
  },
  {
    title: "Contact et police",
    fields: [
      { key: "phoneNumber", label: "Téléphone" },
      { key: "policeRank", label: "Grade police" },
      { key: "policeBadgeNumber", label: "Matricule police" }
    ]
  }
];

export function CharacterSnapshotForm({
  snapshot,
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
          <div className="form-grid">
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

      {canUploadPhoto ? (
        <fieldset>
          <legend>Photo</legend>
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
        </fieldset>
      ) : null}

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
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={snapshot.isRpDeath}
              onChange={(event) => {
                onChange({ ...snapshot, isRpDeath: event.target.checked });
              }}
            />
            <span>Mort RP</span>
          </label>
        </div>
      </fieldset>

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
