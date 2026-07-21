type ProfileIdentitySectionProps = {
  displayName: string;
  email: string;
  isSaving: boolean;
  mustChooseDisplayName: boolean;
  onDisplayNameChange: (displayName: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ProfileIdentitySection({
  displayName,
  email,
  isSaving,
  mustChooseDisplayName,
  onDisplayNameChange,
  onSubmit
}: ProfileIdentitySectionProps) {
  return (
    <>
      {mustChooseDisplayName ? (
        <p className="inline-feedback warning-text">Choisis un nom public avant de contribuer.</p>
      ) : null}
      <form className="snapshot-form" onSubmit={onSubmit}>
        <fieldset>
          <legend>Identité publique</legend>
          <label>
            Nom d'affichage public
            <input
              value={displayName}
              minLength={3}
              maxLength={40}
              onChange={(event) => {
                onDisplayNameChange(event.target.value);
              }}
            />
          </label>
          <p className="muted-copy">Email de connexion : {email}</p>
          <div className="form-actions">
            <button type="submit" className="primary-action" disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
