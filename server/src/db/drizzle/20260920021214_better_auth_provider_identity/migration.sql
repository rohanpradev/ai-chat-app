DROP INDEX "accounts_issuer_account_idx";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "account" ("provider_id","account_id");