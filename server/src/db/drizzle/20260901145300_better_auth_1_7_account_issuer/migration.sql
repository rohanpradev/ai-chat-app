ALTER TABLE "account" ADD COLUMN "issuer" varchar(255);--> statement-breakpoint
UPDATE "account"
SET "issuer" = CASE
	WHEN "provider_id" = 'credential' THEN 'local:credential'
	WHEN "provider_id" = 'github' THEN 'local:oauth:github'
	ELSE NULL
END;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "account" WHERE "issuer" IS NULL) THEN
		RAISE EXCEPTION 'Unsupported account provider found during Better Auth 1.7 issuer backfill';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_idx" ON "account" ("issuer","account_id");--> statement-breakpoint
DROP INDEX "accounts_provider_account_idx";
