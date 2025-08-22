import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import type { AppRouteHandler } from "@/lib/types";
import type {
	createConversationRoute,
	getConversationRoute,
	getConversationsRoute,
	updateConversationRoute
} from "./conversations.route";

export const createConversation: AppRouteHandler<typeof createConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { title } = c.req.valid("json");

	const [conversation] = await db
		.insert(aiConversations)
		.values({
			messages: [],
			title: title || "New Conversation",
			userId: userJwt.id
		})
		.returning();

	return c.json(
		{
			data: {
				createdAt: conversation.createdAt?.toISOString() || new Date().toISOString(),
				id: conversation.id,
				messages: conversation.messages as any[],
				title: conversation.title,
				updatedAt: conversation.updatedAt?.toISOString() || null
			},
			message: "Conversation created successfully"
		},
		201
	);
};

export const getConversations: AppRouteHandler<typeof getConversationsRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;

	const conversations = await db
		.select({
			createdAt: aiConversations.createdAt,
			id: aiConversations.id,
			messages: aiConversations.messages,
			title: aiConversations.title,
			updatedAt: aiConversations.updatedAt
		})
		.from(aiConversations)
		.where(eq(aiConversations.userId, userJwt.id))
		.orderBy(aiConversations.updatedAt);

	return c.json({
		data: conversations.map((conv) => ({
			createdAt: conv.createdAt?.toISOString() || new Date().toISOString(),
			id: conv.id,
			messages: conv.messages as any[],
			title: conv.title,
			updatedAt: conv.updatedAt?.toISOString() || null
		})),
		message: "Conversations retrieved successfully"
	});
};

export const getConversation: AppRouteHandler<typeof getConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { id } = c.req.valid("param");

	const [conversation] = await db
		.select()
		.from(aiConversations)
		.where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userJwt.id)));

	if (!conversation) {
		return c.json({ error: "Conversation not found", message: "The requested conversation was not found" }, 404);
	}

	return c.json({
		data: {
			createdAt: conversation.createdAt?.toISOString() || new Date().toISOString(),
			id: conversation.id,
			messages: conversation.messages as any[],
			title: conversation.title,
			updatedAt: conversation.updatedAt?.toISOString() || null
		},
		message: "Conversation retrieved successfully"
	});
};

export const updateConversation: AppRouteHandler<typeof updateConversationRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { id } = c.req.valid("param");
	const { messages, title } = c.req.valid("json");

	await db
		.update(aiConversations)
		.set({
			messages: messages as any,
			title,
			updatedAt: new Date()
		})
		.where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userJwt.id)));

	return c.json({
		message: "Conversation updated successfully",
		success: true
	});
};
