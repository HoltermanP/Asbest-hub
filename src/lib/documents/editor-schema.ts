import { z } from "zod";

/** Validation of the payload sent by the document editor. */
export const editorPayloadSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(3, "Titel is verplicht (minimaal 3 tekens)").max(200),
  subtitle: z.string().max(300).nullable(),
  summary: z.string().max(4000).nullable(),
  changeNote: z.string().max(1000).nullable(),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(300),
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        blocks: z.array(
          z.object({
            type: z.enum(["paragraph", "bullets", "numbered", "table", "note"]),
            text: z.string().max(20000).optional(),
            items: z.array(z.string().max(5000)).max(200).optional(),
            table: z.object({ headers: z.array(z.string().max(500)).max(20), rows: z.array(z.object({ cells: z.array(z.string().max(2000)).max(20) })).max(500) }).optional(),
          }),
        ),
        sources: z.array(z.string()).optional(),
      }),
    )
    .min(1, "Het document heeft geen inhoud")
    .max(200),
});
export type EditorPayloadInput = z.infer<typeof editorPayloadSchema>;
