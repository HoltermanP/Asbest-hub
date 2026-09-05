import { text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Columns shared by every tenant-scoped table. */
export const orgColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: text("created_by").notNull(),
};

export type Confidence = "laag" | "middel" | "hoog";

/** Source reference attached to every AI output. */
export interface AiSource {
  kind: "kennisbank" | "document" | "inschrijving" | "project";
  id: string;
  title: string;
  page: number | null;
  url: string | null;
  excerpt: string | null;
}
