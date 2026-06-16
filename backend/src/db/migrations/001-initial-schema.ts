import type { MigrationParams } from "umzug";
import type { Transaction } from "sequelize";

import type { MigrationContext } from "../migrate.js";
import {
  changeRequestStatuses,
  dataSources,
  lifeStatuses,
  relationshipDirections,
  relationshipTypes,
  roleNames,
  tagTypes,
  verificationStatuses
} from "../enums.js";

const timestampColumns = (
  DataTypes: MigrationContext["DataTypes"],
  literal: MigrationContext["literal"]
) => ({
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP")
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP")
  }
});

const uuidPrimaryKey = (
  DataTypes: MigrationContext["DataTypes"],
  literal: MigrationContext["literal"]
) => ({
  type: DataTypes.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: literal("gen_random_uuid()")
});

const enumColumn = (DataTypes: MigrationContext["DataTypes"]) => DataTypes.STRING(40);

const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

const enumValuesSql = (values: readonly string[]) =>
  values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");

const addEnumCheck = async (
  queryInterface: MigrationContext["queryInterface"],
  tableName: string,
  columnName: string,
  values: readonly string[],
  transaction: Transaction,
  allowNull = false
) => {
  const column = quoteIdentifier(columnName);
  const allowedValues = `${column} IN (${enumValuesSql(values)})`;
  const predicate = allowNull ? `${column} IS NULL OR ${allowedValues}` : allowedValues;

  await queryInterface.sequelize.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(
      `${tableName}_${columnName}_check`
    )} CHECK (${predicate});`,
    { transaction }
  );
};

export const up = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface, DataTypes, literal } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', {
      transaction
    });

    await queryInterface.createTable(
      "roles",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        name: {
          type: enumColumn(DataTypes),
          allowNull: false,
          unique: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "users",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        google_id: {
          type: DataTypes.STRING(128),
          allowNull: false,
          unique: true
        },
        email: {
          type: DataTypes.STRING(320),
          allowNull: false,
          unique: true
        },
        display_name: {
          type: DataTypes.STRING(160),
          allowNull: false
        },
        avatar_url: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        role_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "roles", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        last_login_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "bans",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        banned_by_user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        revoked_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "streamers",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        public_name: {
          type: DataTypes.STRING(160),
          allowNull: false,
          unique: true
        },
        primary_platform: {
          type: DataTypes.STRING(40),
          allowNull: true
        },
        social_links: {
          type: DataTypes.JSONB,
          allowNull: true
        },
        verification_status: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "to_check"
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "characters",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        first_name: {
          type: DataTypes.STRING(120),
          allowNull: false
        },
        last_name: {
          type: DataTypes.STRING(120),
          allowNull: false
        },
        nickname: {
          type: DataTypes.STRING(160),
          allowNull: true
        },
        birth_date: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        life_status: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "unknown"
        },
        death_or_departure_date: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        photo_url: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        business_name: {
          type: DataTypes.STRING(160),
          allowNull: true
        },
        business_rank: {
          type: DataTypes.STRING(120),
          allowNull: true
        },
        business_badge_number: {
          type: DataTypes.STRING(80),
          allowNull: true
        },
        phone_number: {
          type: DataTypes.STRING(40),
          allowNull: true
        },
        streamer_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "streamers", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        social_links: {
          type: DataTypes.JSONB,
          allowNull: true
        },
        group_name: {
          type: DataTypes.STRING(160),
          allowNull: true
        },
        group_role: {
          type: DataTypes.STRING(120),
          allowNull: true
        },
        district: {
          type: DataTypes.STRING(120),
          allowNull: true
        },
        is_rp_death: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        police_rank: {
          type: DataTypes.STRING(120),
          allowNull: true
        },
        police_badge_number: {
          type: DataTypes.STRING(80),
          allowNull: true
        },
        previous_characters: {
          type: DataTypes.JSONB,
          allowNull: true
        },
        verification_status: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "to_check"
        },
        data_source: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "other"
        },
        source_note: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "tags",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
          unique: true
        },
        type: {
          type: enumColumn(DataTypes),
          allowNull: true
        },
        color_hex: {
          type: DataTypes.STRING(7),
          allowNull: false,
          defaultValue: "#2f9bff"
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "character_tags",
      {
        character_id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          references: { model: "characters", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        tag_id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          references: { model: "tags", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "character_relationships",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        source_character_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "characters", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        target_character_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "characters", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        type: {
          type: enumColumn(DataTypes),
          allowNull: false
        },
        direction: {
          type: enumColumn(DataTypes),
          allowNull: false
        },
        label: {
          type: DataTypes.STRING(160),
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        source: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "other"
        },
        verification_status: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "to_check"
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "change_requests",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        character_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "characters", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        proposed_snapshot: {
          type: DataTypes.JSONB,
          allowNull: false
        },
        status: {
          type: enumColumn(DataTypes),
          allowNull: false,
          defaultValue: "pending"
        },
        reviewer_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        moderator_comment: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        resolved_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await queryInterface.createTable(
      "change_histories",
      {
        id: uuidPrimaryKey(DataTypes, literal),
        character_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: "characters", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        change_request_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "change_requests", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        moderator_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        changes: {
          type: DataTypes.JSONB,
          allowNull: false
        },
        ...timestampColumns(DataTypes, literal)
      },
      { transaction }
    );

    await addEnumCheck(queryInterface, "roles", "name", roleNames, transaction);
    await addEnumCheck(
      queryInterface,
      "streamers",
      "verification_status",
      verificationStatuses,
      transaction
    );
    await addEnumCheck(queryInterface, "characters", "life_status", lifeStatuses, transaction);
    await addEnumCheck(
      queryInterface,
      "characters",
      "verification_status",
      verificationStatuses,
      transaction
    );
    await addEnumCheck(queryInterface, "characters", "data_source", dataSources, transaction);
    await addEnumCheck(queryInterface, "tags", "type", tagTypes, transaction, true);
    await addEnumCheck(
      queryInterface,
      "character_relationships",
      "type",
      relationshipTypes,
      transaction
    );
    await addEnumCheck(
      queryInterface,
      "character_relationships",
      "direction",
      relationshipDirections,
      transaction
    );
    await addEnumCheck(
      queryInterface,
      "character_relationships",
      "source",
      dataSources,
      transaction
    );
    await addEnumCheck(
      queryInterface,
      "character_relationships",
      "verification_status",
      verificationStatuses,
      transaction
    );
    await addEnumCheck(queryInterface, "change_requests", "status", changeRequestStatuses, transaction);

    await queryInterface.addIndex("characters", ["first_name", "last_name"], {
      name: "characters_name_idx",
      transaction
    });
    await queryInterface.addIndex("characters", ["phone_number"], {
      name: "characters_phone_number_idx",
      transaction
    });
    await queryInterface.addIndex("characters", ["life_status"], {
      name: "characters_life_status_idx",
      transaction
    });
    await queryInterface.addIndex("characters", ["verification_status"], {
      name: "characters_verification_status_idx",
      transaction
    });
    await queryInterface.addIndex("character_relationships", ["source_character_id"], {
      name: "relationships_source_idx",
      transaction
    });
    await queryInterface.addIndex("character_relationships", ["target_character_id"], {
      name: "relationships_target_idx",
      transaction
    });
    await queryInterface.addIndex("character_relationships", ["type"], {
      name: "relationships_type_idx",
      transaction
    });
    await queryInterface.addIndex("change_requests", ["status"], {
      name: "change_requests_status_idx",
      transaction
    });

    await queryInterface.addConstraint("character_relationships", {
      fields: ["source_character_id", "target_character_id"],
      type: "check",
      name: "relationships_no_self_reference",
      where: literal("source_character_id <> target_character_id"),
      transaction
    });
  });
};

export const down = async ({ context }: MigrationParams<MigrationContext>) => {
  const { queryInterface } = context;

  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("change_histories", { transaction });
    await queryInterface.dropTable("change_requests", { transaction });
    await queryInterface.dropTable("character_relationships", { transaction });
    await queryInterface.dropTable("character_tags", { transaction });
    await queryInterface.dropTable("tags", { transaction });
    await queryInterface.dropTable("characters", { transaction });
    await queryInterface.dropTable("streamers", { transaction });
    await queryInterface.dropTable("bans", { transaction });
    await queryInterface.dropTable("users", { transaction });
    await queryInterface.dropTable("roles", { transaction });

    await queryInterface.sequelize.query(
      `
      DROP TYPE IF EXISTS enum_roles_name;
      DROP TYPE IF EXISTS enum_streamers_verification_status;
      DROP TYPE IF EXISTS enum_characters_life_status;
      DROP TYPE IF EXISTS enum_characters_verification_status;
      DROP TYPE IF EXISTS enum_characters_data_source;
      DROP TYPE IF EXISTS enum_tags_type;
      DROP TYPE IF EXISTS enum_character_relationships_type;
      DROP TYPE IF EXISTS enum_character_relationships_direction;
      DROP TYPE IF EXISTS enum_character_relationships_source;
      DROP TYPE IF EXISTS enum_character_relationships_verification_status;
      DROP TYPE IF EXISTS enum_change_requests_status;
      `,
      { transaction }
    );
  });
};
