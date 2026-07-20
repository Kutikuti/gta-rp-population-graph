import { DataTypes, type Sequelize } from "sequelize";

import { changeRequestStatuses, changeRequestTypes } from "../enums.js";
import { ChangeHistory, ChangeRequest } from "./changes.js";

const uuidPrimaryKey = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true
};

export const initChangeRequestModels = (sequelize: Sequelize) => {
  ChangeRequest.init(
    {
      id: uuidPrimaryKey,
      userId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      requestType: {
        type: DataTypes.ENUM(...changeRequestTypes),
        allowNull: false,
        defaultValue: "update"
      },
      characterId: {
        type: DataTypes.UUID,
        allowNull: true
      },
      proposedSnapshot: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      searchContext: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM(...changeRequestStatuses),
        allowNull: false,
        defaultValue: "pending"
      },
      reviewerId: DataTypes.UUID,
      moderatorComment: DataTypes.TEXT,
      resolvedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "change_requests",
      indexes: [
        { fields: ["status"] },
        { fields: ["user_id"] },
        { fields: ["character_id"] },
        { fields: ["request_type"] }
      ]
    }
  );

  ChangeHistory.init(
    {
      id: uuidPrimaryKey,
      characterId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      changeRequestId: DataTypes.UUID,
      moderatorId: DataTypes.UUID,
      changes: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "change_histories",
      indexes: [{ fields: ["character_id"] }, { fields: ["moderator_id"] }]
    }
  );
};
