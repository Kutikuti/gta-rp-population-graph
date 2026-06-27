import type { AuthSession, ChangeRequestSummary, CharacterSnapshot } from "../api";

export type SnapshotDiffRow = {
  field: keyof CharacterSnapshot;
  oldValue: CharacterSnapshot[keyof CharacterSnapshot] | null;
  newValue: CharacterSnapshot[keyof CharacterSnapshot] | null;
};

export const canModerate = (session: AuthSession | null) =>
  session?.authenticated &&
  (session.user.role.name === "moderator" || session.user.role.name === "administrator");

export const getSelectedModerationRequest = (
  requests: ChangeRequestSummary[],
  selectedId: string | null
) => requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;

export const diffSnapshots = (
  current: CharacterSnapshot | null,
  proposed: CharacterSnapshot
): SnapshotDiffRow[] => {
  if (!current) {
    return Object.keys(proposed)
      .filter((key) => {
        const typedKey = key as keyof CharacterSnapshot;
        return JSON.stringify(proposed[typedKey] ?? null) !== JSON.stringify(null);
      })
      .map((key) => {
        const typedKey = key as keyof CharacterSnapshot;
        return {
          field: typedKey,
          oldValue: null,
          newValue: proposed[typedKey]
        };
      });
  }

  return Object.keys(proposed)
    .filter((key) => {
      const typedKey = key as keyof CharacterSnapshot;
      return (
        JSON.stringify(current[typedKey] ?? null) !== JSON.stringify(proposed[typedKey] ?? null)
      );
    })
    .map((key) => {
      const typedKey = key as keyof CharacterSnapshot;
      return {
        field: typedKey,
        oldValue: current[typedKey],
        newValue: proposed[typedKey]
      };
    });
};
