import { useState } from "react";

import type { AdminUser } from "../api";

type AdminAnonymizationDialogProps = {
  user: AdminUser;
  onCancel: () => void;
  onConfirm: (user: AdminUser) => void;
};

const confirmationText = "ANONYMISER";

export function AdminAnonymizationDialog({
  user,
  onCancel,
  onConfirm
}: AdminAnonymizationDialogProps) {
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const canConfirm = typedConfirmation.trim() === confirmationText;

  return (
    <div className="admin-confirmation-backdrop" role="presentation">
      <section
        className="admin-confirmation-dialog"
        role="dialog"
        aria-labelledby="admin-anonymization-title"
        aria-modal="true"
      >
        <div>
          <p className="eyebrow">Action RGPD sensible</p>
          <h3 id="admin-anonymization-title">Anonymiser le compte</h3>
        </div>
        <p className="muted-copy">
          Cette action retire les moyens de connexion, révoque les sessions et remplace les données
          directement identifiantes du compte de {user.displayName}.
        </p>
        <label>
          Tape {confirmationText} pour confirmer
          <input
            value={typedConfirmation}
            onChange={(event) => {
              setTypedConfirmation(event.target.value);
            }}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="ghost-button danger-action"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(user);
            }}
          >
            Anonymiser
          </button>
        </div>
      </section>
    </div>
  );
}
