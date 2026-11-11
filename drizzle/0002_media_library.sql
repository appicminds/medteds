ALTER TABLE "media" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "filename" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "alt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "storage" text DEFAULT 'db' NOT NULL;--> statement-breakpoint
CREATE INDEX "media_created_idx" ON "media" USING btree ("created_at");--> statement-breakpoint
-- Existing uploads (stored in Postgres) are served from /api/media/<id>.
UPDATE "media" SET "url" = '/api/media/' || "id" WHERE "url" = '';
