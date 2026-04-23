CREATE TABLE IF NOT EXISTS "chat" (
	"created_at" timestamp with time zone NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message" (
	"chat_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"metadata" json,
	"order" integer NOT NULL,
	"parts" json NOT NULL,
	"role" varchar(20) NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"created_at" timestamp with time zone NOT NULL,
	"email" varchar(255) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"password" varchar(255) NOT NULL,
	"profile_image" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat" DROP COLUMN IF EXISTS "messages";--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "metadata" json;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_title_idx" ON "chat" USING btree ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_updated_at_idx" ON "chat" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_user_id_idx" ON "chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_user_updated_idx" ON "chat" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_chat_id_idx" ON "message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_chat_order_idx" ON "message" USING btree ("chat_id","order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_role_idx" ON "message" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
