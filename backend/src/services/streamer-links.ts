import { Op, type Transaction } from "sequelize";

import type { VerificationStatus } from "../db/enums.js";
import { models } from "../db/index.js";
import type { SocialLinks, Streamer } from "../db/models/index.js";

export const streamerPlatformOrder = [
  "twitch",
  "youtube",
  "discord",
  "instagram",
  "tiktok",
  "kick"
] as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const normalizeSocialLinks = (links: SocialLinks | null | undefined): SocialLinks | null => {
  if (!links) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(links)
      .filter((entry): entry is [string, string] => isNonEmptyString(entry[1]))
      .map(([platform, value]) => [platform, value.trim()])
  ) as SocialLinks;

  return Object.keys(normalized).length > 0 ? normalized : null;
};

export const primaryPlatformFromSocialLinks = (links: SocialLinks | null | undefined) => {
  const normalized = normalizeSocialLinks(links);

  if (!normalized) {
    return null;
  }

  return streamerPlatformOrder.find((platform) => isNonEmptyString(normalized[platform])) ?? null;
};

export const mergeSocialLinks = (
  currentLinks: SocialLinks | null | undefined,
  nextLinks: SocialLinks | null | undefined
) => {
  return normalizeSocialLinks({
    ...(currentLinks ?? {}),
    ...(nextLinks ?? {})
  });
};

export const syncStreamerMetadata = async (input: {
  streamer: Streamer;
  socialLinks: SocialLinks | null | undefined;
  transaction: Transaction;
}) => {
  const mergedSocialLinks = mergeSocialLinks(input.streamer.socialLinks, input.socialLinks);
  const primaryPlatform =
    primaryPlatformFromSocialLinks(mergedSocialLinks) ?? input.streamer.primaryPlatform;

  if (
    JSON.stringify(input.streamer.socialLinks ?? null) === JSON.stringify(mergedSocialLinks) &&
    input.streamer.primaryPlatform === primaryPlatform
  ) {
    return input.streamer;
  }

  await input.streamer.update(
    {
      socialLinks: mergedSocialLinks,
      primaryPlatform
    },
    { transaction: input.transaction }
  );

  return input.streamer;
};

export const resolveOrCreateStreamer = async (input: {
  streamerId?: string | null;
  streamerPublicName?: string | null;
  socialLinks?: SocialLinks | null;
  verificationStatus: VerificationStatus;
  transaction: Transaction;
}) => {
  if (input.streamerId) {
    const streamer = await models.Streamer.findByPk(input.streamerId, {
      transaction: input.transaction
    });

    if (!streamer) {
      throw new Error(`Streamer ${input.streamerId} is missing.`);
    }

    await syncStreamerMetadata({
      streamer,
      socialLinks: input.socialLinks,
      transaction: input.transaction
    });

    return streamer.id;
  }

  if (!input.streamerPublicName) {
    return null;
  }

  const existing = await models.Streamer.findOne({
    where: {
      publicName: {
        [Op.iLike]: input.streamerPublicName
      }
    },
    transaction: input.transaction
  });

  if (existing) {
    await syncStreamerMetadata({
      streamer: existing,
      socialLinks: input.socialLinks,
      transaction: input.transaction
    });

    return existing.id;
  }

  const normalizedSocialLinks = normalizeSocialLinks(input.socialLinks);
  const created = await models.Streamer.create(
    {
      publicName: input.streamerPublicName,
      primaryPlatform: primaryPlatformFromSocialLinks(normalizedSocialLinks),
      socialLinks: normalizedSocialLinks,
      verificationStatus: input.verificationStatus
    },
    { transaction: input.transaction }
  );

  return created.id;
};
