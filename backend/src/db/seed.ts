import { initModels } from "./models/index.js";
import { createSequelize } from "./sequelize.js";

const ids = {
  roles: {
    user: "00000000-0000-4000-8000-000000000001",
    moderator: "00000000-0000-4000-8000-000000000002",
    administrator: "00000000-0000-4000-8000-000000000003"
  },
  users: {
    viewer: "00000000-0000-4000-8000-000000000101",
    moderator: "00000000-0000-4000-8000-000000000102"
  },
  streamers: {
    nova: "00000000-0000-4000-8000-000000000201",
    axle: "00000000-0000-4000-8000-000000000202",
    mira: "00000000-0000-4000-8000-000000000203"
  },
  characters: {
    camille: "00000000-0000-4000-8000-000000000301",
    malik: "00000000-0000-4000-8000-000000000302",
    ines: "00000000-0000-4000-8000-000000000303"
  },
  tags: {
    northDistrict: "00000000-0000-4000-8000-000000000401",
    logistics: "00000000-0000-4000-8000-000000000402",
    family: "00000000-0000-4000-8000-000000000403"
  },
  relationships: {
    sibling: "00000000-0000-4000-8000-000000000502"
  }
};

const sequelize = createSequelize();
const models = initModels(sequelize);

try {
  await sequelize.transaction(async (transaction) => {
    await models.CharacterRelationship.destroy({
      where: { id: Object.values(ids.relationships) },
      transaction
    });
    await models.CharacterTag.destroy({
      where: {},
      transaction,
      truncate: true
    });
    await models.ChangeHistory.destroy({ where: {}, transaction });
    await models.ChangeRequest.destroy({ where: {}, transaction });
    await models.Ban.destroy({ where: {}, transaction });

    await models.Character.destroy({
      where: { id: Object.values(ids.characters) },
      transaction
    });
    await models.Tag.destroy({
      where: { id: Object.values(ids.tags) },
      transaction
    });
    await models.Streamer.destroy({
      where: { id: Object.values(ids.streamers) },
      transaction
    });
    await models.User.destroy({
      where: { id: Object.values(ids.users) },
      transaction
    });
    await models.Role.destroy({
      where: { id: Object.values(ids.roles) },
      transaction
    });

    await models.Role.bulkCreate(
      [
        { id: ids.roles.user, name: "user" },
        { id: ids.roles.moderator, name: "moderator" },
        { id: ids.roles.administrator, name: "administrator" }
      ],
      { transaction }
    );

    await models.User.bulkCreate(
      [
        {
          id: ids.users.viewer,
          googleId: "seed-viewer-google-id",
          email: "viewer.seed@example.test",
          displayName: "Spectateur Seed",
          avatarUrl: null,
          roleId: ids.roles.user,
          lastLoginAt: null
        },
        {
          id: ids.users.moderator,
          googleId: "seed-moderator-google-id",
          email: "moderator.seed@example.test",
          displayName: "Moderateur Seed",
          avatarUrl: null,
          roleId: ids.roles.moderator,
          lastLoginAt: null
        }
      ],
      { transaction }
    );

    await models.Streamer.bulkCreate(
      [
        {
          id: ids.streamers.nova,
          publicName: "NovaRP",
          primaryPlatform: "twitch",
          socialLinks: { twitch: "https://twitch.tv/example-novarp" },
          verificationStatus: "community"
        },
        {
          id: ids.streamers.axle,
          publicName: "AxleLive",
          primaryPlatform: "twitch",
          socialLinks: { twitch: "https://twitch.tv/example-axlelive" },
          verificationStatus: "community"
        },
        {
          id: ids.streamers.mira,
          publicName: "MiraScenes",
          primaryPlatform: "youtube",
          socialLinks: { youtube: "https://youtube.com/@example-mirascenes" },
          verificationStatus: "to_check"
        }
      ],
      { transaction }
    );

    await models.Tag.bulkCreate(
      [
        {
          id: ids.tags.northDistrict,
          name: "Quartier Nord",
          type: "district",
          colorHex: "#2f9bff",
          description: "Groupe geographique fictif pour le developpement."
        },
        {
          id: ids.tags.logistics,
          name: "Blue Line Logistics",
          type: "business",
          colorHex: "#38c7ff",
          description: "Entreprise fictive utilisee dans les seeds."
        },
        {
          id: ids.tags.family,
          name: "Famille Morel",
          type: "family",
          colorHex: "#7bb7ff",
          description: "Lien familial fictif pour tester les relations."
        }
      ],
      { transaction }
    );

    await models.Character.bulkCreate(
      [
        {
          id: ids.characters.camille,
          firstName: "Camille",
          lastName: "Morel",
          nickname: "Cami",
          birthDate: null,
          lifeStatus: "alive",
          deathOrDepartureDate: null,
          photoUrl: null,
          businessName: "Blue Line Logistics",
          businessRank: "Responsable planning",
          businessBadgeNumber: "BL-17",
          phoneNumber: "555-0101",
          streamerId: ids.streamers.nova,
          socialLinks: null,
          groupName: "Quartier Nord",
          groupRole: "Mediatrice",
          district: "Nord",
          isRpDeath: false,
          policeRank: null,
          policeBadgeNumber: null,
          previousCharacters: { v5: "Nom inconnu" },
          verificationStatus: "community",
          dataSource: "seed",
          sourceNote: "Donnee fictive de developpement."
        },
        {
          id: ids.characters.malik,
          firstName: "Malik",
          lastName: "Serrano",
          nickname: "Serrano",
          birthDate: null,
          lifeStatus: "alive",
          deathOrDepartureDate: null,
          photoUrl: null,
          businessName: "Blue Line Logistics",
          businessRank: "Chauffeur",
          businessBadgeNumber: "BL-23",
          phoneNumber: "555-0102",
          streamerId: ids.streamers.axle,
          socialLinks: null,
          groupName: "Quartier Nord",
          groupRole: "Contact terrain",
          district: "Nord",
          isRpDeath: false,
          policeRank: null,
          policeBadgeNumber: null,
          previousCharacters: null,
          verificationStatus: "community",
          dataSource: "seed",
          sourceNote: "Donnee fictive de developpement."
        },
        {
          id: ids.characters.ines,
          firstName: "Ines",
          lastName: "Morel",
          nickname: null,
          birthDate: null,
          lifeStatus: "unknown",
          deathOrDepartureDate: null,
          photoUrl: null,
          businessName: null,
          businessRank: null,
          businessBadgeNumber: null,
          phoneNumber: "555-0103",
          streamerId: ids.streamers.mira,
          socialLinks: null,
          groupName: "Famille Morel",
          groupRole: "Soeur cadette",
          district: null,
          isRpDeath: false,
          policeRank: null,
          policeBadgeNumber: null,
          previousCharacters: null,
          verificationStatus: "to_check",
          dataSource: "seed",
          sourceNote: "Donnee fictive de developpement."
        }
      ],
      { transaction }
    );

    await models.CharacterTag.bulkCreate(
      [
        {
          characterId: ids.characters.camille,
          tagId: ids.tags.northDistrict
        },
        {
          characterId: ids.characters.camille,
          tagId: ids.tags.logistics
        },
        {
          characterId: ids.characters.camille,
          tagId: ids.tags.family
        },
        {
          characterId: ids.characters.malik,
          tagId: ids.tags.northDistrict
        },
        {
          characterId: ids.characters.malik,
          tagId: ids.tags.logistics
        },
        {
          characterId: ids.characters.ines,
          tagId: ids.tags.family
        }
      ],
      { transaction }
    );

    await models.CharacterRelationship.bulkCreate(
      [
        {
          id: ids.relationships.sibling,
          sourceCharacterId: ids.characters.camille,
          targetCharacterId: ids.characters.ines,
          type: "sibling",
          direction: "symmetric",
          label: "Soeurs",
          description: "Relation familiale fictive.",
          source: "seed",
          verificationStatus: "to_check"
        }
      ],
      { transaction }
    );
  });

  console.log("Development seed completed.");
} finally {
  await sequelize.close();
}
