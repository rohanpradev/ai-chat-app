import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "@/db/schema";
import env from "@/utils/env";

const client = new SQL(env.DB_URL);

export const db = drizzle({ client, schema });
