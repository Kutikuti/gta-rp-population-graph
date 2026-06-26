import { Op, type Transaction } from "sequelize";

import {
  type LifeStatus,
  type RelationshipType,
  type RoleName,
  roleNames,
  type TagType,
  tagTypes,
  type VerificationStatus
} from "../db/enums.js";
import {
  type Character,
  initModels,
  type JsonObject,
  type NotionImportBatch,
  type NotionImportEntry,
  Role,
  type Tag,
  type User
} from "../db/models/index.js";
import { createSequelize } from "../db/sequelize.js";
import {
  deleteStoredCharacterPhoto,
  InvalidCharacterPhotoError,
  importCharacterPhotoFromRemoteUrl
} from "./character-photos.js";
import { relationshipDirection, relationshipLabel } from "./character-relationships.js";
import { generateUniqueCharacterSlug } from "./character-slug.js";
import { type NotionImportPreviewItem, previewNotionImportEntry } from "./notion-import.js";

const sequelize = createSequelize();
const models = initModels(sequelize);

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: {
    id: string;
    name: RoleName;
  };
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminTag = {
  id: string;
  name: string;
  type: TagType | null;
  colorHex: string;
  description: string | null;
  usageCount: number;
};

export type AdminActionEntry = {
  id: string;
  actor: {
    id: string;
    displayName: string;
  } | null;
  targetUser: {
    id: string;
    displayName: string;
  } | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: JsonObject;
  createdAt: string;
};

export type AdminDashboard = {
  users: AdminUser[];
  tags: AdminTag[];
  actions: AdminActionEntry[];
};

export type AdminNotionImportBatch = {
  id: string;
  sourceName: string;
  status: string;
  sourceSnapshot: JsonObject;
  totals: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotionImportEntry = NotionImportPreviewItem & {
  rawContent: JsonObject;
  mappedSnapshot: JsonObject;
  mappingReport: JsonObject;
  appliedCharacterId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type AdminNotionImportDetail = {
  batch: AdminNotionImportBatch;
  entries: AdminNotionImportEntry[];
};

export type TagInput = {
  name: string;
  type: TagType | null;
  colorHex: string;
  description: string | null;
};

export type BanInput = {
  reason: string;
};

export type AdminService = {
  getDashboard(): Promise<AdminDashboard>;
  listNotionImports(): Promise<AdminNotionImportBatch[]>;
  getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null>;
  applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<
    | { status: "applied"; entry: AdminNotionImportEntry; characterId: string; created: boolean }
    | { status: "not_found" }
    | { status: "invalid"; code: string; message: string; details?: JsonObject }
  >;
  importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<
    | { status: "imported"; entry: AdminNotionImportEntry; characterId: string; photoUrl: string }
    | { status: "not_found" }
    | { status: "invalid"; code: string; message: string; details?: JsonObject }
  >;
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

const activeBanWhere = {
  revokedAt: null,
  [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
};

const isoDate = (value: Date | null) => (value ? value.toISOString() : null);

const serializeUser = (user: User): AdminUser => {
  if (!user.role) {
    throw new Error(`User ${user.id} is missing its role.`);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: {
      id: user.role.id,
      name: user.role.name
    },
    isBanned: Boolean(user.bans?.length),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: isoDate(user.lastLoginAt)
  };
};

const serializeTag = (tag: Tag, usageCount = 0): AdminTag => ({
  id: tag.id,
  name: tag.name,
  type: tag.type,
  colorHex: tag.colorHex,
  description: tag.description,
  usageCount
});

const serializeImportBatch = (batch: NotionImportBatch): AdminNotionImportBatch => ({
  id: batch.id,
  sourceName: batch.sourceName,
  status: batch.status,
  sourceSnapshot: batch.sourceSnapshot,
  totals:
    batch.report && typeof batch.report === "object" && "totals" in batch.report
      ? ((batch.report as { totals?: Record<string, number> }).totals ?? {})
      : {},
  createdAt: batch.createdAt.toISOString(),
  updatedAt: batch.updatedAt.toISOString()
});

const serializeImportEntry = (entry: NotionImportEntry): AdminNotionImportEntry => ({
  ...previewNotionImportEntry(entry),
  rawContent: entry.rawContent,
  mappedSnapshot: entry.mappedSnapshot,
  mappingReport: entry.mappingReport,
  appliedCharacterId: entry.appliedCharacterId,
  appliedAt: isoDate(entry.appliedAt),
  createdAt: entry.createdAt.toISOString()
});

const DEFAULT_TAG_COLOR = "#2f9bff";

type ImportRelationshipDraft = {
  type: RelationshipType;
  targetName: string;
};

type ImportEntryCandidate = {
  firstName: string;
  lastName: string;
  nickname: string | null;
  lifeStatus: LifeStatus;
  deathOrDepartureDate: string | null;
  phoneNumber: string | null;
  streamerPublicName: string | null;
  socialLinks: Record<string, string> | null;
  businessName: string | null;
  groupName: string | null;
  groupRole: string | null;
  district: string | null;
  isRpDeath: boolean;
  policeRank: string | null;
  policeBadgeNumber: string | null;
  previousCharacters: JsonObject | null;
  verificationStatus: VerificationStatus;
  sourceNote: string | null;
  tags: string[];
  relationships: ImportRelationshipDraft[];
  photoReferences: string[];
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();

const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const booleanValue = (value: unknown) => value === true;

const stringListValue = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

const jsonRecordValue = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entryValue]) => entryValue !== null)
  ) as JsonObject;
};

