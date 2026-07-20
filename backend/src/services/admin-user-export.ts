import type { ChangeRequestStatus } from "../db/enums.js";
import { models, sequelize } from "../db/index.js";
import { type AdminUser, activeBanWhere, serializeUser } from "./admin-shared.js";

export type AdminUserPersonalDataExport = {
  exportedAt: string;
  user: AdminUser;
  linkedIdentities: Array<{
    id: string;
    provider: "google" | "discord" | "twitch";
    providerEmail: string | null;
    providerDisplayName: string | null;
    providerAvatarUrl: string | null;
    connectedAt: string;
    lastUsedAt: string | null;
  }>;
  sessions: {
    total: number;
    active: number;
    latestExpiryAt: string | null;
  };
  contributions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    latestRequestAt: string | null;
  };
  moderationTrace: {
    changeHistoriesAsModerator: number;
    adminActionsAsActor: number;
    latestAdminActionAt: string | null;
  };
};

type ContributionCountRow = {
  status: ChangeRequestStatus;
  count: string | number;
};

export class SequelizeAdminUserExportService {
  async exportUserPersonalData(userId: string): Promise<AdminUserPersonalDataExport | null> {
    const [user, sessions, contributionCounts, latestRequest, moderationCounts, latestAdminAction] =
      await Promise.all([
        models.User.findByPk(userId, {
          include: [
            { model: models.Role, as: "role" },
            { model: models.Ban, as: "bans", required: false, where: activeBanWhere },
            {
              association: "identities",
              attributes: [
                "id",
                "provider",
                "providerEmail",
                "providerDisplayName",
                "providerAvatarUrl",
                "createdAt",
                "lastUsedAt"
              ],
              required: false
            }
          ]
        }),
        models.UserSession.findAll({
          attributes: ["expiresAt"],
          where: sequelize.where(sequelize.literal("\"data\"->>'userId'"), userId)
        }),
        models.ChangeRequest.findAll({
          attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
          where: { userId },
          group: ["status"],
          raw: true
        }) as unknown as Promise<ContributionCountRow[]>,
        models.ChangeRequest.findOne({
          attributes: ["createdAt"],
          where: { userId },
          order: [["createdAt", "DESC"]]
        }),
        Promise.all([
          models.ChangeHistory.count({ where: { moderatorId: userId } }),
          models.AdminAction.count({ where: { actorUserId: userId } })
        ]),
        models.AdminAction.findOne({
          attributes: ["createdAt"],
          where: { actorUserId: userId },
          order: [["createdAt", "DESC"]]
        })
      ]);

    if (!user) {
      return null;
    }

    const now = Date.now();
    const latestExpiryAt = sessions.reduce<string | null>((latest, session) => {
      const current = session.expiresAt.toISOString();
      return !latest || current > latest ? current : latest;
    }, null);
    const activeSessions = sessions.filter((session) => session.expiresAt.getTime() > now).length;
    const contributionSummary = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    for (const row of contributionCounts) {
      const status = row.status;
      const count = Number(row.count);

      if (status === "pending" || status === "approved" || status === "rejected") {
        contributionSummary[status] = count;
      }
    }

    const [changeHistoriesAsModerator, adminActionsAsActor] = moderationCounts;

    return {
      exportedAt: new Date().toISOString(),
      user: serializeUser(user),
      linkedIdentities: (user.identities ?? []).map((identity) => ({
        id: identity.id,
        provider: identity.provider,
        providerEmail: identity.providerEmail,
        providerDisplayName: identity.providerDisplayName,
        providerAvatarUrl: identity.providerAvatarUrl,
        connectedAt: identity.createdAt.toISOString(),
        lastUsedAt: identity.lastUsedAt ? identity.lastUsedAt.toISOString() : null
      })),
      sessions: {
        total: sessions.length,
        active: activeSessions,
        latestExpiryAt
      },
      contributions: {
        total:
          contributionSummary.pending + contributionSummary.approved + contributionSummary.rejected,
        pending: contributionSummary.pending,
        approved: contributionSummary.approved,
        rejected: contributionSummary.rejected,
        latestRequestAt: latestRequest?.createdAt ? latestRequest.createdAt.toISOString() : null
      },
      moderationTrace: {
        changeHistoriesAsModerator,
        adminActionsAsActor,
        latestAdminActionAt: latestAdminAction?.createdAt
          ? latestAdminAction.createdAt.toISOString()
          : null
      }
    };
  }
}
