/**
 * Imports the public knowledge sources and the curated seed files into the
 * shared knowledge base (organization_id = null). Run: pnpm knowledge:import
 * Options: --only=<key,key> to import specific sources, --skip-web to import seed files only.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { rawSql } from "../src/db";
import { importPublicSource, importSeedMarkdown, KNOWLEDGE_SOURCES } from "../src/lib/knowledge";

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean) ?? null;
  const skipWeb = args.includes("--skip-web");
  const actor = { kind: "system" as const, source: "knowledge-import" };
  if (!process.env.OPENAI_API_KEY) console.warn("OPENAI_API_KEY ontbreekt: bronnen worden zonder embeddings geïndexeerd (alleen full-text zoeken).");

  const seedDir = path.join(process.cwd(), "data", "knowledge");
  const files = readdirSync(seedDir).filter((f) => f.endsWith(".md")).sort();
  console.log(`Seed-bestanden: ${files.length}`);
  for (const f of files) {
    if (only && !only.includes(f.replace(/\.md$/, ""))) continue;
    try {
      const res = await importSeedMarkdown(f, readFileSync(path.join(seedDir, f), "utf8"), actor);
      console.log(`  ok   ${f} -> ${res.chunks} chunks`);
    } catch (err) {
      console.error(`  FOUT ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!skipWeb) {
    console.log(`Publieke bronnen: ${KNOWLEDGE_SOURCES.length}`);
    for (const def of KNOWLEDGE_SOURCES) {
      if (only && !only.includes(def.key)) continue;
      try {
        const res = await importPublicSource(def, actor);
        console.log(`  ${res.skipped ? "skip" : "ok  "} ${def.key} -> ${res.chunks} chunks${res.skipped ? " (ongewijzigd)" : ""}`);
      } catch (err) {
        console.error(`  FOUT ${def.key}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  console.log("Import gereed.");
}

main()
  .then(async () => {
    await rawSql.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await rawSql.end();
    process.exit(1);
  });