const relationshipTypes = new Set<RelationshipType>([
  "parent",
  "child",
  "sibling",
  "couple",
  "previous_character",
  "couple_reference",
  "aunt_or_uncle_reference",
  "ex_partner_reference",
  "uncle_reference",
  "aunt_reference"
]);

const importCandidateFromEntry = (entry: NotionImportEntry): ImportEntryCandidate | null => {
  const snapshot = entry.mappedSnapshot as Record<string, unknown>;
  const firstName = stringValue(snapshot.firstName);
  const lastName = stringValue(snapshot.lastName);
  const verificationStatus = stringValue(snapshot.verificationStatus) as VerificationStatus | null;
  const lifeStatus = stringValue(snapshot.lifeStatus) as LifeStatus | null;

  if (!firstName || !lastName || !verificationStatus || !lifeStatus) {
    return null;
  }

  const relationships = Array.isArray(snapshot.relationships)
    ? snapshot.relationships.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return [];
        }

        const type = stringValue((item as Record<string, unknown>).type);
        const targetName = stringValue((item as Record<string, unknown>).target);

        if (!type || !targetName || !relationshipTypes.has(type as RelationshipType)) {
          return [];
        }

        return [{ type: type as RelationshipType, targetName }];
      })
    : [];

  const socialLinksRecord = jsonRecordValue(snapshot.socialLinks);

  return {
    firstName,
    lastName,
    nickname: stringValue(snapshot.nickname),
    lifeStatus,
    deathOrDepartureDate: stringValue(snapshot.deathOrDepartureDate),
    phoneNumber: stringValue(snapshot.phoneNumber),
    streamerPublicName: stringValue(snapshot.streamerPublicName),
    socialLinks:
      socialLinksRecord && Object.keys(socialLinksRecord).length > 0
        ? (socialLinksRecord as Record<string, string>)
        : null,
    businessName: stringValue(snapshot.businessName),
    groupName: stringValue(snapshot.groupName),
    groupRole: stringValue(snapshot.groupRole),
    district: stringValue(snapshot.district),
    isRpDeath: booleanValue(snapshot.isRpDeath),
    policeRank: stringValue(snapshot.policeRank),
    policeBadgeNumber: stringValue(snapshot.policeBadgeNumber),
    previousCharacters: jsonRecordValue(snapshot.previousCharacters),
    verificationStatus,
    sourceNote: stringValue(snapshot.sourceNote),
    tags: stringListValue(snapshot.tags),
    relationships,
    photoReferences: stringListValue(snapshot.photoReferences)
  };
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right, "fr")
    );

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
};

const setChange = (changes: JsonObject, key: string, oldValue: unknown, newValue: unknown) => {
  if (stableJson(oldValue) === stableJson(newValue)) {
    return;
  }

  changes[key] = { old: oldValue, new: newValue };
};

const characterFullName = (character: Pick<Character, "firstName" | "lastName">) =>
  `${character.firstName} ${character.lastName}`;

const relationshipsForCharacter = async (characterId: string, transaction: Transaction) => {
  const relationships = await models.CharacterRelationship.findAll({
    where: {
      [Op.or]: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }]
    },
    include: [
      {
        model: models.Character,
        as: "sourceCharacter",
        attributes: ["id", "firstName", "lastName"]
      },
      {
        model: models.Character,
        as: "targetCharacter",
        attributes: ["id", "firstName", "lastName"]
      }
    ],
    transaction
  });

  return relationships
    .map((relationship) => ({
      type: relationship.type,
      target:
        relationship.sourceCharacterId === characterId
          ? relationship.targetCharacter
            ? characterFullName(relationship.targetCharacter)
            : relationship.targetCharacterId
          : relationship.sourceCharacter
            ? characterFullName(relationship.sourceCharacter)
            : relationship.sourceCharacterId
    }))
    .sort((left, right) =>
      `${left.type}:${left.target}`.localeCompare(`${right.type}:${right.target}`, "fr")
    );
};

