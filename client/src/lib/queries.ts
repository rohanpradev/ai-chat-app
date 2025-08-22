import { getConversationsQuery } from "@/queries/getConversations";
import { getCurrentUserQuery } from "@/queries/getCurrentUser";

export const profileQuery = () => getCurrentUserQuery();
export const conversationsQuery = () => getConversationsQuery();
