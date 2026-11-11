CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"author_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Start with the About, Privacy and Terms pages that used to be built into the code.
INSERT INTO "pages" ("id", "slug", "title", "content", "status") VALUES
  ('page-about', 'about', 'About MedTeds', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "MedTeds is a place for the people who practise, study and research medicine to write about it in their own words: the cases that changed their thinking, the research behind the headlines, and what life on the wards is really like."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Who writes here"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Doctors, nurses, pharmacists, researchers, public health workers and students, invited by our editors."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "A note on medical advice"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Stories on MedTeds share experience and ideas. They are not personal medical advice. Talk to a qualified clinician about your own health."}]}]}'::jsonb, 'published'),
  ('page-privacy', 'privacy', 'Privacy policy', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "This is a starting template. Replace it with a policy reviewed for your organisation and the places you operate before launch."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "What we collect"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Your name, email address and password (stored as a secure hash) when you create an account; the stories, responses and images you publish; and which stories you clap for, save or respond to."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "How we use it"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "To run your account, show stories to readers, and personalise your feed. We do not sell your data."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Your choices"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "You can edit your profile at any time and ask us to delete your account."}]}]}'::jsonb, 'published'),
  ('page-terms', 'terms', 'Terms of service', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "This is a starting template. Replace it with terms reviewed for your organisation before launch."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Your content"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "You own what you write. By publishing on MedTeds you let us display and distribute it on the site. Only publish work you have the right to share, and never share identifiable patient information."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Community rules"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "No harassment, spam, or health misinformation presented as fact. Editors may remove stories or responses and suspend accounts that break these rules."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Not medical advice"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Content on MedTeds is for general information and is not a substitute for professional medical care."}]}]}'::jsonb, 'published')
ON CONFLICT ("slug") DO NOTHING;
