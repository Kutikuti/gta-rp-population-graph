import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

import {
  changeRequestStatuses,
  changeRequestTypes,
  notionImportEntryStatuses
} from "../db/enums.js";
import { models } from "../db/index.js";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry
});

export const httpRequestsTotal = new Counter({
  name: "gta_rp_http_requests_total",
  help: "Total des requetes HTTP traitees par l'API.",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry]
});

export const httpRequestDurationSeconds = new Histogram({
  name: "gta_rp_http_request_duration_seconds",
  help: "Duree des requetes HTTP traitees par l'API.",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry]
});

const publishedCharactersGauge = new Gauge({
  name: "gta_rp_characters_published",
  help: "Nombre de fiches personnage publiees.",
  registers: [metricsRegistry]
});

const streamersGauge = new Gauge({
  name: "gta_rp_streamers_total",
  help: "Nombre de streamers connus.",
  registers: [metricsRegistry]
});

const tagsGauge = new Gauge({
  name: "gta_rp_tags_total",
  help: "Nombre de tags administrables.",
  registers: [metricsRegistry]
});

const relationshipsGauge = new Gauge({
  name: "gta_rp_character_relationships_total",
  help: "Nombre de relations personnage stockees.",
  registers: [metricsRegistry]
});

const changeRequestsGauge = new Gauge({
  name: "gta_rp_change_requests_total",
  help: "Nombre de demandes de changement par statut et type.",
  labelNames: ["status", "type"] as const,
  registers: [metricsRegistry]
});

const latestNotionBatchCreatedGauge = new Gauge({
  name: "gta_rp_notion_import_latest_batch_created_timestamp_seconds",
  help: "Timestamp Unix de creation du dernier batch d'import Notion.",
  registers: [metricsRegistry]
});

const latestNotionEntriesGauge = new Gauge({
  name: "gta_rp_notion_import_latest_entries_total",
  help: "Nombre d'entrees du dernier batch Notion par statut.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry]
});

export type MetricsService = {
  renderMetrics(): Promise<string>;
  contentType: string;
};

export const collectBusinessMetrics = async () => {
  const [charactersCount, streamersCount, tagsCount, relationshipsCount] = await Promise.all([
    models.Character.count(),
    models.Streamer.count(),
    models.Tag.count(),
    models.CharacterRelationship.count()
  ]);

  publishedCharactersGauge.set(charactersCount);
  streamersGauge.set(streamersCount);
  tagsGauge.set(tagsCount);
  relationshipsGauge.set(relationshipsCount);

  await Promise.all(
    changeRequestStatuses.flatMap((status) =>
      changeRequestTypes.map(async (requestType) => {
        const count = await models.ChangeRequest.count({
          where: {
            status,
            requestType
          }
        });
        changeRequestsGauge.set({ status, type: requestType }, count);
      })
    )
  );

  const latestBatch = await models.NotionImportBatch.findOne({
    order: [["createdAt", "DESC"]]
  });

  latestNotionBatchCreatedGauge.set(latestBatch ? latestBatch.createdAt.getTime() / 1000 : 0);

  await Promise.all(
    notionImportEntryStatuses.map(async (status) => {
      const count = latestBatch
        ? await models.NotionImportEntry.count({
            where: {
              batchId: latestBatch.id,
              status
            }
          })
        : 0;
      latestNotionEntriesGauge.set({ status }, count);
    })
  );
};

export class PrometheusMetricsService implements MetricsService {
  readonly contentType = metricsRegistry.contentType;

  async renderMetrics() {
    await collectBusinessMetrics();
    return metricsRegistry.metrics();
  }
}
