import { generateId } from "ai";
import { relations } from "drizzle-orm";
import { index, integer, json, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 100 }).notNull(),
		password: varchar("password", { length: 255 }).notNull(),
		profileImage: text("profile_image"),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [index("users_created_at_idx").on(table.createdAt), index("users_email_idx").on(table.email)]
);

export const chats = pgTable(
	"chat",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		id: varchar("id")
			.primaryKey()
			.$defaultFn(() => generateId()),
		messages: json("messages").notNull().default([]),
		title: varchar("title", { length: 200 }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdate(() => new Date()),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
	},
	(table) => [
		index("chats_title_idx").on(table.title),
		index("chats_updated_at_idx").on(table.updatedAt),
		index("chats_user_id_idx").on(table.userId),
		index("chats_user_updated_idx").on(table.userId, table.updatedAt)
	]
);

export const userRelations = relations(users, ({ many }) => ({
	chats: many(chats)
}));

export const chatRelations = relations(chats, ({ one, many }) => ({
	messages: many(messages),
	user: one(users, {
		fields: [chats.userId],
		references: [users.id]
	})
}));

export const messages = pgTable(
	"message",
	{
		chatId: varchar("chat_id", { length: 255 })
			.notNull()
			.references(() => chats.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true
		})
			.notNull()
			.$defaultFn(() => new Date()),
		id: varchar("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		order: integer("order").notNull(),
		parts: json("parts").notNull(),
		role: varchar("role", { length: 20 }).notNull()
	},
	(table) => [
		index("messages_chat_id_idx").on(table.chatId),
		index("messages_chat_order_idx").on(table.chatId, table.order),
		index("messages_created_at_idx").on(table.createdAt),
		index("messages_role_idx").on(table.role)
	]
);

export const messagesRelations = relations(messages, ({ one }) => ({
	chat: one(chats, { fields: [messages.chatId], references: [chats.id] })
}));