const resolveOrCreateStreamerId = async (
  streamerPublicName: string | null,
  verificationStatus: VerificationStatus,
  transaction: Transaction
) => {
  if (!streamerPublicName) {
    return null;
  }

  const existing = await models.Streamer.findOne({
    attributes: ["id"],
    where: {
      publicName: {
        [Op.iLike]: streamerPublicName
      }
    },
    transaction
  });

  if (existing) {
    return existing.id;
  }

  const created = await models.Streamer.create(
    {
      publicName: streamerPublicName,
      primaryPlatform: null,
      socialLinks: null,
      verificationStatus
    },
    { transaction }
  );

  return created.id;
};

const resolveOrCreateTags = async (tagNames: string[], transaction: Transaction) => {
  const uniqueNames = [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];

  if (uniqueNames.length === 0) {
    return [];
  }

  const existingTags = await models.Tag.findAll({
    where: {
      [Op.or]: uniqueNames.map((name) => ({
        name: {
          [Op.iLike]: name
        }
      }))
    },
    transaction
  });

  const tagsByName = new Map(existingTags.map((tag) => [normalizeText(tag.name), tag] as const));
  const resolved: Tag[] = [...existingTags];

  for (const name of uniqueNames) {
    if (tagsByName.has(normalizeText(name))) {
      continue;
    }

    const created = await models.Tag.create(
      {
        name,
        type: "other",
        colorHex: DEFAULT_TAG_COLOR,
        description: null
      },
      { transaction }
    );

    tagsByName.set(normalizeText(created.name), created);
    resolved.push(created);
  }

  return resolved.sort((left, right) => left.name.localeCompare(right.name, "fr"));
};

const syncCharacterTags = async (characterId: string, tags: Tag[], transaction: Transaction) => {
  await models.CharacterTag.destroy({
    where: { characterId },
    transaction
  });

  if (tags.length === 0) {
    return;
  }

  await models.CharacterTag.bulkCreate(
    tags.map((tag) => ({
      characterId,
      tagId: tag.id
    })),
    { transaction }
  );
};

const loadCharacterTags = async (characterId: string, transaction: Transaction) => {
  const character = await models.Character.findByPk(characterId, {
    include: [{ model: models.Tag, as: "tags", through: { attributes: [] } }],
    transaction
  });

  return character?.tags ?? [];
};

const resolveRelationshipTargets = async (
  characterId: string,
  relationships: ImportRelationshipDraft[],
  transaction: Transaction
) => {
  const characters = await models.Character.findAll({
    attributes: ["id", "firstName", "lastName"],
    transaction
  });
  const byFullName = new Map<string, Character[]>();

  for (const character of characters) {
    const key = normalizeText(characterFullName(character));
    const current = byFullName.get(key) ?? [];
    current.push(character);
    byFullName.set(key, current);
  }

  const resolved: Array<ImportRelationshipDraft & { targetCharacterId: string }> = [];
  const unresolved: string[] = [];
  const ambiguous: string[] = [];

  for (const relationship of relationships) {
    const matches = byFullName.get(normalizeText(relationship.targetName)) ?? [];

    if (matches.length === 0) {
      unresolved.push(`${relationship.type}: ${relationship.targetName}`);
      continue;
    }

    if (matches.length > 1) {
      ambiguous.push(`${relationship.type}: ${relationship.targetName}`);
      continue;
    }

    const match = matches[0];

    if (!match || match.id === characterId) {
      continue;
    }

    resolved.push({
      ...relationship,
      targetCharacterId: match.id
    });
  }

  return { resolved, unresolved, ambiguous };
};

