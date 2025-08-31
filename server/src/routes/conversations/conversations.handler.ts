import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "@/db";
import { chats } from "@/db/schema";
import type { AppRouteHandler } from "@/lib/types";
import type {
	CreateConversationRoute,
	GetConversationRoute,
	GetConversationsRoute,
	UpdateConversationRoute
} from "@/routes/conversations/conversations.route";

export const createConversation: AppRouteHandler<CreateConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { title } = c.req.valid("json");

	const [conversation] = await db
		.insert(chats)
		.values({
			title: title ?? "New Conversation",
			userId: userJwt.id
		})
		.returning();

	return c.json(
		{
			data: {
				createdAt: conversation.createdAt?.toISOString() || new Date().toISOString(),
				id: conversation.id,
				messages: [],
				title: conversation.title,
				updatedAt: conversation.updatedAt?.toISOString() || null
			},
			message: "Conversation created successfully"
		},
		HttpStatusCodes.CREATED
	);
};

export const getConversations: AppRouteHandler<GetConversationsRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;

	const conversations = await db.query.chats.findMany({
		orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
		where: eq(chats.userId, userJwt.id)
	});

	return c.json({
		data: conversations.map((conv) => ({
			createdAt: conv.createdAt?.toISOString() || new Date().toISOString(),
			id: conv.id,
			title: conv.title,
			updatedAt: conv.updatedAt?.toISOString() || null
		})),
		message: "Conversations retrieved successfully"
	});
};

export const getConversation: AppRouteHandler<GetConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { id } = c.req.valid("param");

	const chat = await db.query.chats.findFirst({
		where: and(eq(chats.id, id), eq(chats.userId, userJwt.id)),
		with: {
			messages: {
				columns: {
					id: true,
					parts: true,
					role: true
				},
				orderBy: (message, { asc }) => [asc(message.order)]
			}
		}
	});

	return c.json({
		data: chat
			? {
					createdAt: chat.createdAt?.toISOString() || new Date().toISOString(),
					id: chat.id,
					messages: chat.messages || [],
					title: chat.title,
					updatedAt: chat.updatedAt?.toISOString() || null
				}
			: null,
		message: "Conversation retrieved successfully"
	});
};

export const updateConversation: AppRouteHandler<UpdateConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { id } = c.req.valid("param");
	const { title } = c.req.valid("json");

	await db
		.update(chats)
		.set({
			title,
			updatedAt: new Date()
		})
		.where(and(eq(chats.id, id), eq(chats.userId, userJwt.id)));

	const [updatedChat] = await db
		.select()
		.from(chats)
		.where(and(eq(chats.id, id), eq(chats.userId, userJwt.id)))
		.limit(1);

	return c.json(
		{
			data: {
				createdAt: updatedChat.createdAt?.toISOString() || new Date().toISOString(),
				id: updatedChat.id,
				title: updatedChat.title,
				updatedAt: updatedChat.updatedAt?.toISOString() || null
			},
			message: "Conversation updated successfully"
		},
		HttpStatusCodes.OK
	);
};
