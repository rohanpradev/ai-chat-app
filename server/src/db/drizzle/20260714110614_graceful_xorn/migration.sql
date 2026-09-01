CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "message_revision" (
	"chat_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"metadata" json,
	"order" integer NOT NULL,
	"parts" json NOT NULL,
	"revision" integer NOT NULL,
	"role" varchar(20) NOT NULL,
	"schema_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_event" (
	"category" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"model" varchar(120),
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"request_id" varchar(255) NOT NULL,
	"reserved_tokens" integer DEFAULT 0 NOT NULL,
	"resource_bytes" integer DEFAULT 0 NOT NULL,
	"scope" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'reserved' NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embedding_chunk" ALTER COLUMN "embedding" SET DATA TYPE vector(1536) USING ("embedding"::text::vector);--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_revision" ADD CONSTRAINT "message_revision_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_revisions_message_revision_idx" ON "message_revision" USING btree ("message_id","revision");--> statement-breakpoint
CREATE INDEX "message_revisions_chat_created_idx" ON "message_revision" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_request_id_idx" ON "usage_event" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "usage_events_user_scope_created_idx" ON "usage_event" USING btree ("user_id","scope","created_at");--> statement-breakpoint
INSERT INTO "message_revision" ("chat_id", "created_at", "message_id", "metadata", "order", "parts", "revision", "role", "schema_version")
SELECT "chat_id", "created_at", "id", "metadata", "order", "parts", 1, "role", "schema_version" FROM "message"
ON CONFLICT ("message_id", "revision") DO NOTHING;--> statement-breakpoint
CREATE INDEX "embedding_chunks_embedding_hnsw_idx" ON "embedding_chunk" USING hnsw ("embedding" vector_cosine_ops);
