import { defineConfig } from "drizzle-kit";

if (!process.env.DB_URL) throw new Error("Database URL does not exits");

console.log("Using database URL:", process.env.DB_URL);

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./src/db/drizzle",
	dbCredentials: {
		url: process.env.DB_URL,
	},
});
