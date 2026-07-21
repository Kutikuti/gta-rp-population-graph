import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminDashboard,
  type AdminTagInput,
  type AdminUser,
  type AdminUserPersonalDataExport,
  anonymizeAdminUserAccount,
  banAdminUser,
  createAdminTag,
  type DataCompletenessReport,
  deleteAdminTag,
  getAdminDashboard,
  getAdminDataCompleteness,
  getAdminUserPersonalData,
  revokeAdminUserBan,
  revokeAdminUserSessions,
  unlinkAdminUserIdentity,
  updateAdminTag,
  updateAdminUserRole
} from "../api";
import type { AuthProvider } from "../components/AuthProviderIcon";
import {
  adminErrorMessage,
  emptyTagInput,
  normalizeTagInput,
  tagInputFromTag
} from "../components/admin-shared";

type UseAdminViewStateInput = {
  canAdmin: boolean;
  onError: (message: string) => void;
};

export function useAdminViewState({ canAdmin, onError }: UseAdminViewStateInput) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [tagInput, setTagInput] = useState<AdminTagInput>(emptyTagInput);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCompletenessLoading, setIsCompletenessLoading] = useState(false);
  const [isPersonalDataLoading, setIsPersonalDataLoading] = useState(false);
  const [completenessReport, setCompletenessReport] = useState<DataCompletenessReport | null>(null);
  const [personalDataExport, setPersonalDataExport] = useState<AdminUserPersonalDataExport | null>(
    null
  );
  const [anonymizationCandidate, setAnonymizationCandidate] = useState<AdminUser | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const editingTag = useMemo(
    () => dashboard?.tags.find((tag) => tag.id === editingTagId) ?? null,
    [dashboard, editingTagId]
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      setDashboard(await getAdminDashboard());
    } catch {
      onError("L'administration n'a pas pu être chargée.");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const loadCompleteness = useCallback(async () => {
    setIsCompletenessLoading(true);
    try {
      setCompletenessReport(await getAdminDataCompleteness());
    } catch {
      onError("La vue de complétude n'a pas pu être chargée.");
    } finally {
      setIsCompletenessLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (canAdmin) {
      void loadDashboard();
      void loadCompleteness();
    }
  }, [canAdmin, loadCompleteness, loadDashboard]);

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      await Promise.all([loadDashboard(), loadCompleteness()]);
      setFeedback(message);
    } catch (error) {
      onError(adminErrorMessage(error));
    }
  };

  const loadPersonalDataExport = async (user: AdminUser) => {
    setIsPersonalDataLoading(true);

    try {
      setPersonalDataExport(await getAdminUserPersonalData(user.id));
    } catch {
      onError("Les données RGPD de cet utilisateur n'ont pas pu être chargées.");
    } finally {
      setIsPersonalDataLoading(false);
    }
  };

  const revokeUserSessions = async (user: AdminUser) => {
    try {
      const result = await revokeAdminUserSessions(user.id);
      setFeedback(
        result ? `${result.revokedCount} session(s) révoquée(s).` : "Sessions révoquées."
      );
      await loadPersonalDataExport(user);
    } catch (error) {
      onError(adminErrorMessage(error));
    }
  };

  const unlinkUserIdentity = async (user: AdminUser, provider: AuthProvider) => {
    try {
      await unlinkAdminUserIdentity(user.id, provider);
      setFeedback("Compte lié dissocié.");
      await loadPersonalDataExport(user);
    } catch (error) {
      onError(adminErrorMessage(error));
    }
  };

  const anonymizeUserAccount = async (user: AdminUser) => {
    try {
      const result = await anonymizeAdminUserAccount(user.id);
      setFeedback(
        result
          ? `Compte anonymisé. ${result.unlinkedIdentities} identité(s) dissociée(s), ${result.revokedSessions} session(s) révoquée(s).`
          : "Compte anonymisé."
      );
      setAnonymizationCandidate(null);
      await Promise.all([loadDashboard(), loadPersonalDataExport(user)]);
    } catch (error) {
      onError(adminErrorMessage(error));
    }
  };

  const submitTag = async (event: FormEvent) => {
    event.preventDefault();
    const input = normalizeTagInput(tagInput);

    await runAction(
      () => (editingTag ? updateAdminTag(editingTag.id, input) : createAdminTag(input)),
      editingTag ? "Tag modifié." : "Tag créé."
    );
    setTagInput(emptyTagInput);
    setEditingTagId(null);
  };

  const updateBanReason = (userId: string, value: string) => {
    setBanReasons((current) => ({
      ...current,
      [userId]: value
    }));
  };

  const banUser = (user: AdminUser) => {
    const reason = banReasons[user.id]?.trim();

    if (!reason) {
      onError("Un motif de bannissement est requis.");
      return;
    }

    void runAction(() => banAdminUser(user.id, reason), "Utilisateur banni.");
  };

  const editTag = (tag: NonNullable<AdminDashboard>["tags"][number]) => {
    setEditingTagId(tag.id);
    setTagInput(tagInputFromTag(tag));
  };

  const cancelTagEdit = () => {
    setEditingTagId(null);
    setTagInput(emptyTagInput);
  };

  return {
    actions: dashboard?.actions ?? [],
    anonymizationCandidate,
    banReasons,
    completenessReport,
    editingTag,
    feedback,
    isCompletenessLoading,
    isLoading,
    isPersonalDataLoading,
    personalDataExport,
    tagInput,
    tags: dashboard?.tags ?? [],
    users: dashboard?.users ?? [],
    anonymizeUserAccount,
    banUser,
    cancelTagEdit,
    deleteTag: (tagId: string) => {
      void runAction(() => deleteAdminTag(tagId), "Tag supprimé.");
    },
    editTag,
    loadPersonalDataExport,
    revokeBan: (userId: string) => {
      void runAction(() => revokeAdminUserBan(userId), "Bannissement levé.");
    },
    revokeUserSessions,
    setAnonymizationCandidate,
    setTagInput,
    submitTag,
    unlinkUserIdentity,
    updateBanReason,
    updateUserRole: (userId: string, roleName: "user" | "moderator" | "administrator") => {
      void runAction(() => updateAdminUserRole(userId, roleName), "Rôle mis à jour.");
    }
  };
}
