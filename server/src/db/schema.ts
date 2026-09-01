import { generateId } from "ai";
import { defineRelations } from "drizzle-orm";
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
	varchar,
	vector
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "@/lib/embedding-config";

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
		issuer: varchar("issuer", { length: 255 }).notNull(),
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
		uniqueIndex("accounts_issuer_account_idx").on(table.issuer, table.accountId),
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
		revision: integer("revision").notNull().default(1),
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

export const messageRevisions = pgTable(
	"message_revision",
	{
		chatId: varchar("chat_id", { length: 255 })
			.notNull()
			.references(() => chats.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		id: uuid("id").primaryKey().defaultRandom(),
		messageId: varchar("message_id", { length: 255 }).notNull(),
		metadata: json("metadata"),
		order: integer("order").notNull(),
		parts: json("parts").notNull(),
		revision: integer("revision").notNull(),
		role: varchar("role", { length: 20 }).notNull(),
		schemaVersion: integer("schema_version").notNull()
	},
	(table) => [
		uniqueIndex("message_revisions_message_revision_idx").on(table.messageId, table.revision),
		index("message_revisions_chat_created_idx").on(table.chatId, table.createdAt)
	]
);

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
		embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
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
		index("embedding_chunks_user_id_idx").on(table.userId),
		index("embedding_chunks_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
	]
);

export const usageEvents = pgTable(
	"usage_event",
	{
		category: varchar("category", { length: 40 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		id: uuid("id").primaryKey().defaultRandom(),
		inputTokens: integer("input_tokens").notNull().default(0),
		model: varchar("model", { length: 120 }),
		outputTokens: integer("output_tokens").notNull().default(0),
		requestId: varchar("request_id", { length: 255 }).notNull(),
		reservedTokens: integer("reserved_tokens").notNull().default(0),
		resourceBytes: integer("resource_bytes").notNull().default(0),
		scope: varchar("scope", { length: 20 }).notNull(),
		status: varchar("status", { length: 20 }).notNull().default("reserved"),
		totalTokens: integer("total_tokens").notNull().default(0),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
	},
	(table) => [
		uniqueIndex("usage_events_request_id_idx").on(table.requestId),
		index("usage_events_user_scope_created_idx").on(table.userId, table.scope, table.createdAt)
	]
);

const relationalSchema = {
	accounts,
	chats,
	embeddingChunks,
	embeddingDocuments,
	messageRevisions,
	messages,
	sessions,
	usageEvents,
	users,
	verifications
};

export const dbRelations = defineRelations(relationalSchema, (r) => ({
	accounts: {
		user: r.one.users({
			from: r.accounts.userId,
			to: r.users.id
		})
	},
	chats: {
		messages: r.many.messages({
			from: r.chats.id,
			to: r.messages.chatId
		}),
		user: r.one.users({
			from: r.chats.userId,
			to: r.users.id
		})
	},
	embeddingChunks: {
		document: r.one.embeddingDocuments({
			from: r.embeddingChunks.documentId,
			to: r.embeddingDocuments.id
		}),
		user: r.one.users({
			from: r.embeddingChunks.userId,
			to: r.users.id
		})
	},
	embeddingDocuments: {
		chunks: r.many.embeddingChunks({
			from: r.embeddingDocuments.id,
			to: r.embeddingChunks.documentId
		}),
		user: r.one.users({
			from: r.embeddingDocuments.userId,
			to: r.users.id
		})
	},
	messages: {
		chat: r.one.chats({
			from: r.messages.chatId,
			to: r.chats.id
		})
	},
	sessions: {
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id
		})
	},
	users: {
		accounts: r.many.accounts({
			from: r.users.id,
			to: r.accounts.userId
		}),
		chats: r.many.chats({
			from: r.users.id,
			to: r.chats.userId
		}),
		embeddingDocuments: r.many.embeddingDocuments({
			from: r.users.id,
			to: r.embeddingDocuments.userId
		}),
		sessions: r.many.sessions({
			from: r.users.id,
			to: r.sessions.userId
		})
	}
}));
