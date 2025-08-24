import { relations } from "drizzle-orm";
import { integer, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	id: varchar("id", { length: 255 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: varchar("name", { length: 255 }).notNull(),
	password: varchar("password", { length: 255 }).notNull(),
	profileImage: varchar("profile_image", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date())
});

export const chats = pgTable("chat", {
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true
	})
		.notNull()
		.defaultNow(),
	id: varchar("id", { length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => Bun.randomUUIDv7()),
	title: varchar("title", { length: 255 }).notNull(),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		withTimezone: true
	})
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date()),
	userId: varchar("user_id", { length: 255 })
		.notNull()
		.references(() => users.id)
});

export const chatsRelations = relations(chats, ({ one, many }) => ({
	messages: many(messages),
	user: one(users, { fields: [chats.userId], references: [users.id] })
}));

export const messages = pgTable("message", {
	chatId: varchar("chat_id", { length: 255 })
		.notNull()
		.references(() => chats.id),
	createdAt: timestamp("created_at", {
		mode: "date",
		withTimezone: true
	})
		.notNull()
		.defaultNow(),
	id: varchar("id", { length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	order: integer("order").notNull(),
	parts: json("parts").notNull(),
	role: varchar("role", { length: 255 }).notNull()
});

export const messagesRelations = relations(messages, ({ one }) => ({
	chat: one(chats, { fields: [messages.chatId], references: [chats.id] })
}));
