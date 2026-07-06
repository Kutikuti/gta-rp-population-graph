import { useEffect, useRef, useState } from "react";

import {
  type CharacterSnapshot,
  type LifeStatus,
  type PublicCharacterReference,
  type PublicStreamer,
  resolveApiAssetUrl,
  type VerificationStatus
} from "../api";
import addIconUrl from "../assets/misc/add.svg";
import deleteIconUrl from "../assets/misc/delete.svg";
import {
  lifeStatusLabels,
  relationLabels,
  relationTypeGroups,
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
  ["discord", "Discord"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"]
] as const;

type RelationType = CharacterSnapshot["relationships"][number]["type"];

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
  const phoneRowIdsRef = useRef<string[]>(snapshot.phoneNumbers.map(() => crypto.randomUUID()));
  const [isNewStreamerOpen, setIsNewStreamerOpen] = useState(Boolean(snapshot.streamerName));
  const selectedStreamer = snapshot.streamerId
    ? (streamers.find((streamer) => streamer.id === snapshot.streamerId) ?? null)
    : null;
  const areSocialLinksEditable = Boolean(snapshot.streamerId || isNewStreamerOpen);

  const updateSnapshot = (changes: Partial<CharacterSnapshot>) => {
    onChange({ ...snapshot, ...changes });
  };

  const updateText = (key: keyof CharacterSnapshot, value: string) => {
    updateSnapshot({
      [key]: key === "firstName" || key === "lastName" ? value : nullableValue(value)
    } as Partial<CharacterSnapshot>);
  };

  if (phoneRowIdsRef.current.length < snapshot.phoneNumbers.length) {
    phoneRowIdsRef.current.push(
      ...Array.from({ length: snapshot.phoneNumbers.length - phoneRowIdsRef.current.length }, () =>
        crypto.randomUUID()
      )
    );
  } else if (phoneRowIdsRef.current.length > snapshot.phoneNumbers.length) {
    phoneRowIdsRef.current = phoneRowIdsRef.current.slice(0, snapshot.phoneNumbers.length);
  }

  const availableCharacterOptions = characterOptions.filter(
    (character) => character.id !== currentCharacterId
  );
  const relationshipType = (value: string) => value as RelationType;
  const updatePhoneNumbers = (phoneNumbers: string[]) => {
    updateSnapshot({ phoneNumbers });
  };
  const updateRelationships = (relationships: CharacterSnapshot["relationships"]) => {
    updateSnapshot({ relationships });
  };
  const addRelationship = () => {
    const defaultCharacterId = availableCharacterOptions[0]?.id ?? "";

    if (!defaultCharacterId) {
      return;
    }

    updateRelationships([
      ...snapshot.relationships,
      {
        characterId: defaultCharacterId,
        type: "parent"
      }
    ]);
  };
  const removeRelationshipAt = (index: number) => {
    updateRelationships(
      snapshot.relationships.filter((_relationship, currentIndex) => currentIndex !== index)
    );
  };
  const updateRelationshipAt = (
    index: number,
    changes: Partial<CharacterSnapshot["relationships"][number]>
  ) => {
    updateRelationships(
      snapshot.relationships.map((relationship, currentIndex) =>
        currentIndex === index ? { ...relationship, ...changes } : relationship
      )
    );
  };
  const updateSocialLink = (
    platform: keyof NonNullable<CharacterSnapshot["socialLinks"]>,
    value: string
  ) => {
    const nextValue = nullableValue(value);
    const nextLinks = {
      ...(snapshot.socialLinks ?? {})
    };

    if (nextValue) {
      nextLinks[platform] = nextValue;
    } else {
      delete nextLinks[platform];
    }

    updateSnapshot({
      socialLinks: Object.keys(nextLinks).length ? nextLinks : null
    });
  };
  const selectExistingStreamer = (streamerId: string | null) => {
    if (!streamerId) {
      updateSnapshot({
        streamerId: null,
        streamerName: null,
        socialLinks: null
      });
      setIsNewStreamerOpen(false);
      return;
    }

    const streamer = streamers.find((item) => item.id === streamerId) ?? null;

    updateSnapshot({
      streamerId,
      streamerName: null,
      socialLinks: streamer?.socialLinks ?? null
    });
    setIsNewStreamerOpen(false);
  };
  const isDirectPhotoMode = submitLabel.includes("Appliquer");

  useEffect(() => {
    if (snapshot.streamerName && !isNewStreamerOpen) {
      setIsNewStreamerOpen(true);
      return;
    }

    if (!snapshot.streamerName && snapshot.streamerId && isNewStreamerOpen) {
      setIsNewStreamerOpen(false);
    }
  }, [isNewStreamerOpen, snapshot.streamerId, snapshot.streamerName]);

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

      <fieldset>
        <legend>Contact</legend>
        <div className="relationship-draft-list">
          {snapshot.phoneNumbers.map((phoneNumber, index) => (
            <div
              key={phoneRowIdsRef.current[index]}
              className="relationship-draft-row phone-draft-row"
            >
              <label className="phone-row-field">
                <input
                  type="text"
                  value={phoneNumber}
                  placeholder="Numéro de téléphone"
                  onChange={(event) => {
                    updatePhoneNumbers(
                      snapshot.phoneNumbers.map((current, currentIndex) =>
                        currentIndex === index ? event.target.value : current
                      )
                    );
                  }}
                />
              </label>
              <button
                type="button"
                className="remove-row-button"
                aria-label="Retirer ce numéro de téléphone"
                title="Retirer ce numéro de téléphone"
                onClick={() => {
                  updatePhoneNumbers(
                    snapshot.phoneNumbers.filter(
                      (_phoneNumber, currentIndex) => currentIndex !== index
                    )
                  );
                }}
              >
                <img src={deleteIconUrl} alt="" aria-hidden="true" />
              </button>
            </div>
          ))}
          <div className="draft-list-footer">
            <button
              type="button"
              className="add-row-button"
              aria-label="Ajouter un numéro de téléphone"
              title="Ajouter un numéro de téléphone"
              onClick={() => {
                updatePhoneNumbers([...snapshot.phoneNumbers, ""]);
              }}
            >
              <img src={addIconUrl} alt="" aria-hidden="true" />
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Relations</legend>
        <div className="relationship-draft-list">
          {snapshot.relationships.map((relationship, index) => (
            <div
              key={`${relationship.type}-${relationship.characterId}`}
              className="relationship-draft-row relation-draft-row"
            >
              <label>
                <span>Lien</span>
                <select
                  value={relationship.type}
                  onChange={(event) => {
                    updateRelationshipAt(index, {
                      type: relationshipType(event.target.value)
                    });
                  }}
                >
                  {relationTypeGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map((value) => (
                        <option key={value} value={value}>
                          {relationLabels[value]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                <span>Personnage</span>
                <select
                  value={relationship.characterId}
                  onChange={(event) => {
                    updateRelationshipAt(index, {
                      characterId: event.target.value
                    });
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
                className="remove-row-button"
                aria-label="Retirer cette relation"
                title="Retirer cette relation"
                onClick={() => {
                  removeRelationshipAt(index);
                }}
              >
                <img src={deleteIconUrl} alt="" aria-hidden="true" />
              </button>
            </div>
          ))}
          <div className="draft-list-footer">
            <button
              type="button"
              className="add-row-button"
              aria-label="Ajouter une relation"
              title="Ajouter une relation"
              onClick={addRelationship}
              disabled={!availableCharacterOptions.length}
            >
              <img src={addIconUrl} alt="" aria-hidden="true" />
            </button>
          </div>
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
                mode={isDirectPhotoMode ? "direct" : "request"}
                onUpload={onPhotoUpload}
              />
            </div>
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend>Médias</legend>
        <div className="form-grid media-grid">
          <div className="media-streamer-row">
            <label className="media-streamer-field">
              <span>Streamer existant</span>
              <select
                value={snapshot.streamerId ?? ""}
                onChange={(event) => {
                  selectExistingStreamer(nullableValue(event.target.value));
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
            {!isNewStreamerOpen ? (
              <button
                type="button"
                className="add-row-button media-streamer-toggle"
                aria-label="Ajouter un streamer"
                title="Ajouter un streamer"
                onClick={() => {
                  setIsNewStreamerOpen(true);
                  updateSnapshot({
                    streamerId: null,
                    streamerName: null,
                    socialLinks: null
                  });
                }}
              >
                <img src={addIconUrl} alt="" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {isNewStreamerOpen ? (
            <div className="media-streamer-create-row">
              <label className="media-streamer-create-field">
                <span>Nouveau streamer</span>
                <input
                  type="text"
                  value={textValue(snapshot.streamerName)}
                  placeholder="Nom public"
                  onChange={(event) => {
                    updateSnapshot({
                      streamerId: null,
                      streamerName: nullableValue(event.target.value)
                    });
                  }}
                />
              </label>
              <div className="media-streamer-create-action">
                <span aria-hidden="true" className="media-streamer-action-spacer" />
                <button
                  type="button"
                  className="ghost-button compact-action media-streamer-cancel"
                  onClick={() => {
                    setIsNewStreamerOpen(false);
                    updateSnapshot({
                      streamerName: null,
                      socialLinks: selectedStreamer?.socialLinks ?? null
                    });
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : null}
          {socialPlatforms.map(([platform, label]) => (
            <label key={platform}>
              <span>{label}</span>
              <input
                type="text"
                value={textValue(snapshot.socialLinks?.[platform] ?? null)}
                placeholder={
                  areSocialLinksEditable ? `Lien ${label}` : "Sélectionner ou créer un streamer"
                }
                disabled={!areSocialLinksEditable}
                onChange={(event) => {
                  updateSocialLink(platform, event.target.value);
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
