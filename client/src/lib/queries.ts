import { getChatsQuery } from "@/queries/getChats";
import { getCurrentUserQuery } from "@/queries/getCurrentUser";

export const profileQuery = () => getCurrentUserQuery();
export const chatsQuery = () => getChatsQuery();
export const conversationsQuery = () => getChatsQuery();