const syncImportedRelationships = async (
  characterId: string,
  relationships: Array<ImportRelationshipDraft & { targetCharacterId: string }>,
  verificationStatus: VerificationStatus,
  transaction: Transaction
) => {
  await models.CharacterRelationship.destroy({
    where: {
      sourceCharacterId: characterId,
      source: "notion"
    },
    transaction
  });

  const uniqueRelationships = relationships.filter((relationship, index, array) => {
    return (
      array.findIndex(
        (candidate) =>
          candidate.type === relationship.type &&
          candidate.targetCharacterId === relationship.targetCharacterId
      ) === index
    );
  });

  if (uniqueRelationships.length === 0) {
    return;
  }

  const symmetricRelationships = uniqueRelationships.filter(
    (relationship) => relationshipDirection(relationship.type) === "symmetric"
  );
  const existingSymmetricKeys = new Set<string>();

  if (symmetricRelationships.length > 0) {
    const existingSymmetricRelationships = await models.CharacterRelationship.findAll({
      attributes: ["sourceCharacterId", "targetCharacterId", "type"],
      where: {
        type: {
          [Op.in]: [...new Set(symmetricRelationships.map((relationship) => relationship.type))]
        },
        [Op.or]: [
          {
            sourceCharacterId: characterId,
            targetCharacterId: {
              [Op.in]: symmetricRelationships.map((relationship) => relationship.targetCharacterId)
            }
          },
          {
            targetCharacterId: characterId,
            sourceCharacterId: {
              [Op.in]: symmetricRelationships.map((relationship) => relationship.targetCharacterId)
            }
          }
        ]
      },
      transaction
    });

    for (const relationship of existingSymmetricRelationships) {
      const pair = [relationship.sourceCharacterId, relationship.targetCharacterId]
        .sort((left, right) => left.localeCompare(right, "fr"))
        .join(":");
      existingSymmetricKeys.add(`${relationship.type}:${pair}`);
    }
  }

  const relationshipsToCreate = uniqueRelationships.filter((relationship) => {
    if (relationshipDirection(relationship.type) !== "symmetric") {
      return true;
    }

    const pair = [characterId, relationship.targetCharacterId]
      .sort((left, right) => left.localeCompare(right, "fr"))
      .join(":");

    return !existingSymmetricKeys.has(`${relationship.type}:${pair}`);
  });

  if (relationshipsToCreate.length === 0) {
    return;
  }

  await models.CharacterRelationship.bulkCreate(
    relationshipsToCreate.map((relationship) => ({
      sourceCharacterId: characterId,
      targetCharacterId: relationship.targetCharacterId,
      type: relationship.type,
      direction: relationshipDirection(relationship.type),
      label: relationshipLabel(relationship.type),
      description: null,
      source: "notion",
      verificationStatus
    })),
    { transaction }
  );
};

