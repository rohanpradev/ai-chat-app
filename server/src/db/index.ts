import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import env from "@/utils/env";

const db = await drizzle(env.DB_URL, { schema });

export default db;
