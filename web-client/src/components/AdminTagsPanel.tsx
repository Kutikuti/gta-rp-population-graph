import type { FormEvent } from "react";

import type { AdminTag, AdminTagInput } from "../api";
import { tagTypeLabels } from "./admin-shared";

type AdminTagsPanelProps = {
  editingTag: AdminTag | null;
  tagInput: AdminTagInput;
  tags: AdminTag[];
  onCancelEdit: () => void;
  onDeleteTag: (tag: AdminTag) => void;
  onEditTag: (tag: AdminTag) => void;
  onSubmit: (event: FormEvent) => void;
  onTagInputChange: (input: AdminTagInput) => void;
};

export function AdminTagsPanel({
  editingTag,
  tagInput,
  tags,
  onCancelEdit,
  onDeleteTag,
  onEditTag,
  onSubmit,
  onTagInputChange
}: AdminTagsPanelProps) {
  return (
    <section className="work-panel admin-panel">
      <h3>Tags</h3>
      <form className="admin-form" onSubmit={onSubmit}>
        <label>
          Nom
          <input
            value={tagInput.name}
            onChange={(event) => {
              onTagInputChange({ ...tagInput, name: event.target.value });
            }}
          />
        </label>
        <label>
          Type
          <select
            value={tagInput.type ?? ""}
            onChange={(event) => {
              onTagInputChange({
                ...tagInput,
                type: event.target.value ? (event.target.value as AdminTag["type"]) : null
              });
            }}
          >
            <option value="">Aucun</option>
            {Object.entries(tagTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Couleur
          <input
            type="color"
            value={tagInput.colorHex}
            onChange={(event) => {
              onTagInputChange({ ...tagInput, colorHex: event.target.value });
            }}
          />
        </label>
        <label>
          Description
          <textarea
            value={tagInput.description ?? ""}
            onChange={(event) => {
              onTagInputChange({ ...tagInput, description: event.target.value });
            }}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-action">
            {editingTag ? "Modifier le tag" : "Créer le tag"}
          </button>
          {editingTag ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onCancelEdit();
              }}
            >
              Annuler
            </button>
          ) : null}
        </div>
      </form>
      <div className="admin-list">
        {tags.map((tag) => (
          <article key={tag.id} className="admin-row">
            <div>
              <strong>
                <span className="tag-color-swatch" style={{ background: tag.colorHex }} />
                {tag.name}
              </strong>
              <small>{tag.type ? tagTypeLabels[tag.type] : "Sans type"}</small>
              <small>{tag.usageCount} fiche(s)</small>
            </div>
            <div className="admin-row-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  onEditTag(tag);
                }}
              >
                Modifier
              </button>
              <button
                type="button"
                className="ghost-button danger-action"
                disabled={tag.usageCount > 0}
                onClick={() => {
                  onDeleteTag(tag);
                }}
              >
                Supprimer
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
