import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error("Database URL does not exist");

console.log("Using database URL:", dbUrl);

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./src/db/drizzle",
	dbCredentials: {
		url: dbUrl,
	},
});
