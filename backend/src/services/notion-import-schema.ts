import { z } from "zod";

export const notionPageSchema = z.object({
  pageId: z.string().min(1),
  url: z.string().url().optional(),
  properties: z.record(z.string(), z.unknown()).default({})
});

export const notionImportInputSchema = z.object({
  sourceName: z.string().min(1).default("Notion communautaire"),
  sourceUrl: z.string().url().optional(),
  fullSource: z.boolean().default(true),
  pages: z.array(notionPageSchema).min(1)
});

export type NotionPageInput = z.infer<typeof notionPageSchema>;
export type NotionImportInput = z.infer<typeof notionImportInputSchema>;
