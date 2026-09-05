import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __asbesthubSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  return postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

const sql = globalThis.__asbesthubSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__asbesthubSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema, sql as rawSql };
