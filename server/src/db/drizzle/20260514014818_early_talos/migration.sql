CREATE TABLE "embedding_chunk" (
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"document_id" varchar(255) NOT NULL,
	"embedding" json NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"metadata" json,
	"token_estimate" integer NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_document" (
	"byte_size" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"embedding_model" varchar(120) NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"metadata" json,
	"source_name" varchar(255),
	"source_type" varchar(40) NOT NULL,
	"title" varchar(200) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embedding_chunk" ADD CONSTRAINT "embedding_chunk_document_id_embedding_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."embedding_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embedding_chunk" ADD CONSTRAINT "embedding_chunk_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embedding_document" ADD CONSTRAINT "embedding_document_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embedding_chunks_document_id_idx" ON "embedding_chunk" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "embedding_chunks_document_index_idx" ON "embedding_chunk" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "embedding_chunks_user_id_idx" ON "embedding_chunk" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "embedding_documents_checksum_idx" ON "embedding_document" USING btree ("user_id","checksum");--> statement-breakpoint
CREATE INDEX "embedding_documents_updated_at_idx" ON "embedding_document" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "embedding_documents_user_id_idx" ON "embedding_document" USING btree ("user_id");