CREATE INDEX IF NOT EXISTS "knowledge_chunks_fts_idx" ON "knowledge_chunks" USING gin (to_tsvector('dutch', coalesce(heading, '') || ' ' || content));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_chunks_fts_idx" ON "bid_chunks" USING gin (to_tsvector('dutch', content));
