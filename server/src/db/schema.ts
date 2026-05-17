import { generateId } from "ai";
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	json,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar
} from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		emailVerified: boolean("email_verified").notNull().default(false),
		id: uuid("id").primaryKey().defaultRandom(),
		image: text("profile_image"),
		name: varchar("name", { length: 100 }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [index("users_created_at_idx").on(table.createdAt), index("users_email_idx").on(table.email)]
);

export const sessions = pgTable(
	"session",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => generateId()),
		ipAddress: text("ip_address"),
		token: varchar("token", { length: 255 }).notNull().unique(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdate(() => new Date()),
		userAgent: text("user_agent"),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
	},
	(table) => [index("sessions_token_idx").on(table.token), index("sessions_user_id_idx").on(table.userId)]
);

export const accounts = pgTable(
	"account",
	{
		accessToken: text("access_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => generateId()),
		idToken: text("id_token"),
		password: text("password"),
		providerId: varchar("provider_id", { length: 255 }).notNull(),
		refreshToken: text("refresh_token"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
		scope: text("scope"),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdate(() => new Date()),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
	},
	(table) => [
		uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId),
		index("accounts_user_id_idx").on(table.userId)
	]
);

export const verifications = pgTable(
	"verification",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => generateId()),
		identifier: text("identifier").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdate(() => new Date()),
		value: text("value").notNull()
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)]
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
	accounts: many(accounts),
	chats: many(chats),
	embeddingDocuments: many(embeddingDocuments),
	sessions: many(sessions)
}));

export const chatRelations = relations(chats, ({ one, many }) => ({
	messages: many(messages),
	user: one(users, {
		fields: [chats.userId],
		references: [users.id]
	})
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
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
		metadata: json("metadata"),
		order: integer("order").notNull(),
		parts: json("parts").notNull(),
		role: varchar("role", { length: 20 }).notNull(),
		schemaVersion: integer("schema_version").notNull().default(1)
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

export const embeddingDocuments = pgTable(
	"embedding_document",
	{
		byteSize: integer("byte_size").notNull(),
		checksum: varchar("checksum", { length: 64 }).notNull(),
		chunkCount: integer("chunk_count").notNull().default(0),
		contentType: varchar("content_type", { length: 120 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		embeddingDimensions: integer("embedding_dimensions").notNull(),
		embeddingModel: varchar("embedding_model", { length: 120 }).notNull(),
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => generateId()),
		metadata: json("metadata").$type<Record<string, unknown>>(),
		sourceName: varchar("source_name", { length: 255 }),
		sourceType: varchar("source_type", { length: 40 }).notNull(),
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
		index("embedding_documents_checksum_idx").on(table.userId, table.checksum),
		index("embedding_documents_updated_at_idx").on(table.updatedAt),
		index("embedding_documents_user_id_idx").on(table.userId)
	]
);

export const embeddingChunks = pgTable(
	"embedding_chunk",
	{
		chunkIndex: integer("chunk_index").notNull(),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		documentId: varchar("document_id", { length: 255 })
			.references(() => embeddingDocuments.id, { onDelete: "cascade" })
			.notNull(),
		embedding: json("embedding").$type<number[]>().notNull(),
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => generateId()),
		metadata: json("metadata").$type<Record<string, unknown>>(),
		tokenEstimate: integer("token_estimate").notNull(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
	},
	(table) => [
		index("embedding_chunks_document_id_idx").on(table.documentId),
		uniqueIndex("embedding_chunks_document_index_idx").on(table.documentId, table.chunkIndex),
		index("embedding_chunks_user_id_idx").on(table.userId)
	]
);

export const embeddingDocumentsRelations = relations(embeddingDocuments, ({ many, one }) => ({
	chunks: many(embeddingChunks),
	user: one(users, {
		fields: [embeddingDocuments.userId],
		references: [users.id]
	})
}));

export const embeddingChunksRelations = relations(embeddingChunks, ({ one }) => ({
	document: one(embeddingDocuments, {
		fields: [embeddingChunks.documentId],
		references: [embeddingDocuments.id]
	}),
	user: one(users, {
		fields: [embeddingChunks.userId],
		references: [users.id]
	})
}));
