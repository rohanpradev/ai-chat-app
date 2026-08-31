CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"account_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"updated_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"ip_address" text,
	"token" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
INSERT INTO "account" (
	"id",
	"account_id",
	"provider_id",
	"user_id",
	"password",
	"created_at",
	"updated_at"
)
SELECT
	gen_random_uuid()::text,
	"id"::text,
	'credential',
	"id",
	"password",
	"created_at",
	"updated_at"
FROM "users"
WHERE "password" IS NOT NULL
ON CONFLICT ("provider_id","account_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password";
