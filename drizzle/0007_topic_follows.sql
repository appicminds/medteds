CREATE TABLE "topic_follows" (
	"user_id" text NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_follows_user_id_topic_id_pk" PRIMARY KEY("user_id","topic_id")
);
--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_follows_topic_idx" ON "topic_follows" USING btree ("topic_id");--> statement-breakpoint
INSERT INTO "topics" ("slug", "name", "description") VALUES
  ('cardiology', 'Cardiology', 'The heart and blood vessels: prevention, diagnosis and care.'),
  ('neurology', 'Neurology', 'The brain, spine and nerves, from headaches to stroke.'),
  ('mental-health', 'Mental Health', 'Mood, anxiety, therapy and the science of the mind.'),
  ('nutrition', 'Nutrition', 'Food, diet and what the evidence really says.'),
  ('public-health', 'Public Health', 'Health of whole communities: prevention, policy and outbreaks.'),
  ('pediatrics', 'Pediatrics', 'Care for babies, children and teenagers.'),
  ('oncology', 'Oncology', 'Cancer research, treatment and living with cancer.'),
  ('medical-education', 'Medical Education', 'Learning and teaching medicine, from school to residency.'),
  ('health-tech', 'Health Tech', 'Digital health, AI and the tools changing care.'),
  ('research', 'Research', 'New studies, trials and how to read them.')
ON CONFLICT ("slug") DO NOTHING;
