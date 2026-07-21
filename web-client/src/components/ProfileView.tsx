import { type FormEvent, useEffect, useState } from "react";

import type {
  AuthSession,
  ChangeRequestSummary,
  PersonalDataExport,
  PublicCharacterReference
} from "../api";
import { exportProfilePersonalData, listCharacterDirectory, listMyChangeRequests } from "../api";
import type { AuthProvider } from "./AuthProviderIcon";
import { ProfileIdentitySection } from "./ProfileIdentitySection";
import { ProfileLinkedAccountsSection } from "./ProfileLinkedAccountsSection";
import { ProfileRequestsSection } from "./ProfileRequestsSection";
import { EmptyBlock } from "./StateBlock";

type ProfileViewProps = {
  session: AuthSession | null;
  onDisplayNameUpdate: (displayName: string) => Promise<boolean>;
  onIdentityUnlink: (provider: AuthProvider) => Promise<boolean>;
  onError: (message: string) => void;
};

const displayNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u;

export function ProfileView({
  session,
  onDisplayNameUpdate,
  onIdentityUnlink,
  onError
}: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(
    session?.authenticated ? session.user.displayName : ""
  );
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [characterOptions, setCharacterOptions] = useState<PublicCharacterReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [personalDataExport, setPersonalDataExport] = useState<PersonalDataExport | null>(null);

  useEffect(() => {
    if (session?.authenticated) {
      setDisplayName(session.user.displayName);
    }
  }, [session]);

  useEffect(() => {
    if (!session?.authenticated) {
      setRequests([]);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    listMyChangeRequests()
      .then((items) => {
        if (isActive) {
          setRequests(items);
          setExpandedRequestId((current) => current ?? items[0]?.id ?? null);
        }
      })
      .catch(() => {
        onError("Impossible de charger tes contributions.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onError, session]);

  useEffect(() => {
    let isActive = true;

    listCharacterDirectory()
      .then((items) => {
        if (isActive) {
          setCharacterOptions(items);
        }
      })
      .catch(() => {
        onError("Impossible de charger le répertoire des personnages.");
      });

    return () => {
      isActive = false;
    };
  }, [onError]);

  if (!session?.authenticated) {
    return (
      <section className="full-page-view" aria-labelledby="profile-title">
        <div className="full-page-grid single-column">
          <div className="work-panel">
            <EmptyBlock label="Connecte-toi pour accéder au profil." />
          </div>
        </div>
      </section>
    );
  }

  const submitDisplayName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedDisplayName = displayName.trim();

    if (
      trimmedDisplayName.length < 3 ||
      trimmedDisplayName.length > 40 ||
      !displayNamePattern.test(trimmedDisplayName)
    ) {
      onError(
        "Le nom public doit contenir 3 a 40 caracteres et commencer par une lettre ou un chiffre."
      );
      return;
    }

    setIsSaving(true);
    const isSaved = await onDisplayNameUpdate(trimmedDisplayName);
    setIsSaving(false);

    if (isSaved) {
      setDisplayName(trimmedDisplayName);
    }
  };

  const handleIdentityUnlinkClick = async (provider: AuthProvider) => {
    setUnlinkingProvider(provider);
    await onIdentityUnlink(provider);
    setUnlinkingProvider(null);
  };

  const handlePersonalDataExport = async () => {
    setIsExporting(true);

    try {
      setPersonalDataExport(await exportProfilePersonalData());
    } catch {
      onError("Impossible de préparer l'export de tes données personnelles.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="full-page-view" aria-labelledby="profile-title">
      <div className="full-page-header">
        <div>
          <p className="eyebrow">Profil utilisateur</p>
          <h2 id="profile-title">Nom public et contributions</h2>
        </div>
      </div>

      <div className="full-page-grid single-column">
        <div className="work-panel profile-main-panel">
          <ProfileIdentitySection
            displayName={displayName}
            email={session.user.email}
            isSaving={isSaving}
            mustChooseDisplayName={session.user.mustChooseDisplayName}
            onDisplayNameChange={setDisplayName}
            onSubmit={submitDisplayName}
          />

          <ProfileLinkedAccountsSection
            identities={session.user.linkedIdentities}
            isExporting={isExporting}
            personalDataExport={personalDataExport}
            unlinkingProvider={unlinkingProvider}
            onExportPersonalData={() => {
              void handlePersonalDataExport();
            }}
            onIdentityUnlink={(provider) => {
              void handleIdentityUnlinkClick(provider);
            }}
          />

          <ProfileRequestsSection
            characterOptions={characterOptions}
            expandedRequestId={expandedRequestId}
            isLoading={isLoading}
            requests={requests}
            onExpandedRequestChange={setExpandedRequestId}
          />
        </div>
      </div>
    </section>
  );
}
