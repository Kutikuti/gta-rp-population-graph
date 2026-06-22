import { QueryTypes } from "sequelize";
import type { MigrationParams } from "umzug";

import { characterSlugFromName } from "../../services/character-slug.js";
import type { MigrationContext } from "../migrate.js";

type CharacterRow = {
  id: string;
  first_name: string;
  last_name: string;
};

const nextUniqueSlug = (baseSlug: string, usedSlugs: Set<string>) => {
  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.add(baseSlug);
    return baseSlug;
  }

  let index = 2;

  while (usedSlugs.has(`${baseSlug}-${String(index)}`)) {
    index += 1;
  }

  const slug = `${baseSlug}-${String(index)}`;
  usedSlugs.add(slug);
  return slug;
};

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      "characters",
      "public_slug",
      {
        type: DataTypes.STRING(180),
        allowNull: true
      },
      { transaction }
    );

    const rows = await queryInterface.sequelize.query<CharacterRow>(
      'SELECT id, first_name, last_name FROM "characters" ORDER BY last_name ASC, first_name ASC, id ASC',
      {
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const usedSlugs = new Set<string>();

    for (const row of rows) {
      const slug = nextUniqueSlug(characterSlugFromName(row.first_name, row.last_name), usedSlugs);

      await queryInterface.sequelize.query(
        'UPDATE "characters" SET "public_slug" = :slug WHERE id = :id',
        {
          replacements: {
            id: row.id,
            slug
          },
          transaction
        }
      );
    }

    await queryInterface.changeColumn(
      "characters",
      "public_slug",
      {
        type: DataTypes.STRING(180),
        allowNull: false
      },
      { transaction }
    );

    await queryInterface.addIndex("characters", ["public_slug"], {
      unique: true,
      name: "characters_public_slug_idx",
      transaction
    });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeIndex("characters", "characters_public_slug_idx", { transaction });
    await queryInterface.removeColumn("characters", "public_slug", { transaction });
  });
};
