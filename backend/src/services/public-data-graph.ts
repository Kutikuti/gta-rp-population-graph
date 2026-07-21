import { Op } from "sequelize";

import { relationshipTypes } from "../db/enums.js";
import { models } from "../db/index.js";
import { type Character, Streamer, Tag } from "../db/models/index.js";
import {
  canonicalRelationshipKey,
  canonicalRelationshipRecord,
  relationshipLabel
} from "./character-relationships.js";
import { fullName, type PublicGraph } from "./public-data-serializers.js";

export class SequelizePublicGraphService {
  async getGraph(): Promise<PublicGraph> {
    const [characters, relationships] = await Promise.all([
      models.Character.findAll({
        include: [
          {
            model: Streamer,
            as: "streamer",
            required: false
          },
          {
            model: Tag,
            as: "tags",
            through: { attributes: [] },
            required: false
          }
        ],
        order: [
          ["lastName", "ASC"],
          ["firstName", "ASC"]
        ]
      }),
      models.CharacterRelationship.findAll({
        where: {
          type: {
            [Op.in]: relationshipTypes
          }
        },
        order: [["label", "ASC"]]
      })
    ]);

    const dedupedRelationships = relationships.filter((relationship, index, items) => {
      const key = canonicalRelationshipKey(
        relationship.type,
        relationship.direction,
        relationship.sourceCharacterId,
        relationship.targetCharacterId
      );

      return (
        items.findIndex(
          (candidate) =>
            canonicalRelationshipKey(
              candidate.type,
              candidate.direction,
              candidate.sourceCharacterId,
              candidate.targetCharacterId
            ) === key
        ) === index
      );
    });

    return {
      nodes: characters.map((character: Character) => ({
        data: {
          id: character.id,
          type: "character",
          label: fullName(character),
          characterId: character.id,
          fullName: fullName(character),
          companyName: character.companyName,
          groupName: character.groupName,
          lifeStatus: character.lifeStatus,
          verificationStatus: character.verificationStatus,
          photoUrl: character.photoUrl,
          streamerName: character.streamer?.publicName ?? null,
          tagIds: character.tags?.map((tag) => tag.id) ?? []
        }
      })),
      edges: dedupedRelationships.map((relationship) => {
        const canonical = canonicalRelationshipRecord(
          relationship.type,
          relationship.direction,
          relationship.sourceCharacterId,
          relationship.targetCharacterId
        );

        return {
          data: {
            id: relationship.id,
            type: "relationship",
            source: canonical.sourceCharacterId,
            target: canonical.targetCharacterId,
            label: relationshipLabel(canonical.type),
            relationshipType: canonical.type,
            direction: canonical.direction,
            verificationStatus: relationship.verificationStatus
          }
        };
      })
    };
  }
}
