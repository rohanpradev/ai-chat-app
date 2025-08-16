ALTER TABLE "chat_message" RENAME TO "chat_messages";--> statement-breakpoint
ALTER TABLE "chat_participant" RENAME TO "chat_participants";--> statement-breakpoint
ALTER TABLE "chat" RENAME TO "chats";--> statement-breakpoint
ALTER TABLE "friend_request" RENAME TO "friend_requests";--> statement-breakpoint
ALTER TABLE "notification" RENAME TO "notifications";--> statement-breakpoint
ALTER TABLE "user" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "user_email_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");