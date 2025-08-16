import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Enums
export const friendRequestStatusEnum = pgEnum("friend_request_status", ["PENDING", "ACCEPTED", "DECLINED"]);
export const notificationTypeEnum = pgEnum("notification_type", [
	"FRIEND_REQUEST",
	"FRIEND_REQUEST_ACCEPTED",
	"CHAT_CREATED",
	"CHAT_MESSAGE"
]);
export const chatTypeEnum = pgEnum("chat_type", ["ONE_ON_ONE", "GROUP"]);
export const messageTypeEnum = pgEnum("message_type", ["TEXT", "GIF", "IMAGE"]);

// Guides (for vector search)
// export const guides = pgTable(
// 	"guides",
// 	{
// 		id: uuid("id").primaryKey().defaultRandom(),
// 		title: text("title").notNull(),
// 		description: text("description").notNull(),
// 		url: text("url").notNull(),
// 		embedding: vector("embedding", { dimensions: 768 }),
// 		metadata: text("metadata").notNull(),
// 		createdBy: text("created_by")
// 	},
// 	(table) => [index("embedding_index").using("hnsw", table.embedding.op("vector_cosine_ops"))]
// );

// User
export const users = pgTable("users", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 255 }).notNull(),
	password: varchar("password", { length: 255 }).notNull(),
	profileImage: varchar("profile_image", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date())
});

// Friend Request
export const friendRequests = pgTable("friend_requests", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	id: uuid("id").primaryKey().defaultRandom(),
	receiverId: uuid("receiver_id").notNull(),
	senderId: uuid("sender_id").notNull(),
	status: friendRequestStatusEnum("status").default("PENDING").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date())
});

// Notification
export const notifications = pgTable("notifications", {
	chatId: uuid("chat_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	friendRequestId: uuid("friend_request_id"),
	id: uuid("id").primaryKey().defaultRandom(),
	message: varchar("message", { length: 255 }).notNull(),
	messageId: uuid("message_id"),
	read: boolean("read").default(false).notNull(),
	type: notificationTypeEnum("type").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
	userId: uuid("user_id").notNull()
});

// Chat
export const chats = pgTable("chats", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	id: uuid("id").primaryKey().defaultRandom(),
	lastMessageId: uuid("last_message_id"),
	type: chatTypeEnum("type").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date())
});

// Chat Participant
export const chatParticipants = pgTable("chat_participants", {
	chatId: uuid("chat_id").notNull(),
	id: uuid("id").primaryKey().defaultRandom(),
	joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
	userId: uuid("user_id").notNull()
});

// Chat Message
export const chatMessages = pgTable("chat_messages", {
	chatId: uuid("chat_id").notNull(),
	content: text("content"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	id: uuid("id").primaryKey().defaultRandom(),
	senderId: uuid("sender_id").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date())
});

// Chat Message Media
export const chatMessageMedia = pgTable("chat_message_media", {
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	id: uuid("id").primaryKey().defaultRandom(),
	mediaUrl: varchar("media_url", { length: 255 }).notNull(),
	messageId: uuid("message_id").notNull(),
	type: messageTypeEnum("type").notNull()
});

// #region RELATIONS
// --- User Relations ---
export const userRelations = relations(users, ({ many }) => ({
	chatMessages: many(chatMessages, { relationName: "sentMessages" }),
	chatParticipants: many(chatParticipants),
	notifications: many(notifications),
	receivedFriendRequests: many(friendRequests, {
		relationName: "receivedFriendRequests"
	}),
	sentFriendRequests: many(friendRequests, {
		relationName: "sentFriendRequests"
	})
}));

// --- FriendRequest Relations ---
export const friendRequestRelations = relations(friendRequests, ({ one, many }) => ({
	notifications: many(notifications),
	receiver: one(users, {
		fields: [friendRequests.receiverId],
		references: [users.id],
		relationName: "receivedFriendRequests"
	}),
	sender: one(users, {
		fields: [friendRequests.senderId],
		references: [users.id],
		relationName: "sentFriendRequests"
	})
}));

// --- Notification Relations ---
export const notificationRelations = relations(notifications, ({ one }) => ({
	chat: one(chats, {
		fields: [notifications.chatId],
		references: [chats.id]
	}),
	chatMessage: one(chatMessages, {
		fields: [notifications.messageId],
		references: [chatMessages.id]
	}),
	friendRequest: one(friendRequests, {
		fields: [notifications.friendRequestId],
		references: [friendRequests.id]
	}),
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	})
}));

// --- Chat Relations ---
export const chatRelations = relations(chats, ({ many, one }) => ({
	lastMessage: one(chatMessages, {
		fields: [chats.lastMessageId],
		references: [chatMessages.id],
		relationName: "lastMessage"
	}),
	messages: many(chatMessages),
	notifications: many(notifications),
	participants: many(chatParticipants)
}));

// --- ChatParticipant Relations ---
export const chatParticipantRelations = relations(chatParticipants, ({ one }) => ({
	chat: one(chats, {
		fields: [chatParticipants.chatId],
		references: [chats.id]
	}),
	user: one(users, {
		fields: [chatParticipants.userId],
		references: [users.id]
	})
}));

// --- ChatMessage Relations ---
export const chatMessageRelations = relations(chatMessages, ({ one, many }) => ({
	chat: one(chats, {
		fields: [chatMessages.chatId],
		references: [chats.id]
	}),
	media: many(chatMessageMedia),
	notifications: many(notifications),
	sender: one(users, {
		fields: [chatMessages.senderId],
		references: [users.id],
		relationName: "sentMessages"
	})
}));

// --- ChatMessageMedia Relations ---
export const chatMessageMediaRelations = relations(chatMessageMedia, ({ one }) => ({
	message: one(chatMessages, {
		fields: [chatMessageMedia.messageId],
		references: [chatMessages.id]
	})
}));
// #endregion
