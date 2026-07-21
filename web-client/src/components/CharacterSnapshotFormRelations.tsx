import { useRef } from "react";

import type { CharacterSnapshot, PublicCharacterReference } from "../api";
import addIconUrl from "../assets/misc/add.svg";
import deleteIconUrl from "../assets/misc/delete.svg";
import { relationLabels, relationTypeGroups } from "../constants";

type RelationType = CharacterSnapshot["relationships"][number]["type"];

type PhoneNumbersFieldsetProps = {
  phoneNumbers: string[];
  onChange: (phoneNumbers: string[]) => void;
};

export function PhoneNumbersFieldset({ phoneNumbers, onChange }: PhoneNumbersFieldsetProps) {
  const phoneRowIdsRef = useRef<string[]>(phoneNumbers.map(() => crypto.randomUUID()));

  if (phoneRowIdsRef.current.length < phoneNumbers.length) {
    phoneRowIdsRef.current.push(
      ...Array.from({ length: phoneNumbers.length - phoneRowIdsRef.current.length }, () =>
        crypto.randomUUID()
      )
    );
  } else if (phoneRowIdsRef.current.length > phoneNumbers.length) {
    phoneRowIdsRef.current = phoneRowIdsRef.current.slice(0, phoneNumbers.length);
  }

  return (
    <fieldset>
      <legend>Contact</legend>
      <div className="relationship-draft-list">
        {phoneNumbers.map((phoneNumber, index) => (
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
                  onChange(
                    phoneNumbers.map((current, currentIndex) =>
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
                onChange(
                  phoneNumbers.filter((_phoneNumber, currentIndex) => currentIndex !== index)
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
              onChange([...phoneNumbers, ""]);
            }}
          >
            <img src={addIconUrl} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    </fieldset>
  );
}

type RelationshipsFieldsetProps = {
  relationships: CharacterSnapshot["relationships"];
  characterOptions: PublicCharacterReference[];
  currentCharacterId: string | null;
  onChange: (relationships: CharacterSnapshot["relationships"]) => void;
};

export function RelationshipsFieldset({
  relationships,
  characterOptions,
  currentCharacterId,
  onChange
}: RelationshipsFieldsetProps) {
  const availableCharacterOptions = characterOptions.filter(
    (character) => character.id !== currentCharacterId
  );
  const relationshipType = (value: string) => value as RelationType;
  const addRelationship = () => {
    const defaultCharacterId = availableCharacterOptions[0]?.id ?? "";

    if (!defaultCharacterId) {
      return;
    }

    onChange([
      ...relationships,
      {
        characterId: defaultCharacterId,
        type: "parent"
      }
    ]);
  };
  const removeRelationshipAt = (index: number) => {
    onChange(relationships.filter((_relationship, currentIndex) => currentIndex !== index));
  };
  const updateRelationshipAt = (
    index: number,
    changes: Partial<CharacterSnapshot["relationships"][number]>
  ) => {
    onChange(
      relationships.map((relationship, currentIndex) =>
        currentIndex === index ? { ...relationship, ...changes } : relationship
      )
    );
  };

  return (
    <fieldset>
      <legend>Relations</legend>
      <div className="relationship-draft-list">
        {relationships.map((relationship, index) => (
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
  );
}