const refreshAppliedBatchRelationships = async (batchId: string, transaction: Transaction) => {
  const appliedEntries = await models.NotionImportEntry.findAll({
    where: {
      batchId,
      appliedCharacterId: {
        [Op.ne]: null
      }
    },
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  for (const entry of appliedEntries) {
    if (!entry.appliedCharacterId) {
      continue;
    }

    const candidate = importCandidateFromEntry(entry);

    if (!candidate) {
      continue;
    }

    const resolvedRelationships = await resolveRelationshipTargets(
      entry.appliedCharacterId,
      candidate.relationships,
      transaction
    );

    if (resolvedRelationships.ambiguous.length > 0) {
      continue;
    }

    await syncImportedRelationships(
      entry.appliedCharacterId,
      resolvedRelationships.resolved,
      candidate.verificationStatus,
      transaction
    );
  }
};

const userInclude = [
  { model: Role, as: "role" },
  { model: models.Ban, as: "bans", required: false, where: activeBanWhere }
];

export class SequelizeAdminService implements AdminService {
  async getDashboard(): Promise<AdminDashboard> {
    const [users, tags, actions] = await Promise.all([
      models.User.findAll({
        include: userInclude,
        order: [["createdAt", "DESC"]]
      }),
      this.listTagsWithUsage(),
      models.AdminAction.findAll({
        include: [
          { model: models.User, as: "actor", attributes: ["id", "displayName"] },
          { model: models.User, as: "targetUser", attributes: ["id", "displayName"] }
        ],
        order: [["createdAt", "DESC"]],
        limit: 50
      })
    ]);

    return {
      users: users.map(serializeUser),
      tags,
      actions: actions.map((action) => ({
        id: action.id,
        actor: action.actor ? { id: action.actor.id, displayName: action.actor.displayName } : null,
        targetUser: action.targetUser
          ? { id: action.targetUser.id, displayName: action.targetUser.displayName }
          : null,
        action: action.action,
        targetType: action.targetType,
        targetId: action.targetId,
        changes: action.changes,
        createdAt: action.createdAt.toISOString()
      }))
    };
  }

  async listNotionImports(): Promise<AdminNotionImportBatch[]> {
    const batches = await models.NotionImportBatch.findAll({
      order: [["createdAt", "DESC"]],
      limit: 20
    });

    return batches.map(serializeImportBatch);
  }

  async getNotionImportDetail(batchId: string): Promise<AdminNotionImportDetail | null> {
    const batch = await models.NotionImportBatch.findByPk(batchId);

    if (!batch) {
      return null;
    }

    const entries = await models.NotionImportEntry.findAll({
      where: { batchId },
      order: [
        ["status", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    return {
      batch: serializeImportBatch(batch),
      entries: entries.map(serializeImportEntry)
    };
  }

  async applyNotionImportEntry(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<
    | { status: "applied"; entry: AdminNotionImportEntry; characterId: string; created: boolean }
    | { status: "not_found" }
    | { status: "invalid"; code: string; message: string; details?: JsonObject }
  > {
    return sequelize.transaction(async (transaction) => {
      const entry = await models.NotionImportEntry.findOne({
        where: {
          batchId: input.batchId,
          sourcePageId: input.pageId
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!entry) {
        return { status: "not_found" };
      }

      if (entry.status === "failed" || entry.status === "missing") {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_NOT_APPLICABLE",
          message: "Cette entrée d'import ne peut pas être appliquée telle quelle."
        };
      }

      const candidate = importCandidateFromEntry(entry);

      if (!candidate) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT",
          message: "Le snapshot mappé est incomplet ou invalide."
        };
      }

      let character: Character | null = null;
      let created = false;

      if (entry.appliedCharacterId) {
        character = await models.Character.findByPk(entry.appliedCharacterId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
      }

      if (!character) {
        const matches = await models.Character.findAll({
          where: {
            firstName: { [Op.iLike]: candidate.firstName },
            lastName: { [Op.iLike]: candidate.lastName }
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (matches.length > 1) {
          return {
            status: "invalid",
            code: "NOTION_IMPORT_ENTRY_AMBIGUOUS_CHARACTER",
            message:
              "Plusieurs fiches existantes portent déjà ce nom. Le rattachement automatique est bloqué.",
            details: {
              fullName: `${candidate.firstName} ${candidate.lastName}`,
              characterIds: matches.map((match) => match.id)
            }
          };
        }

        character = matches[0] ?? null;
      }

      const currentTags = character ? await loadCharacterTags(character.id, transaction) : [];
      const currentTagNames = currentTags
        .map((tag) => tag.name)
        .sort((left, right) => left.localeCompare(right, "fr"));
      const currentRelationshipSummary = character
        ? await relationshipsForCharacter(character.id, transaction)
        : [];

      if (!character) {
        created = true;
        character = await models.Character.create(
          {
            publicSlug: await generateUniqueCharacterSlug(
              candidate.firstName,
              candidate.lastName,
              transaction
            ),
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            nickname: candidate.nickname,
            birthDate: null,
            lifeStatus: candidate.lifeStatus,
            deathOrDepartureDate: candidate.deathOrDepartureDate,
            photoUrl: null,
            businessName: candidate.businessName,
            businessRank: null,
            businessBadgeNumber: null,
            phoneNumber: candidate.phoneNumber,
            streamerId: null,
            socialLinks: candidate.socialLinks,
            groupName: candidate.groupName,
            groupRole: candidate.groupRole,
            district: candidate.district,
            isRpDeath: candidate.isRpDeath,
            policeRank: candidate.policeRank,
            policeBadgeNumber: candidate.policeBadgeNumber,
            previousCharacters: candidate.previousCharacters,
            verificationStatus: candidate.verificationStatus,
            sourceNote: candidate.sourceNote,
            dataSource: "notion"
          },
          { transaction }
        );
      }

      const resolvedRelationships = await resolveRelationshipTargets(
        character.id,
        candidate.relationships,
        transaction
      );

      if (resolvedRelationships.ambiguous.length > 0) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_UNRESOLVED_RELATIONSHIPS",
          message:
            "Certaines relations n'ont pas pu être rattachées de façon fiable. La fiche n'a pas été appliquée.",
          details: {
            ambiguous: resolvedRelationships.ambiguous
          }
        };
      }

      const tagEntities = await resolveOrCreateTags(candidate.tags, transaction);
      const streamerId = await resolveOrCreateStreamerId(
        candidate.streamerPublicName,
        candidate.verificationStatus,
        transaction
      );
      const nextTagNames = tagEntities
        .map((tag) => tag.name)
        .sort((left, right) => left.localeCompare(right, "fr"));
      const nextRelationshipSummary = resolvedRelationships.resolved
        .map((relationship) => ({
          type: relationship.type,
          target: relationship.targetName
        }))
        .sort((left, right) =>
          `${left.type}:${left.target}`.localeCompare(`${right.type}:${right.target}`, "fr")
        );
      const changes: JsonObject = {};

      setChange(changes, "firstName", created ? null : character.firstName, candidate.firstName);
      setChange(changes, "lastName", created ? null : character.lastName, candidate.lastName);
      setChange(changes, "nickname", created ? null : character.nickname, candidate.nickname);
      setChange(changes, "lifeStatus", created ? null : character.lifeStatus, candidate.lifeStatus);
      setChange(
        changes,
        "deathOrDepartureDate",
        created ? null : character.deathOrDepartureDate,
        candidate.deathOrDepartureDate
      );
      setChange(
        changes,
        "phoneNumber",
        created ? null : character.phoneNumber,
        candidate.phoneNumber
      );
      setChange(
        changes,
        "businessName",
        created ? null : character.businessName,
        candidate.businessName
      );
      setChange(changes, "groupName", created ? null : character.groupName, candidate.groupName);
      setChange(changes, "groupRole", created ? null : character.groupRole, candidate.groupRole);
      setChange(changes, "district", created ? null : character.district, candidate.district);
      setChange(changes, "isRpDeath", created ? null : character.isRpDeath, candidate.isRpDeath);
      setChange(changes, "policeRank", created ? null : character.policeRank, candidate.policeRank);
      setChange(
        changes,
        "policeBadgeNumber",
        created ? null : character.policeBadgeNumber,
        candidate.policeBadgeNumber
      );
      setChange(
        changes,
        "previousCharacters",
        created ? null : character.previousCharacters,
        candidate.previousCharacters
      );
      setChange(
        changes,
        "verificationStatus",
        created ? null : character.verificationStatus,
        candidate.verificationStatus
      );
      setChange(changes, "sourceNote", created ? null : character.sourceNote, candidate.sourceNote);
      setChange(
        changes,
        "socialLinks",
        created ? null : character.socialLinks,
        candidate.socialLinks
      );
      setChange(changes, "tags", currentTagNames, nextTagNames);
      setChange(changes, "relationships", currentRelationshipSummary, nextRelationshipSummary);

      await character.update(
        {
          publicSlug:
            created ||
            character.firstName !== candidate.firstName ||
            character.lastName !== candidate.lastName
              ? await generateUniqueCharacterSlug(
                  candidate.firstName,
                  candidate.lastName,
                  transaction,
                  character.id
                )
              : character.publicSlug,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          nickname: candidate.nickname,
          lifeStatus: candidate.lifeStatus,
          deathOrDepartureDate: candidate.deathOrDepartureDate,
          businessName: candidate.businessName,
          phoneNumber: candidate.phoneNumber,
          streamerId,
          socialLinks: candidate.socialLinks,
          groupName: candidate.groupName,
          groupRole: candidate.groupRole,
          district: candidate.district,
          isRpDeath: candidate.isRpDeath,
          policeRank: candidate.policeRank,
          policeBadgeNumber: candidate.policeBadgeNumber,
          previousCharacters: candidate.previousCharacters,
          verificationStatus: candidate.verificationStatus,
          sourceNote: candidate.sourceNote,
          dataSource: "notion"
        },
        { transaction }
      );

      await syncCharacterTags(character.id, tagEntities, transaction);
      await syncImportedRelationships(
        character.id,
        resolvedRelationships.resolved,
        candidate.verificationStatus,
        transaction
      );
      await models.ChangeHistory.create(
        {
          characterId: character.id,
          changeRequestId: null,
          moderatorId: input.actorUserId,
          changes
        },
        { transaction }
      );
      await entry.update(
        {
          appliedCharacterId: character.id,
          appliedByUserId: input.actorUserId,
          appliedAt: new Date()
        },
        { transaction }
      );
      await refreshAppliedBatchRelationships(input.batchId, transaction);
      await this.logAction(
        input.actorUserId,
        {
          action: "notion-import.apply-entry",
          targetType: "notion_import_entry",
          targetId: entry.id,
          changes: {
            batchId: input.batchId,
            pageId: input.pageId,
            characterId: character.id,
            created,
            unresolvedRelationships: resolvedRelationships.unresolved
          }
        },
        transaction
      );

      const reloadedEntry = await models.NotionImportEntry.findByPk(entry.id, { transaction });

      if (!reloadedEntry) {
        throw new Error(`Notion import entry ${entry.id} could not be reloaded after apply.`);
      }

      return {
        status: "applied",
        entry: serializeImportEntry(reloadedEntry),
        characterId: character.id,
        created
      };
    });
  }

  async importNotionImportEntryPhoto(input: {
    actorUserId: string;
    batchId: string;
    pageId: string;
  }): Promise<
    | { status: "imported"; entry: AdminNotionImportEntry; characterId: string; photoUrl: string }
    | { status: "not_found" }
    | { status: "invalid"; code: string; message: string; details?: JsonObject }
  > {
    const entry = await models.NotionImportEntry.findOne({
      where: {
        batchId: input.batchId,
        sourcePageId: input.pageId
      }
    });

    if (!entry) {
      return { status: "not_found" };
    }

    const candidate = importCandidateFromEntry(entry);

    if (!candidate) {
      return {
        status: "invalid",
        code: "NOTION_IMPORT_ENTRY_INVALID_SNAPSHOT",
        message: "Le snapshot mappé est incomplet ou invalide."
      };
    }

    if (!entry.appliedCharacterId) {
      return {
        status: "invalid",
        code: "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY",
        message: "Applique d'abord la fiche avant d'importer sa photo."
      };
    }

    const remotePhotoUrl = candidate.photoReferences[0];

    if (!remotePhotoUrl) {
      return {
        status: "invalid",
        code: "NOTION_IMPORT_ENTRY_NO_PHOTO",
        message: "Aucune photo exploitable n'a été trouvée dans cette fiche importée."
      };
    }

    let importedPhotoUrl: string;

    try {
      importedPhotoUrl = await importCharacterPhotoFromRemoteUrl({ url: remotePhotoUrl });
    } catch (error) {
      if (error instanceof InvalidCharacterPhotoError) {
        return {
          status: "invalid",
          code: "NOTION_IMPORT_ENTRY_INVALID_PHOTO",
          message: error.message
        };
      }

      throw error;
    }

    let previousPhotoUrlToDelete: string | null = null;

    try {
      const result = await sequelize.transaction(async (transaction) => {
        const lockedEntry = await models.NotionImportEntry.findByPk(entry.id, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!lockedEntry?.appliedCharacterId) {
          return {
            status: "invalid",
            code: "NOTION_IMPORT_ENTRY_PHOTO_REQUIRES_APPLY",
            message: "Applique d'abord la fiche avant d'importer sa photo."
          } as const;
        }

        const character = await models.Character.findByPk(lockedEntry.appliedCharacterId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!character) {
          return {
            status: "invalid",
            code: "NOTION_IMPORT_ENTRY_CHARACTER_NOT_FOUND",
            message: "Le personnage lié à cette fiche importée est introuvable."
          } as const;
        }

        const previousPhotoUrl = character.photoUrl;

        await character.update(
          {
            photoUrl: importedPhotoUrl
          },
          { transaction }
        );

        await models.ChangeHistory.create(
          {
            characterId: character.id,
            changeRequestId: null,
            moderatorId: input.actorUserId,
            changes: {
              photoUrl: {
                old: previousPhotoUrl,
                new: importedPhotoUrl
              }
            }
          },
          { transaction }
        );

        await this.logAction(
          input.actorUserId,
          {
            action: "notion-import.import-photo",
            targetType: "notion_import_entry",
            targetId: lockedEntry.id,
            changes: {
              batchId: input.batchId,
              pageId: input.pageId,
              characterId: character.id,
              remotePhotoUrl,
              photoUrl: importedPhotoUrl
            }
          },
          transaction
        );

        if (previousPhotoUrl && previousPhotoUrl !== importedPhotoUrl) {
          previousPhotoUrlToDelete = previousPhotoUrl;
        }

        return {
          status: "imported" as const,
          entry: serializeImportEntry(lockedEntry),
          characterId: character.id,
          photoUrl: importedPhotoUrl
        };
      });

      if (previousPhotoUrlToDelete) {
        await deleteStoredCharacterPhoto(previousPhotoUrlToDelete);
      }

      return result;
    } catch (error) {
      await deleteStoredCharacterPhoto(importedPhotoUrl);
      throw error;
    }
  }

  async createTag(actorUserId: string, input: TagInput): Promise<AdminTag> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.create(input, { transaction });
      await this.logAction(
        actorUserId,
        {
          action: "tag.create",
          targetType: "tag",
          targetId: tag.id,
          changes: { new: input }
        },
        transaction
      );

      return serializeTag(tag, 0);
    });
  }

  async updateTag(actorUserId: string, tagId: string, input: TagInput): Promise<AdminTag | null> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.findByPk(tagId, { transaction });

      if (!tag) {
        return null;
      }

      const old = serializeTag(tag);
      await tag.update(input, { transaction });
      await this.logAction(
        actorUserId,
        {
          action: "tag.update",
          targetType: "tag",
          targetId: tag.id,
          changes: { old, new: serializeTag(tag) }
        },
        transaction
      );

      return serializeTag(tag, await this.countTagUsage(tag.id, transaction));
    });
  }

  async deleteTag(actorUserId: string, tagId: string): Promise<"deleted" | "in_use" | "not_found"> {
    return sequelize.transaction(async (transaction) => {
      const tag = await models.Tag.findByPk(tagId, { transaction });

      if (!tag) {
        return "not_found";
      }

      const usageCount = await this.countTagUsage(tag.id, transaction);

      if (usageCount > 0) {
        return "in_use";
      }

      const old = serializeTag(tag, usageCount);
      await tag.destroy({ transaction });
      await this.logAction(
        actorUserId,
        {
          action: "tag.delete",
          targetType: "tag",
          targetId: tag.id,
          changes: { old }
        },
        transaction
      );

      return "deleted";
    });
  }

  async updateUserRole(
    actorUserId: string,
    userId: string,
    roleName: RoleName
  ): Promise<AdminUser | "last_admin" | null> {
    return sequelize.transaction(async (transaction) => {
      const [user, nextRole] = await Promise.all([
        models.User.findByPk(userId, {
          include: userInclude,
          transaction
        }),
        models.Role.findOne({ where: { name: roleName }, transaction })
      ]);

      if (!user || !nextRole) {
        return null;
      }

      if (user.role?.name === "administrator" && roleName !== "administrator") {
        const adminCount = await models.User.count({
          include: [{ model: models.Role, as: "role", where: { name: "administrator" } }],
          transaction
        });

        if (adminCount <= 1) {
          return "last_admin";
        }
      }

      const oldRole = user.role?.name ?? null;
      await user.update({ roleId: nextRole.id }, { transaction });
      await this.logAction(
        actorUserId,
        {
          action: "user.role.update",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: { role: { old: oldRole, new: roleName } }
        },
        transaction
      );

      return this.reloadUser(user.id, transaction);
    });
  }

  async banUser(actorUserId: string, userId: string, input: BanInput): Promise<AdminUser | null> {
    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, { transaction });

      if (!user) {
        return null;
      }

      await models.Ban.create(
        {
          userId,
          bannedByUserId: actorUserId,
          reason: input.reason,
          expiresAt: null,
          revokedAt: null
        },
        { transaction }
      );
      await this.logAction(
        actorUserId,
        {
          action: "user.ban",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: { reason: input.reason }
        },
        transaction
      );

      return this.reloadUser(user.id, transaction);
    });
  }

  async revokeUserBan(actorUserId: string, userId: string): Promise<AdminUser | null> {
    return sequelize.transaction(async (transaction) => {
      const user = await models.User.findByPk(userId, { transaction });

      if (!user) {
        return null;
      }

      const [count] = await models.Ban.update(
        { revokedAt: new Date() },
        { where: { userId, ...activeBanWhere }, transaction }
      );

      if (count === 0) {
        return this.reloadUser(user.id, transaction);
      }

      await this.logAction(
        actorUserId,
        {
          action: "user.ban.revoke",
          targetType: "user",
          targetId: user.id,
          targetUserId: user.id,
          changes: { revoked: true }
        },
        transaction
      );

      return this.reloadUser(user.id, transaction);
    });
  }

  private async listTagsWithUsage(): Promise<AdminTag[]> {
    const tags = await models.Tag.findAll({ order: [["name", "ASC"]] });
    const usageRows = await models.CharacterTag.findAll({
      attributes: ["tagId", [sequelize.fn("COUNT", sequelize.col("tag_id")), "usageCount"]],
      group: ["tagId"],
      raw: true
    });
    const usageByTag = new Map(
      usageRows.map((row) => [
        row.tagId,
        Number((row as unknown as { usageCount: string | number }).usageCount)
      ])
    );

    return tags.map((tag) => serializeTag(tag, usageByTag.get(tag.id) ?? 0));
  }

  private async countTagUsage(tagId: string, transaction: Transaction) {
    return models.CharacterTag.count({ where: { tagId }, transaction });
  }

  private async reloadUser(userId: string, transaction: Transaction) {
    const user = await models.User.findByPk(userId, {
      include: userInclude,
      transaction
    });

    return user ? serializeUser(user) : null;
  }

  private async logAction(
    actorUserId: string,
    input: {
      action: string;
      targetType: string;
      targetId: string | null;
      targetUserId?: string | null;
      changes: JsonObject;
    },
    transaction: Transaction
  ) {
    await models.AdminAction.create(
      {
        actorUserId,
        targetUserId: input.targetUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        changes: input.changes
      },
      { transaction }
    );
  }
}

export const adminRoleNames = roleNames;
export const adminTagTypes = tagTypes;
