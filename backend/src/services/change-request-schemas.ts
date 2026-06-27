import { z } from "zod";

import { editableRelationshipTypes, lifeStatuses, verificationStatuses } from "../db/enums.js";
import type { SocialLinks } from "../db/models/index.js";

const emptyToNull = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform(emptyToNull);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .transform(emptyToNull);

const socialLinksSchema = z
  .object({
    twitch: nullableText(300),
    kick: nullableText(300),
    youtube: nullableText(300),
    instagram: nullableText(300),
    tiktok: nullableText(300)
  })
  .strict()
  .nullable()
  .optional()
  .transform((value): SocialLinks | null => {
    if (!value) {
      return null;
    }

    const links: SocialLinks = {};

    for (const key of ["twitch", "kick", "youtube", "instagram", "tiktok"] as const) {
      const link = value[key];

      if (link) {
        links[key] = link;
      }
    }

    return Object.keys(links).length ? links : null;
  });

const previousCharactersSchema = z
  .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(160))
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const relationshipDraftSchema = z
  .object({
    characterId: z.uuid(),
    type: z.enum(editableRelationshipTypes)
  })
  .strict();

export const characterSnapshotSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    nickname: nullableText(160),
    birthDate: dateOnly,
    lifeStatus: z.enum(lifeStatuses),
    deathOrDepartureDate: dateOnly,
    photoUrl: nullableText(600),
    businessName: nullableText(160),
    businessRank: nullableText(120),
    businessBadgeNumber: nullableText(80),
    phoneNumber: nullableText(40),
    streamerId: z
      .uuid()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    streamerName: nullableText(160),
    socialLinks: socialLinksSchema,
    groupName: nullableText(160),
    groupRole: nullableText(120),
    district: nullableText(120),
    isRpDeath: z.boolean().default(false),
    relationships: z.array(relationshipDraftSchema).default([]),
    policeRank: nullableText(120),
    policeBadgeNumber: nullableText(80),
    previousCharacters: previousCharactersSchema,
    verificationStatus: z.enum(verificationStatuses),
    sourceNote: nullableText(1000)
  })
  .strict();

export const changeRequestCreateSchema = z.object({
  characterId: z.uuid(),
  proposedSnapshot: characterSnapshotSchema
});

export const characterCreationContextSchema = z
  .object({
    q: nullableText(200),
    lifeStatus: nullableText(40),
    tag: nullableText(120),
    streamer: nullableText(160),
    verificationStatus: nullableText(40),
    matchTotal: z.number().int().min(0).max(100000).optional()
  })
  .strict();

export const characterCreationRequestSchema = z.object({
  proposedSnapshot: characterSnapshotSchema,
  searchContext: characterCreationContextSchema
});

export const moderationListSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional()
});

export const rejectChangeRequestSchema = z.object({
  comment: z.string().trim().min(1).max(1000)
});

export const directCharacterEditSchema = z.object({
  snapshot: characterSnapshotSchema
});

export type CharacterSnapshot = z.infer<typeof characterSnapshotSchema>;
export type CharacterCreationContext = z.infer<typeof characterCreationContextSchema>;
