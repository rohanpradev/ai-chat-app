import { relations } from "drizzle-orm";
import { json, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 255 }).notNull(),
	password: varchar("password", { length: 255 }).notNull(),
	profileImage: varchar("profile_image", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date())
});

export const aiConversations = pgTable("ai_conversations", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	id: uuid("id").primaryKey().defaultRandom(),
	messages: json("messages").notNull().default([]),
	title: varchar("title", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
	userId: uuid("user_id")
		.references(() => users.id)
		.notNull()
});

export const userRelations = relations(users, ({ many }) => ({
	aiConversations: many(aiConversations)
}));

export const aiConversationRelations = relations(aiConversations, ({ one }) => ({
	user: one(users, {
		fields: [aiConversations.userId],
		references: [users.id]
	})
}));
