import type { AuthProvider, RoleName } from "../db/enums.js";
import { models } from "../db/index.js";
import {
  type AdminNotionImportApplyResult,
  type AdminNotionImportBatch,
  type AdminNotionImportDetail,
  type AdminNotionImportPhotoResult,
  SequelizeAdminNotionImportService
} from "./admin-notion-imports.js";
import {
  type AdminDashboard,
  type AdminTag,
  type AdminUser,
  adminActionInclude,
  type BanInput,
  serializeAdminAction,
  serializeUser,
  type TagInput,
  userInclude
} from "./admin-shared.js";
import { SequelizeAdminTagService } from "./admin-tags.js";
import {
  type AdminUserAnonymizationResult,
  type AdminUserIdentityUnlinkResult,
  type AdminUserPersonalDataExport,
  type AdminUserSessionRevocationResult,
  SequelizeAdminUserService
} from "./admin-users.js";

export type { AdminNotionImportBatch, AdminNotionImportDetail } from "./admin-notion-imports.js";
export type AdminNotionImportEntry = AdminNotionImportDetail["entries"][number];
export type { AdminNotionImportPhotoResult } from "./admin-notion-imports-shared.js";
export type {
  AdminDashboard,
  AdminTag,
  AdminUser,
  BanInput,
  TagInput
} from "./admin-shared.js";
export type {
  AdminUserAnonymizationResult,
  AdminUserIdentityUnlinkResult,
  AdminUserPersonalDataExport,
  AdminUserSessionRevocationResult
} from "./admin-users.js";

export type AdminService = {
  getDashboard(): Promise<AdminDashboard>;
  exportUserPersonalData(userId: string): Promise<AdminUserPersonalDataExport | null>;
  revokeUserSessions(
    actorUserId: string,
    userId: string
  ): Promise<AdminUserSessionRevocationResult>;
  unlinkUserIdentity(
    actorUserId: string,
    userId: string,
    provider: AuthProvider
  ): Promise<AdminUserIdentityUnlinkResult>;
  anonymizeUserAccount(actorUserId: string, userId: string): Promise<AdminUserAnonymizationResult>;
  listNotionImports(): Promise<AdminNotionImportBatch[]>;
  getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null>;
  applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportApplyResult>;
  importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportPhotoResult>;
  createTag(actorUserId: string, input: TagInput): Promise<AdminTag>;
  updateTag(actorUserId: string, tagId: string, input: TagInput): Promise<AdminTag | null>;
  deleteTag(actorUserId: string, tagId: string): Promise<"deleted" | "in_use" | "not_found">;
  updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null>;
  banUser(actorUserId: string, userId: string, input: BanInput): Promise<AdminUser | null>;
  revokeUserBan(actorUserId: string, userId: string): Promise<AdminUser | null>;
};

export class SequelizeAdminService implements AdminService {
  readonly #notionImports = new SequelizeAdminNotionImportService();
  readonly #tags = new SequelizeAdminTagService();
  readonly #users = new SequelizeAdminUserService();

  async getDashboard(): Promise<AdminDashboard> {
    const [users, tags, actions] = await Promise.all([
      models.User.findAll({
        include: userInclude(),
        order: [["createdAt", "DESC"]]
      }),
      this.#tags.listTagsWithUsage(),
      models.AdminAction.findAll({
        include: adminActionInclude,
        order: [["createdAt", "DESC"]],
        limit: 50
      })
    ]);

    return {
      users: users.map(serializeUser),
      tags,
      actions: actions.map(serializeAdminAction)
    };
  }

  async exportUserPersonalData(userId: string): Promise<AdminUserPersonalDataExport | null> {
    return this.#users.exportUserPersonalData(userId);
  }

  async revokeUserSessions(
    actorUserId: string,
    userId: string
  ): Promise<AdminUserSessionRevocationResult> {
    return this.#users.revokeUserSessions(actorUserId, userId);
  }

  async unlinkUserIdentity(
    actorUserId: string,
    userId: string,
    provider: AuthProvider
  ): Promise<AdminUserIdentityUnlinkResult> {
    return this.#users.unlinkUserIdentity(actorUserId, userId, provider);
  }

  async anonymizeUserAccount(
    actorUserId: string,
    userId: string
  ): Promise<AdminUserAnonymizationResult> {
    return this.#users.anonymizeUserAccount(actorUserId, userId);
  }

  async listNotionImports(): Promise<AdminNotionImportBatch[]> {
    return this.#notionImports.listNotionImports();
  }

  async getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null> {
    return this.#notionImports.getNotionImportDetail(batchId);
  }

  async applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportApplyResult> {
    return this.#notionImports.applyNotionImportEntry(input);
  }

  async importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<AdminNotionImportPhotoResult> {
    return this.#notionImports.importNotionImportEntryPhoto(input);
  }

  async createTag(actorUserId: string, input: TagInput): Promise<AdminTag> {
    return this.#tags.createTag(actorUserId, input);
  }

  async updateTag(actorUserId: string, tagId: string, input: TagInput): Promise<AdminTag | null> {
    return this.#tags.updateTag(actorUserId, tagId, input);
  }

  async deleteTag(actorUserId: string, tagId: string): Promise<"deleted" | "in_use" | "not_found"> {
    return this.#tags.deleteTag(actorUserId, tagId);
  }

  async updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null> {
    return this.#users.updateUserRole(actorUserId, userId, roleName);
  }

  async banUser(actorUserId: string, userId: string, input: BanInput): Promise<AdminUser | null> {
    return this.#users.banUser(actorUserId, userId, input);
  }

  async revokeUserBan(actorUserId: string, userId: string): Promise<AdminUser | null> {
    return this.#users.revokeUserBan(actorUserId, userId);
  }
}
