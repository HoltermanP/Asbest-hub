import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);
  console.log("Migraties uitvoeren...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migraties voltooid.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
