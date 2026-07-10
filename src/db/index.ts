import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

/**
 * Next dev server hot-reloads modules; without caching the client on
 * globalThis every reload opens a fresh pool and Postgres runs out of slots.
 */
const globalForDb = globalThis as unknown as { __imsSql?: postgres.Sql };

const sql =
  globalForDb.__imsSql ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    // Return numeric/decimal as string. Never let PHP centavos touch a float.
    types: {
      bigint: postgres.BigInt,
    },
  });

if (process.env.NODE_ENV !== "production") globalForDb.__imsSql = sql;

export const db = drizzle(sql, { schema, casing: "snake_case" });
export type Db = typeof db;
export { sql as pgClient };
export * as schema from "./schema";
