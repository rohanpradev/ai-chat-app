import { defineConfig } from "drizzle-kit";

// biome-ignore lint/style/noProcessEnv: Drizzle reads its CLI configuration before application startup.
const dbUrl = process.env.DB_URL ?? process.env.DATABASE_URL;

if (!dbUrl) {
	throw new Error("Database URL is required");
}

export default defineConfig({
	dbCredentials: {
		url: dbUrl
	},
	dialect: "postgresql",
	out: "./src/db/drizzle",
	schema: "./src/db/schema.ts"
});
