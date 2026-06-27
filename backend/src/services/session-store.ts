import type { SessionData, Store } from "express-session";
import session from "express-session";
import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  Op,
  type Sequelize
} from "sequelize";

import { createSequelize } from "../db/sequelize.js";

type CreateSequelizeSessionStoreOptions = {
  ttlHours: number;
  cleanupIntervalMinutes: number;
};

class SessionRecord extends Model<
  InferAttributes<SessionRecord>,
  InferCreationAttributes<SessionRecord>
> {
  declare sid: string;
  declare data: SessionData;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const initSessionModel = (sequelize: Sequelize) => {
  SessionRecord.init(
    {
      sid: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: "user_sessions",
      indexes: [{ fields: ["expires_at"] }]
    }
  );

  return SessionRecord;
};

export const resolveSessionExpiry = (sessionData: SessionData, now: Date, ttlHours: number) => {
  const cookieExpiry = sessionData.cookie.expires;

  if (cookieExpiry instanceof Date) {
    return cookieExpiry;
  }

  if (typeof cookieExpiry === "string") {
    const parsedDate = new Date(cookieExpiry);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  const maxAge = typeof sessionData.cookie.maxAge === "number" ? sessionData.cookie.maxAge : null;

  if (maxAge !== null && Number.isFinite(maxAge) && maxAge > 0) {
    return new Date(now.getTime() + maxAge);
  }

  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
};

class SequelizeSessionStore extends session.Store {
  readonly #ttlHours: number;
  readonly #cleanupIntervalMs: number;
  readonly #sessionModel: typeof SessionRecord;
  readonly #cleanupTimer: NodeJS.Timeout | null;

  constructor(
    sessionModel: typeof SessionRecord,
    { ttlHours, cleanupIntervalMinutes }: CreateSequelizeSessionStoreOptions
  ) {
    super();
    this.#sessionModel = sessionModel;
    this.#ttlHours = ttlHours;
    this.#cleanupIntervalMs = cleanupIntervalMinutes * 60 * 1000;
    this.#cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions();
    }, this.#cleanupIntervalMs);
    this.#cleanupTimer.unref();
  }

  override async get(
    sid: string,
    callback: (error?: unknown, session?: SessionData | null) => void
  ) {
    try {
      const record = await this.#sessionModel.findByPk(sid);

      if (!record) {
        callback(undefined, null);
        return;
      }

      if (record.expiresAt.getTime() <= Date.now()) {
        await record.destroy();
        callback(undefined, null);
        return;
      }

      callback(undefined, record.data);
    } catch (error) {
      callback(error);
    }
  }

  override async set(sid: string, sessionData: SessionData, callback?: (error?: unknown) => void) {
    try {
      const now = new Date();

      await this.#sessionModel.upsert({
        sid,
        data: sessionData,
        expiresAt: resolveSessionExpiry(sessionData, now, this.#ttlHours)
      });

      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override async destroy(sid: string, callback?: (error?: unknown) => void) {
    try {
      await this.#sessionModel.destroy({ where: { sid } });
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override async touch(sid: string, sessionData: SessionData, callback?: () => void) {
    const now = new Date();

    try {
      await this.#sessionModel.update(
        { expiresAt: resolveSessionExpiry(sessionData, now, this.#ttlHours) },
        { where: { sid } }
      );
      callback?.();
    } catch {
      callback?.();
    }
  }

  async cleanupExpiredSessions(referenceDate = new Date()) {
    await this.#sessionModel.destroy({
      where: {
        expiresAt: { [Op.lt]: referenceDate }
      }
    });
  }
}

let storeInstance: Store | null = null;

export const createSequelizeSessionStore = (options: CreateSequelizeSessionStoreOptions) => {
  if (storeInstance) {
    return storeInstance;
  }

  const sequelize = createSequelize();
  const sessionModel = initSessionModel(sequelize);
  storeInstance = new SequelizeSessionStore(sessionModel, options);
  return storeInstance;
};
