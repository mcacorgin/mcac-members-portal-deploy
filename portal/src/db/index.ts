import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/mcac_portal";

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export * as tables from "./schema";

export type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
