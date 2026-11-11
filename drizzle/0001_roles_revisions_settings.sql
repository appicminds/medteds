CREATE TABLE "post_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"saved_by" text,
	"title" text DEFAULT '' NOT NULL,
	"subtitle" text,
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'subscriber';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "trashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_saved_by_user_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_revisions_post_idx" ON "post_revisions" USING btree ("post_id","created_at");--> statement-breakpoint
-- Everyone who could write before roles existed keeps writing access as an Author.
UPDATE "user" SET "role" = 'author' WHERE "role" = 'user';
