import { Op, type Transaction } from "sequelize";

import { models } from "../db/index.js";

const slugBase = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export const characterSlugFromName = (firstName: string, lastName: string) => {
  const value = slugBase(`${firstName} ${lastName}`);

  return value || "personnage";
};

export const generateUniqueCharacterSlug = async (
  firstName: string,
  lastName: string,
  transaction?: Transaction,
  excludedCharacterId?: string
) => {
  const baseSlug = characterSlugFromName(firstName, lastName);
  const existing = await models.Character.findAll({
    attributes: ["publicSlug"],
    where: {
      ...(excludedCharacterId
        ? {
            id: {
              [Op.ne]: excludedCharacterId
            }
          }
        : {}),
      publicSlug: {
        [Op.iLike]: `${baseSlug}%`
      }
    },
    transaction
  });

  const usedSlugs = new Set(existing.map((character) => character.publicSlug));

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let index = 2;

  while (usedSlugs.has(`${baseSlug}-${String(index)}`)) {
    index += 1;
  }

  return `${baseSlug}-${String(index)}`;
};
