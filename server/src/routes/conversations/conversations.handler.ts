import { CreateConversationRequestSchema, UpdateConversationRequestSchema } from "@chat-app/shared";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chats } from "@/db/schema";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import type {
	CreateConversationRoute,
	GetConversationRoute,
	GetConversationsRoute,
	UpdateConversationRoute
} from "@/routes/conversations/conversations.route";

export const createConversation: AppRouteHandler<CreateConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { title } = CreateConversationRequestSchema.parse(await c.req.json());

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

	return c.json(
		{
			data: conversations.map((conv) => ({
				createdAt: conv.createdAt?.toISOString() || new Date().toISOString(),
				id: conv.id,
				title: conv.title,
				updatedAt: conv.updatedAt?.toISOString() || null
			})),
			message: "Conversations retrieved successfully"
		},
		HttpStatusCodes.OK
	);
};

export const getConversation: AppRouteHandler<GetConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { id } = c.req.param() as { id: string };

	const chat = await db.query.chats.findFirst({
		where: and(eq(chats.id, id), eq(chats.userId, userJwt.id)),
		with: {
			messages: {
				columns: {
					createdAt: true,
					id: true,
					metadata: true,
					parts: true,
					role: true,
					schemaVersion: true
				},
				orderBy: (message, { asc }) => [asc(message.order)]
			}
		}
	});

	if (!chat) {
		return c.json(
			{
				message: "Conversation not found"
			},
			HttpStatusCodes.NOT_FOUND
		);
	}

	const normalizedMessages = (chat.messages || []).map((message) => ({
		createdAt: message.createdAt?.toISOString(),
		id: message.id,
		metadata: message.metadata ?? undefined,
		parts: (Array.isArray(message.parts) ? message.parts : []) as unknown[],
		role: message.role,
		schemaVersion: message.schemaVersion
	}));

	return c.json(
		{
			data: {
				createdAt: chat.createdAt?.toISOString() || new Date().toISOString(),
				id: chat.id,
				messages: normalizedMessages,
				title: chat.title,
				updatedAt: chat.updatedAt?.toISOString() || null
			},
			message: "Conversation retrieved successfully"
		},
		HttpStatusCodes.OK
	);
};

export const updateConversation: AppRouteHandler<UpdateConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { id } = c.req.param() as { id: string };
	const { title } = UpdateConversationRequestSchema.parse(await c.req.json());

	const [updatedChat] = await db
		.update(chats)
		.set({
			title,
			updatedAt: new Date()
		})
		.where(and(eq(chats.id, id), eq(chats.userId, userJwt.id)))
		.returning();

	if (!updatedChat) {
		return c.json(
			{
				message: "Conversation not found"
			},
			HttpStatusCodes.NOT_FOUND
		);
	}

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
