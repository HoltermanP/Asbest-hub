import { z } from "zod";

/**
 * Converts a zod schema to a JSON schema suitable for Anthropic strict tool use.
 * Strict mode only supports a structural subset; numeric/string constraints are
 * removed here and enforced afterwards by zod validation of the tool input.
 */
export function toStrictToolSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return sanitize(json) as Record<string, unknown>;
}

const UNSUPPORTED = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "multipleOf",
  "uniqueItems",
  "default",
]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (UNSUPPORTED.has(key)) continue;
    out[key] = sanitize(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as Record<string, unknown>);
  }
  return out;
}

export const confidenceSchema = z.enum(["laag", "middel", "hoog"]).describe("Betrouwbaarheid van dit resultaat");

export const aiSourceSchema = z.object({
  kind: z.enum(["kennisbank", "document", "inschrijving", "project"]),
  id: z.string().describe("Identifier van de bron, bijv. het label [K3] of het document-id"),
  title: z.string(),
  page: z.number().int().nullable(),
  url: z.string().nullable(),
  excerpt: z.string().nullable().describe("Korte letterlijke passage"),
});
