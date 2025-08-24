import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import type { GetChatRoute, GetChatsRoute, UpsertChatRoute } from "@/routes/chat/chat.route";
import { getChat, getChats, upsertChat } from "@/services/chat.service";

export const upsertChatHandler: AppRouteHandler<UpsertChatRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { chatId, title, messages = [] } = c.req.valid("json");

	const data = await upsertChat({ chatId, messages, title, userId: userJwt.id });

	return c.json({ data, message: "Chat saved successfully" }, HttpStatusCodes.CREATED);
};

export const getChatsHandler: AppRouteHandler<GetChatsRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;

	const data = await getChats({ userId: userJwt.id });
	return c.json({ data, message: "Chats retrieved successfully" });
};

export const getChatHandler: AppRouteHandler<GetChatRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const { chatId } = c.req.valid("param");

	const data = await getChat({ chatId, userId: userJwt.id });
	if (!data) return c.json({ data: null, message: "Chat not found" });
	return c.json({ data, message: "Chat retrieved successfully" });
};
